-- Pack 44 public signup API
-- Run after schema.sql in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.get_public_roster(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  family_name text,
  adults integer,
  scouts integer,
  day_adults integer,
  day_scouts integer,
  overnight_adults integer,
  overnight_scouts integer,
  created_at timestamptz,
  slot_ids uuid[]
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.event_id,
    s.family_name,
    s.adults,
    s.scouts,
    s.day_adults,
    s.day_scouts,
    s.overnight_adults,
    s.overnight_scouts,
    s.created_at,
    coalesce(array_agg(ss.slot_id) filter (where ss.slot_id is not null), '{}')
  from public.signups s
  join public.events e on e.id = s.event_id
  left join public.signup_slots ss on ss.signup_id = s.id
  where s.event_id = p_event_id and s.cancelled_at is null and not e.is_archived
  group by s.id;
$$;

create or replace function public.create_family_signup(
  p_event_id uuid,
  p_family_name text,
  p_email text,
  p_adults integer default 0,
  p_scouts integer default 0,
  p_day_adults integer default 0,
  p_day_scouts integer default 0,
  p_overnight_adults integer default 0,
  p_overnight_scouts integer default 0,
  p_notes text default '',
  p_slot_ids uuid[] default '{}'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  signup_id uuid;
  edit_token text := encode(gen_random_bytes(32), 'hex');
  selected_slot uuid;
  selected_count integer;
  slot_limit integer;
begin
  if coalesce(p_adults, 0) + coalesce(p_scouts, 0) + coalesce(p_day_adults, 0) + coalesce(p_day_scouts, 0) + coalesce(p_overnight_adults, 0) + coalesce(p_overnight_scouts, 0) <= 0 then
    raise exception 'At least one attendee is required';
  end if;

  select * into target_event
  from public.events
  where id = p_event_id and not is_archived
  for share;

  if not found then
    raise exception 'Event is not available';
  end if;

  if target_event.kind = 'fundraiser' and cardinality(coalesce(p_slot_ids, '{}')) = 0 then
    raise exception 'At least one fundraiser shift is required';
  end if;

  if target_event.kind <> 'fundraiser' and cardinality(coalesce(p_slot_ids, '{}')) > 0 then
    raise exception 'This event does not accept shifts';
  end if;

  if target_event.kind = 'fundraiser' then
    for selected_slot in
      select id from public.event_slots
      where event_id = p_event_id and id = any(p_slot_ids)
      for update
    loop
      select family_limit into slot_limit
      from public.event_slots
      where id = selected_slot;

      select count(*) into selected_count
      from public.signup_slots ss
      join public.signups s on s.id = ss.signup_id
      where ss.slot_id = selected_slot and s.cancelled_at is null;

      if selected_count >= slot_limit then
        raise exception 'A selected fundraiser shift is full';
      end if;
    end loop;

    if (select count(*) from public.event_slots where event_id = p_event_id and id = any(p_slot_ids)) <> cardinality(p_slot_ids) then
      raise exception 'One or more fundraiser shifts are invalid';
    end if;
  end if;

  insert into public.signups (
    event_id, family_name, email, adults, scouts, day_adults, day_scouts,
    overnight_adults, overnight_scouts, notes, edit_token_hash
  ) values (
    p_event_id, trim(p_family_name), lower(trim(p_email)), coalesce(p_adults, 0), coalesce(p_scouts, 0),
    coalesce(p_day_adults, 0), coalesce(p_day_scouts, 0), coalesce(p_overnight_adults, 0),
    coalesce(p_overnight_scouts, 0), coalesce(p_notes, ''), encode(digest(edit_token, 'sha256'), 'hex')
  ) returning id into signup_id;

  if cardinality(coalesce(p_slot_ids, '{}')) > 0 then
    insert into public.signup_slots (signup_id, slot_id)
    select signup_id, unnest(p_slot_ids);
  end if;

  return json_build_object('signup_id', signup_id, 'edit_token', edit_token);
end;
$$;

create or replace function public.update_family_signup(
  p_edit_token text,
  p_family_name text,
  p_email text,
  p_adults integer default 0,
  p_scouts integer default 0,
  p_day_adults integer default 0,
  p_day_scouts integer default 0,
  p_overnight_adults integer default 0,
  p_overnight_scouts integer default 0,
  p_notes text default '',
  p_slot_ids uuid[] default '{}'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.signups%rowtype;
  selected_slot uuid;
  selected_count integer;
  slot_limit integer;
begin
  select * into existing
  from public.signups
  where edit_token_hash = encode(digest(p_edit_token, 'sha256'), 'hex')
    and cancelled_at is null
  for update;

  if not found then raise exception 'Signup link is invalid or expired'; end if;

  if coalesce(p_adults, 0) + coalesce(p_scouts, 0) + coalesce(p_day_adults, 0) + coalesce(p_day_scouts, 0) + coalesce(p_overnight_adults, 0) + coalesce(p_overnight_scouts, 0) <= 0 then
    raise exception 'At least one attendee is required';
  end if;

  if exists (select 1 from public.events where id = existing.event_id and kind = 'fundraiser') then
    if cardinality(coalesce(p_slot_ids, '{}')) = 0 then
      raise exception 'At least one fundraiser shift is required';
    end if;

    if (select count(*) from public.event_slots where event_id = existing.event_id and id = any(p_slot_ids)) <> cardinality(p_slot_ids) then
      raise exception 'One or more fundraiser shifts are invalid';
    end if;

    for selected_slot in
      select id from public.event_slots
      where event_id = existing.event_id and id = any(p_slot_ids)
      for update
    loop
      select family_limit into slot_limit from public.event_slots where id = selected_slot;
      select count(*) into selected_count
      from public.signup_slots ss join public.signups s on s.id = ss.signup_id
      where ss.slot_id = selected_slot and s.cancelled_at is null and s.id <> existing.id;
      if selected_count >= slot_limit then raise exception 'A selected fundraiser shift is full'; end if;
    end loop;
  elsif cardinality(coalesce(p_slot_ids, '{}')) > 0 then
    raise exception 'This event does not accept shifts';
  end if;

  update public.signups set
    family_name = trim(p_family_name), email = lower(trim(p_email)), adults = coalesce(p_adults, 0), scouts = coalesce(p_scouts, 0),
    day_adults = coalesce(p_day_adults, 0), day_scouts = coalesce(p_day_scouts, 0), overnight_adults = coalesce(p_overnight_adults, 0),
    overnight_scouts = coalesce(p_overnight_scouts, 0), notes = coalesce(p_notes, ''), updated_at = now()
  where id = existing.id;

  delete from public.signup_slots where signup_id = existing.id;
  if cardinality(coalesce(p_slot_ids, '{}')) > 0 then
    insert into public.signup_slots (signup_id, slot_id)
    select existing.id, unnest(p_slot_ids);
  end if;

  return json_build_object('signup_id', existing.id);
end;
$$;

create or replace function public.cancel_family_signup(p_edit_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.signups
  set cancelled_at = now(), updated_at = now()
  where edit_token_hash = encode(digest(p_edit_token, 'sha256'), 'hex')
    and cancelled_at is null;
  return found;
end;
$$;

grant execute on function public.get_public_roster(uuid) to anon, authenticated;
grant execute on function public.create_family_signup(uuid, text, text, integer, integer, integer, integer, integer, integer, text, uuid[]) to anon, authenticated;
grant execute on function public.update_family_signup(text, text, text, integer, integer, integer, integer, integer, integer, text, uuid[]) to anon, authenticated;
grant execute on function public.cancel_family_signup(text) to anon, authenticated;

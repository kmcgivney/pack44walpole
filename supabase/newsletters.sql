-- Parent-only newsletter access. Run after schema.sql and rpc.sql.

create table if not exists public.newsletter_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'parent' check (role in ('cubmaster', 'parent')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists newsletter_members_email_lower_idx
  on public.newsletter_members (lower(email));

-- Promote only the configured Pack 44 Cubmaster account, not every event creator.
insert into public.newsletter_members (user_id, email, role, status)
select u.id, lower(u.email), 'cubmaster', 'active'
from auth.users u
where lower(u.email) = lower('walpole.pack44.cubmaster@gmail.com')
on conflict (user_id) do update
set role = 'cubmaster', status = 'active', updated_at = now();

do $$
begin
  if not exists (
    select 1 from public.newsletter_members
    where role = 'cubmaster' and status = 'active'
  ) then
    raise exception 'No Cubmaster account found. Confirm the Cubmaster Auth email matches the configured Pack 44 email before running newsletters.sql.';
  end if;
end;
$$;

create table if not exists public.newsletter_access_audit (
  id bigint generated always as identity primary key,
  subject_user_id uuid references auth.users(id) on delete set null,
  subject_email text not null,
  action text not null check (action in ('approved', 'revoked', 'reactivated')),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  issue_date date not null,
  storage_path text not null unique check (storage_path like 'issues/%'),
  is_published boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.newsletter_members enable row level security;
alter table public.newsletter_access_audit enable row level security;
alter table public.newsletter_issues enable row level security;

create or replace function public.is_newsletter_cubmaster()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.newsletter_members m
    where m.user_id = auth.uid() and m.role = 'cubmaster' and m.status = 'active'
  );
$$;

create or replace function public.is_newsletter_parent()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select public.is_newsletter_cubmaster() or exists (
    select 1 from public.newsletter_members m
    where m.user_id = auth.uid() and m.role = 'parent' and m.status = 'active'
  );
$$;

-- Authenticated newsletter parents must not inherit signup administration from
-- policies that previously treated any event owner as the Cubmaster.
drop policy if exists "Cubmaster can manage events" on public.events;
create policy "Cubmaster can manage events"
  on public.events for all to authenticated
  using (public.is_newsletter_cubmaster() and created_by = auth.uid())
  with check (public.is_newsletter_cubmaster() and created_by = auth.uid());

drop policy if exists "Cubmaster can manage event slots" on public.event_slots;
create policy "Cubmaster can manage event slots"
  on public.event_slots for all to authenticated
  using (public.is_newsletter_cubmaster() and exists (
    select 1 from public.events e where e.id = event_slots.event_id and e.created_by = auth.uid()
  ))
  with check (public.is_newsletter_cubmaster() and exists (
    select 1 from public.events e where e.id = event_slots.event_id and e.created_by = auth.uid()
  ));

drop policy if exists "Cubmaster can manage signups" on public.signups;
create policy "Cubmaster can manage signups"
  on public.signups for all to authenticated
  using (public.is_newsletter_cubmaster() and exists (
    select 1 from public.events e where e.id = signups.event_id and e.created_by = auth.uid()
  ))
  with check (public.is_newsletter_cubmaster() and exists (
    select 1 from public.events e where e.id = signups.event_id and e.created_by = auth.uid()
  ));

drop policy if exists "Cubmaster can manage signup slots" on public.signup_slots;
create policy "Cubmaster can manage signup slots"
  on public.signup_slots for all to authenticated
  using (public.is_newsletter_cubmaster() and exists (
    select 1 from public.signups s
    join public.events e on e.id = s.event_id
    where s.id = signup_slots.signup_id and e.created_by = auth.uid()
  ))
  with check (public.is_newsletter_cubmaster() and exists (
    select 1 from public.signups s
    join public.events e on e.id = s.event_id
    where s.id = signup_slots.signup_id and e.created_by = auth.uid()
  ));

revoke all on function public.is_newsletter_cubmaster() from public, anon;
revoke all on function public.is_newsletter_parent() from public, anon;
grant execute on function public.is_newsletter_cubmaster() to authenticated;
grant execute on function public.is_newsletter_parent() to authenticated;

drop policy if exists "Members can view own newsletter access" on public.newsletter_members;
create policy "Members can view own newsletter access"
  on public.newsletter_members for select to authenticated
  using (user_id = auth.uid() or public.is_newsletter_cubmaster());

drop policy if exists "Cubmaster can view newsletter audit" on public.newsletter_access_audit;
create policy "Cubmaster can view newsletter audit"
  on public.newsletter_access_audit for select to authenticated
  using (public.is_newsletter_cubmaster());

drop policy if exists "Parents can view published newsletters" on public.newsletter_issues;
create policy "Parents can view published newsletters"
  on public.newsletter_issues for select to authenticated
  using (public.is_newsletter_parent() and (is_published or public.is_newsletter_cubmaster()));

drop policy if exists "Cubmaster can add newsletters" on public.newsletter_issues;
create policy "Cubmaster can add newsletters"
  on public.newsletter_issues for insert to authenticated
  with check (public.is_newsletter_cubmaster() and created_by = auth.uid());

drop policy if exists "Cubmaster can update newsletters" on public.newsletter_issues;
create policy "Cubmaster can update newsletters"
  on public.newsletter_issues for update to authenticated
  using (public.is_newsletter_cubmaster())
  with check (public.is_newsletter_cubmaster());

drop policy if exists "Cubmaster can delete newsletters" on public.newsletter_issues;
create policy "Cubmaster can delete newsletters"
  on public.newsletter_issues for delete to authenticated
  using (public.is_newsletter_cubmaster());

grant select on public.newsletter_members to authenticated;
revoke insert, update, delete on public.newsletter_members from anon, authenticated;
grant select on public.newsletter_issues to authenticated;
grant insert, update, delete on public.newsletter_issues to authenticated;
grant select on public.newsletter_access_audit to authenticated;
revoke insert, update, delete on public.newsletter_access_audit from anon, authenticated;

create or replace function public.audit_newsletter_member_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  audit_action text;
  audit_actor uuid;
begin
  if tg_op = 'INSERT' then
    audit_action := 'approved';
    audit_actor := coalesce(auth.uid(), new.approved_by);
    insert into public.newsletter_access_audit (subject_user_id, subject_email, action, actor_user_id)
    values (new.user_id, new.email, audit_action, audit_actor);
    return new;
  end if;

  if old.status is distinct from new.status then
    audit_action := case when new.status = 'revoked' then 'revoked' else 'reactivated' end;
    audit_actor := case when new.status = 'revoked' then coalesce(auth.uid(), new.revoked_by) else coalesce(auth.uid(), new.approved_by) end;
    insert into public.newsletter_access_audit (subject_user_id, subject_email, action, actor_user_id)
    values (new.user_id, new.email, audit_action, audit_actor);
  end if;
  return new;
end;
$$;

drop trigger if exists newsletter_member_audit_insert on public.newsletter_members;
create trigger newsletter_member_audit_insert
  after insert on public.newsletter_members
  for each row execute function public.audit_newsletter_member_change();

drop trigger if exists newsletter_member_audit_update on public.newsletter_members;
create trigger newsletter_member_audit_update
  after update of status on public.newsletter_members
  for each row execute function public.audit_newsletter_member_change();

create or replace function public.revoke_newsletter_parent(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not public.is_newsletter_cubmaster() then
    raise exception 'Only the Cubmaster can revoke newsletter access';
  end if;

  update public.newsletter_members
  set status = 'revoked', revoked_by = auth.uid(), revoked_at = now(), updated_by = auth.uid(), updated_at = now()
  where user_id = p_user_id and role = 'parent' and status <> 'revoked';
  return found;
end;
$$;

revoke all on function public.revoke_newsletter_parent(uuid) from public, anon;
grant execute on function public.revoke_newsletter_parent(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pack44-newsletters', 'pack44-newsletters', false, 52428800, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

drop policy if exists "Parents can read approved newsletter PDFs" on storage.objects;
create policy "Parents can read approved newsletter PDFs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pack44-newsletters'
    and public.is_newsletter_parent()
    and exists (
      select 1 from public.newsletter_issues i
      where i.storage_path = storage.objects.name
        and (i.is_published or public.is_newsletter_cubmaster())
    )
  );

drop policy if exists "Cubmaster can upload newsletter PDFs" on storage.objects;
create policy "Cubmaster can upload newsletter PDFs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pack44-newsletters'
    and name like 'issues/%'
    and public.is_newsletter_cubmaster()
  );

drop policy if exists "Cubmaster can update newsletter PDFs" on storage.objects;
create policy "Cubmaster can update newsletter PDFs"
  on storage.objects for update to authenticated
  using (bucket_id = 'pack44-newsletters' and public.is_newsletter_cubmaster())
  with check (bucket_id = 'pack44-newsletters' and public.is_newsletter_cubmaster());

drop policy if exists "Cubmaster can delete newsletter PDFs" on storage.objects;
create policy "Cubmaster can delete newsletter PDFs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pack44-newsletters' and public.is_newsletter_cubmaster());
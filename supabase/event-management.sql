-- Cubmaster event management and scouting.org calendar import.
-- Run only after schema.sql, rpc.sql, and newsletters.sql.
-- Apply in the Supabase SQL Editor for the intended project; do not run against
-- production until the migration has been reviewed and the Cubmaster identity verified.

alter table public.events
  add column if not exists source_uid text;

alter table public.events
  add column if not exists end_date date;

alter table public.events
  add column if not exists is_all_day boolean not null default false;

create unique index if not exists events_source_uid_unique_idx
  on public.events (source_uid)
  where source_uid is not null;

-- Newsletter parent authentication must never authorize event operations.
drop policy if exists "Cubmaster can manage events" on public.events;
create policy "Cubmaster can manage events"
  on public.events for all to authenticated
  using (public.is_newsletter_cubmaster() and created_by = auth.uid())
  with check (public.is_newsletter_cubmaster() and created_by = auth.uid());

drop policy if exists "Cubmaster can manage event slots" on public.event_slots;
create policy "Cubmaster can manage event slots"
  on public.event_slots for all to authenticated
  using (public.is_newsletter_cubmaster() and exists (
    select 1 from public.events e
    where e.id = event_slots.event_id and e.created_by = auth.uid()
  ))
  with check (public.is_newsletter_cubmaster() and exists (
    select 1 from public.events e
    where e.id = event_slots.event_id and e.created_by = auth.uid()
  ));

-- RLS controls which rows the authenticated Cubmaster may use; it does not
-- grant the table/column privileges required by PostgREST. Keep these grants
-- limited to the UI operations, and only expose signup IDs needed for counts.
grant select, insert, update on public.events to authenticated;
grant select, insert, update, delete on public.event_slots to authenticated;
grant select (id, event_id) on public.signups to authenticated;

-- Keep public event reads aggregate-safe while exposing the optional event end date.
create or replace function public.get_active_events()
returns json
language sql
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(json_agg(json_build_object(
    'id', e.id,
    'title', e.title,
    'event_date', e.event_date,
    'end_date', e.end_date,
    'start_time', e.start_time,
    'end_time', e.end_time,
    'is_all_day', e.is_all_day,
    'location', e.location,
    'description', e.description,
    'kind', e.kind,
    'event_slots', coalesce((
      select json_agg(json_build_object(
        'id', slot.id,
        'label', slot.label,
        'start_time', slot.start_time,
        'end_time', slot.end_time,
        'family_limit', slot.family_limit
      ) order by slot.start_time)
      from public.event_slots slot
      where slot.event_id = e.id
    ), '[]'::json)
  ) order by e.event_date), '[]'::json)
  from public.events e
  where not e.is_archived;
$$;

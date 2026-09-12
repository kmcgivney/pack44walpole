-- Pack 44 signup database foundation
-- Run this in the Supabase SQL Editor.

create type public.event_kind as enum ('rsvp', 'campout', 'fundraiser');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  location text not null,
  description text not null default '',
  kind public.event_kind not null default 'rsvp',
  is_archived boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  start_time time not null,
  end_time time not null,
  family_limit integer not null default 20 check (family_limit > 0),
  created_at timestamptz not null default now(),
  unique (event_id, start_time, end_time)
);

create table public.signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  family_name text not null check (char_length(trim(family_name)) between 1 and 120),
  email text not null check (char_length(trim(email)) between 3 and 320),
  adults integer not null default 0 check (adults >= 0),
  scouts integer not null default 0 check (scouts >= 0),
  day_adults integer not null default 0 check (day_adults >= 0),
  day_scouts integer not null default 0 check (day_scouts >= 0),
  overnight_adults integer not null default 0 check (overnight_adults >= 0),
  overnight_scouts integer not null default 0 check (overnight_scouts >= 0),
  notes text not null default '',
  edit_token_hash text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (adults + scouts + day_adults + day_scouts + overnight_adults + overnight_scouts > 0)
);

create table public.signup_slots (
  signup_id uuid not null references public.signups(id) on delete cascade,
  slot_id uuid not null references public.event_slots(id) on delete restrict,
  primary key (signup_id, slot_id)
);

create index events_upcoming_idx on public.events (event_date) where not is_archived;
create index event_slots_event_idx on public.event_slots (event_id);
create index signups_event_idx on public.signups (event_id) where cancelled_at is null;
create index signup_slots_slot_idx on public.signup_slots (slot_id);

-- Public roster data intentionally excludes email addresses and edit tokens.
create view public.public_signup_roster with (security_invoker = true) as
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
  coalesce(array_agg(ss.slot_id) filter (where ss.slot_id is not null), '{}') as slot_ids
from public.signups s
left join public.signup_slots ss on ss.signup_id = s.id
where s.cancelled_at is null
group by s.id;

alter table public.events enable row level security;
alter table public.event_slots enable row level security;
alter table public.signups enable row level security;
alter table public.signup_slots enable row level security;

-- Everyone may see active event details.
create policy "Anyone can view active events"
  on public.events for select
  using (not is_archived);

create policy "Anyone can view slots for active events"
  on public.event_slots for select
  using (exists (
    select 1 from public.events e
    where e.id = event_slots.event_id and not e.is_archived
  ));

-- Public roster access goes through the view, never the base signup table.
-- Signup creation and token-based editing will be exposed through server-side
-- functions so email addresses and edit tokens are never returned to browsers.

-- The Cubmaster's authenticated account owns event management.
create policy "Cubmaster can manage events"
  on public.events for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Cubmaster can manage event slots"
  on public.event_slots for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_slots.event_id and e.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_slots.event_id and e.created_by = auth.uid()
  ));

create policy "Cubmaster can manage signups"
  on public.signups for all to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = signups.event_id and e.created_by = auth.uid()
  ));

create policy "Cubmaster can manage signup slots"
  on public.signup_slots for all to authenticated
  using (exists (
    select 1
    from public.signups s
    join public.events e on e.id = s.event_id
    where s.id = signup_slots.signup_id and e.created_by = auth.uid()
  ));

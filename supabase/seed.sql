-- Pack 44 initial events
-- Run after schema.sql and rpc.sql.
-- This is safe to rerun: it does not delete or modify signups.

do $$
declare
  cubmaster_id uuid;
  hike_id uuid := '00000000-0000-0000-0000-000000000301';
  fundraiser_id uuid := '00000000-0000-0000-0000-000000000302';
  campout_id uuid := '00000000-0000-0000-0000-000000000303';
begin
  select id into cubmaster_id
  from auth.users
  where lower(email) = lower('walpole.pack44.cubmaster@gmail.com')
  limit 1;

  if cubmaster_id is null then
    raise exception 'Create the Cubmaster Auth user before running seed.sql';
  end if;

  insert into public.events (id, title, event_date, start_time, end_time, location, description, kind, created_by)
  values
    (hike_id, 'Pack 44 Fall Hike', '2026-10-03', '09:00', '12:00', 'Adams Farm, Walpole, MA', 'A morning on the trail with our Pack 44 families.', 'rsvp', cubmaster_id),
    (fundraiser_id, 'Rocky''s Ace Hardware Fundraiser', '2026-10-10', '09:00', '12:00', 'Rocky''s Ace Hardware, Walpole, MA', 'Help Pack 44 raise money at Rocky''s Ace Hardware.', 'fundraiser', cubmaster_id),
    (campout_id, 'Pack 44 Campout', '2026-10-24', null, null, 'Jarvis Farm with Troop 44', 'A Pack 44 campout with our friends in Troop 44. More details will follow.', 'campout', cubmaster_id)
  on conflict (id) do update set
    title = excluded.title,
    event_date = excluded.event_date,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    location = excluded.location,
    description = excluded.description,
    kind = excluded.kind,
    is_archived = false,
    updated_at = now();

  insert into public.event_slots (id, event_id, label, start_time, end_time, family_limit)
  values
    ('00000000-0000-0000-0000-000000000311', fundraiser_id, '9:00 AM - 10:00 AM', '09:00', '10:00', 20),
    ('00000000-0000-0000-0000-000000000312', fundraiser_id, '10:00 AM - 11:00 AM', '10:00', '11:00', 20),
    ('00000000-0000-0000-0000-000000000313', fundraiser_id, '11:00 AM - 12:00 PM', '11:00', '12:00', 20)
  on conflict (id) do update set
    label = excluded.label,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    family_limit = excluded.family_limit;
end;
$$;

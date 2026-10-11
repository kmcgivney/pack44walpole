# Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `schema.sql`.
4. Run `rpc.sql`.
5. Run `seed.sql` to create the hike, fundraiser, campout, and fundraiser shifts.
6. Enable email magic-link authentication for the Cubmaster account.
7. Add the project URL and publishable key to the app environment when we wire the frontend.

The schema keeps family email addresses and edit-token hashes out of the public roster view. `rpc.sql` adds an aggregate-only public event summary, Cubmaster-only detailed roster access, the public family signup API, private edit/cancel operations, and atomic fundraiser slot-capacity checks. It should be run only after `schema.sql`.

`seed.sql` looks up the Cubmaster account by the Pack 44 contact email and is safe to rerun. It updates only the three initial events and their fundraiser shifts; it does not delete or modify signups.

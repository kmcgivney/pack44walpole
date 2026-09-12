# Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `schema.sql`.
4. Enable email magic-link authentication for the Cubmaster account.
5. Add the project URL and publishable key to the app environment when we wire the frontend.

The schema keeps family email addresses and edit-token hashes out of the public roster view. Public family signups will be added through server-side functions in the next database step, where slot capacity can be checked atomically.

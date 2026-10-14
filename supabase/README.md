# Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `schema.sql`.
4. Run `rpc.sql`.
5. Run `seed.sql` to create the hike, fundraiser, campout, and fundraiser shifts.
6. Enable email magic-link authentication for the Cubmaster account.
7. Add the project URL and publishable key to local `.env` and GitHub Actions repository variables. Never put a service-role key in frontend configuration.

The schema keeps family email addresses and edit-token hashes out of the public roster view. `rpc.sql` adds an aggregate-only public event summary, Cubmaster-only detailed roster access, the public family signup API, private edit/cancel operations, and atomic fundraiser slot-capacity checks. It should be run only after `schema.sql`.

`seed.sql` looks up the Cubmaster account by the Pack 44 contact email and is safe to rerun. It updates only the three initial events and their fundraiser shifts; it does not delete or modify signups.

## Private newsletter access

The public site does not contain newsletter PDFs. Parent access is through Supabase Auth email links and a private Storage bucket. Event RSVPs remain no-account, and the migration hardens signup management policies so parent accounts cannot manage events or see signup rosters.

Authentication alone does not grant newsletter access. RLS and Storage policies require an active `newsletter_members` row, which only the Cubmaster-authorized Edge Function can create. A self-registered Auth user without that row is denied. You may also disable public email signup in Supabase Auth after confirming Cubmaster invitations work; the membership policy remains the authorization boundary either way.

To activate the newsletter feature:

1. Confirm the existing Cubmaster Auth user uses `walpole.pack44.cubmaster@gmail.com` and owns the Pack 44 events. `newsletters.sql` seeds that account as the newsletter Cubmaster and stops if it cannot find the account.
2. Since `schema.sql`, `rpc.sql`, and `seed.sql` have already been run for this project, do not rerun them. Run only `newsletters.sql` in the Supabase SQL Editor now. The ordering note means this migration depends on those existing tables and functions. Review `newsletter_members` and confirm the Cubmaster row is correct before inviting anyone.
3. In Authentication URL Configuration, allow `https://pack44walpole.org/newsletters/` as a redirect URL. Keep `https://pack44walpole.org/signups/` and the localhost wildcard redirect too.
4. Deploy the `invite-newsletter-parent` Edge Function from the repository using the Supabase CLI. From the repository root, link the CLI to this Supabase project, then run `supabase functions deploy invite-newsletter-parent`.
5. Set the Edge Function secret `NEWSLETTER_SITE_URL` to `https://pack44walpole.org` (without a trailing slash). Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions; do not copy the service-role key into GitHub variables, Vite settings, or browser code.
6. Test Cubmaster sign-in, invite one parent test account, confirm that parent can see only published newsletter issues, then revoke the test account and confirm access is denied. Do not upload the existing archive until each issue has been approved for parent release.

The newsletter page is `/newsletters/`. The Cubmaster can approve/revoke parent accounts and upload/unpublish approved PDFs there. Parent sign-in does not create accounts; only the Cubmaster invitation function grants newsletter membership. Signed PDF links expire after five minutes. Revoking membership blocks new issue listing and link creation, but an already-created signed URL can remain valid until it expires.

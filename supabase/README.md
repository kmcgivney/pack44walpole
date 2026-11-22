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

## Cubmaster event management and scouting.org calendar import

The signup page shows event management tools only after `is_newsletter_cubmaster()` confirms the signed-in user is the active Cubmaster. Database RLS independently enforces the same role and event ownership; the public signup API remains aggregate-only. Family signup creation/edit/cancel operations are unchanged.

To install this feature:

1. Verify the Cubmaster Auth user and `newsletter_members` role/status first. Apply `event-management.sql` in the Supabase SQL Editor only after `schema.sql`, `rpc.sql`, and `newsletters.sql`. This adds nullable unique source-UID tracking, all-day and multi-day event fields, an updated aggregate-safe active-event RPC, tightens event/event-slot write policies, and explicitly grants the authenticated role only the table/column privileges used by the manager. RLS still limits those operations to the active Cubmaster and events they own. Do not execute it against production until reviewed and approved by the project operator.
2. Deploy the server-side ICS proxy from the repository root with `supabase functions deploy scouting-calendar`. The Edge Function uses the authenticated user's JWT to verify `is_newsletter_cubmaster()` before fetching the fixed scouting.org feed. Supabase supplies its URL and anon key; no service-role key is required or included in browser code.
3. Verify with a Cubmaster account that event create/edit/archive/restore works, an imported event is initially archived, the preview shows proposed field changes, and only explicitly selected and confirmed actions are applied. Confirm an update preserves signup type, time slots, archive state, and signup records.
4. Verify with an authenticated newsletter parent and an anonymous browser that event writes and the ICS proxy are denied, while public active-event details and aggregate signup summaries continue to work. A parent account is not an event administrator.

If the manager reports `permission denied for table events` (HTTP 403 / SQLSTATE
42501), that is a PostgreSQL table-ACL error, not an RLS denial: RLS policy
failures typically produce no visible rows or an RLS policy error. `event-management.sql`
now includes the narrow grants required for event reads/inserts/updates, slot
reads/writes, and signup ID/event-ID counts. If that migration was already run
before these grants were added, re-run the updated migration or apply just those
three `GRANT` statements in the intended non-production project. Separately
verify that the signed-in user is an active `cubmaster` in `newsletter_members`,
that `is_newsletter_cubmaster()` returns true for that session, and that
`events.created_by` matches that user's Auth UUID. Missing/wrong role or owner
is an RLS/auth issue and must not be fixed by granting broader access.

The organizer can create/edit RSVP, campout, or fundraiser events. Event type and shift changes are locked when signup records exist, preserving family slot choices. Archiving preserves signups; restoring is deliberate. ICS import runs through the server-side proxy rather than a browser cross-origin fetch. The importer tracks the feed's stable `UID`: new events are created archived and are not selected, while updates change only title, date, time, location, and description. Each proposed update is previewed with old/new values and requires explicit selection plus confirmation. A source cancellation never archives automatically; the Cubmaster must explicitly select and confirm archival. No import operation deletes events or signup data.

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

### Customize hosted Auth emails

Hosted Supabase Auth does not automatically load templates from this repository. The repository files are the version-controlled source; copy their contents into the hosted project:

- Open **Authentication → Email Templates → Invite user**. Set the subject from `email-templates/invite-subject.txt` and the body from `email-templates/invite.html`.
- Open **Authentication → Email Templates → Magic Link**. Set the subject from `email-templates/magic-link-subject.txt` and the body from `email-templates/magic-link.html`.
- Save each template and send a test email to verify the Pack 44 wording, link destination, and layout.
- Set the sender name to `Pack 44 Walpole` in the project's Auth SMTP/email settings. A Pack-controlled sender address requires configuring custom SMTP and the corresponding domain authentication records; otherwise, keep the provider's verified sender address.

# Pack44walpole.org Site Backlog

Site-wide work for the home page and sections outside the signup app is tracked here. Signup-specific work remains in `PLAN.md`.

## Your TODO

- [x] Set the MVP access policy: the Cubmaster is the only person who approves parent access and can revoke any parent's access. Defer multiple parent approvers until after the MVP.
- [x] Confirm the restored `pack-44-signups` Supabase project is the production project, the app connection is correct, and email sign-in is enabled.
- [x] Register `pack44walpole.org` with Namecheap.
- [x] Connect `pack44walpole.org` to GitHub Pages and verify HTTPS with Enforce HTTPS enabled.
- [x] Add the production signup redirect URL (for example, `https://pack44walpole.org/signups/`) in Supabase Auth URL Configuration; keep `http://localhost:5173/**` for local development.
- [x] Add `https://pack44walpole.org/newsletters/` to Supabase Auth allowed redirect URLs before deploying parent invitations.
- [x] Configure the Supabase Edge Function setting `NEWSLETTER_SITE_URL=https://pack44walpole.org`.
- [x] Choose no-account RSVP for the MVP; keep parent account approval for protected newsletter access.
- [x] Keep full signup rosters and family details Cubmaster-only for the MVP. Public event pages may show aggregate attendance and slot totals; consider broader parent visibility after the MVP.
- [x] Approve the Cubmaster-only newsletter onboarding procedure provisionally; revisit after committee feedback.
- [ ] Paste the version-controlled invite and magic-link templates from `supabase/email-templates/` into Supabase Authentication > Email Templates. Set a recognizable Pack 44 sender name/address; custom SMTP can be configured later if needed.
- [ ] Decide how to handle Supabase's approximately 7-day inactivity pause risk: review current plan limits and choose an appropriate plan/hosting arrangement before relying on the project for live signups.
- [x] Keep the original newsletter PDF backups on the Cubmaster's home computer; the local `newsletter_archive/` folder is intentionally excluded from Git and the public build.
- [ ] Choose a repeatable newsletter authoring workflow and keep original image assets together with the editable source document before exporting each issue to PDF.
- [ ] Review the issue PDFs and choose which issues may be made available to parents.
- [ ] After committee feedback, decide whether the site needs public Pack information or should remain a parent-focused utility; promotional public content is not a current priority.
- [x] Replace slogan-like site copy with straightforward descriptions of Pack 44 signups and newsletters.
- [ ] After committee feedback, decide whether to retain no-account RSVPs or require parent accounts for signups. Keep the current no-account RSVP model until a decision is made.
- [ ] Investigate Google Workspace and Google Groups for Pack email: compare a simple parent mailing list with a Collaborative Inbox, including setup, moderation, reply behavior, domain requirements, and costs before deciding whether to adopt it.
- [ ] Explore automating event updates from the Pack calendar on advancements.scouting.org to this site. First investigate supported calendar feeds or APIs, then decide how imported events should be reviewed and kept in sync.

## Current Parent Onboarding Flow (MVP)

This is the implemented MVP flow for private newsletter access. Event RSVPs remain available without accounts. Keep this workflow in place while committee feedback is pending.

1. A parent requests access from the Cubmaster, or the Cubmaster offers an invitation.
2. The Cubmaster confirms the person is a current Pack 44 parent/guardian using existing pack membership information. Do not collect extra sensitive information for verification.
3. The Cubmaster approves the email in the newsletter tools. A new Auth account receives an invitation; an existing account is granted newsletter membership without needing another invitation. Parents cannot self-register into an authorized role or change their own role.
4. The parent signs in by email and can access approved newsletters only. Parent access does not include signup rosters or Cubmaster administration.
5. The Cubmaster can revoke a parent's access at any time. Record who approved or revoked access and when.

For the MVP, only the Cubmaster performs parent approvals and revocations. This is the current workflow while committee feedback is pending; revisit it if the committee requests changes. Add delegated parent approvers only if needed after the MVP is in use.

### MVP Access Decisions

- Families follow event links and RSVP without accounts, entering the required parent contact and attendance details. Private manage links support later changes.
- Parent accounts are for approved access to the private newsletter archive. Do not require account creation to RSVP.
- Keep full signup rosters Cubmaster-only. Public event pages show event details and aggregate signup/slot totals, not family names or contact details.

“No-account” RSVP is not anonymous in the privacy sense: the signup still collects identifying contact information. Keep parent emails, notes, and private manage tokens hidden from other families, and do not expose private newsletter files publicly.

## Agent TODO

- [x] Build and deploy the Vite site to GitHub Pages through Actions, publishing only `dist/` so local newsletter PDFs are excluded.
- [x] Build and deploy the newsletter sign-in/archive UI, Cubmaster invite/revoke controls, private-PDF upload flow, RLS migration, and invitation Edge Function.
- [x] Apply `supabase/newsletters.sql` and deploy `invite-newsletter-parent`; grant the service role the required membership/audit write privileges.
- [x] Configure Supabase invitation and sign-in redirects and `NEWSLETTER_SITE_URL`.
- [x] Verify one approved existing parent can access the published newsletter.
- [ ] Test revocation and denied access, including direct PDF URLs, with revoked and unauthorized accounts.
- [ ] Apply the invite and magic-link email templates to the hosted Supabase Auth settings; verify sender identity and delivery.
- [ ] Keep future changes aligned with committee feedback on Cubmaster-only approval and whether event RSVPs should require parent login.
- [ ] Keep the landing page focused on parent utility for now; defer public Pack marketing content until the audience decision is revisited.
- [ ] Keep signup rosters Cubmaster-only; never expose other families' emails, notes, or private manage links.
- [ ] Document newsletter upload, access revocation, and backup/restore procedures.

## Acceptance Criteria

- [ ] Logged-out visitors and signed-in non-parents cannot list or retrieve newsletter issues, PDFs, images, or other newsletter files, including by direct URL.
- [ ] Full signup rosters and family details are visible only to the Cubmaster; public event pages show aggregate counts only.
- [ ] Parent accounts can access approved newsletters only, not signup rosters or Cubmaster administration; no other family's email or private manage token is exposed.
- [ ] Only the Cubmaster can approve/invite parents or revoke parent access when parent accounts are used; revocation blocks new protected requests immediately. PDF download links have a short, documented expiry because an already-issued signed URL may remain usable until it expires.
- [ ] Parents cannot grant access to other accounts, change their role, or access Cubmaster-only administration.
- [ ] No private issue content is present in the public GitHub Pages output.

GitHub Pages serves deployed static files publicly. Hiding links, using an unguessable URL, making a repository private, or adding `noindex` does not make newsletter content parents-only. Do not put private issues in the GitHub Pages build unless a separate authenticated service protects the content itself.
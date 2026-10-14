# Pack44walpole.org Site Backlog

Site-wide work for the home page and sections outside the signup app is tracked here. Signup-specific work remains in `PLAN.md`.

## Your TODO

- [x] Set the MVP access policy: the Cubmaster is the only person who approves parent access and can revoke any parent's access. Defer multiple parent approvers until after the MVP.
- [x] Confirm the restored `pack-44-signups` Supabase project is the production project, the app connection is correct, and email sign-in is enabled.
- [x] Register `pack44walpole.org` with Namecheap.
- [x] Connect `pack44walpole.org` to GitHub Pages and verify HTTPS with Enforce HTTPS enabled.
- [x] Add the production signup redirect URL (for example, `https://pack44walpole.org/signups/`) in Supabase Auth URL Configuration; keep `http://localhost:5173/**` for local development.
- [ ] Add `https://pack44walpole.org/newsletters/` to Supabase Auth allowed redirect URLs before deploying parent invitations.
- [x] Configure the Supabase Edge Function setting `NEWSLETTER_SITE_URL=https://pack44walpole.org`.
- [x] Choose no-account RSVP for the MVP; keep parent account approval for protected newsletter access.
- [x] Keep full signup rosters and family details Cubmaster-only for the MVP. Public event pages may show aggregate attendance and slot totals; consider broader parent visibility after the MVP.
- [ ] Approve the newsletter onboarding procedure before enabling parent accounts: verify against the existing pack membership list or direct confirmation, invite by email yourself, allow access to approved newsletters only, and revoke access yourself when needed.
- [ ] Decide how to handle Supabase's approximately 7-day inactivity pause risk: review current plan limits and choose an appropriate plan/hosting arrangement before relying on the project for live signups.
- [ ] Keep a second copy of the original newsletter PDFs somewhere separate from Supabase; the local `newsletter_archive/` folder is intentionally excluded from Git and the public build.
- [ ] Choose a repeatable newsletter authoring workflow and keep original image assets together with the editable source document before exporting each issue to PDF.
- [ ] Review the issue PDFs and choose which issues may be made available to parents.
- [ ] Write and approve factual public copy about Pack 44: who we are, where and when we meet, and how to contact the pack.
- [ ] Revisit the public-site copy and replace slogan-like phrases (such as “Make room for adventure” and “Built for families. Handled with care.”) with a more straightforward, low-key tone.

## Draft Parent Onboarding Flow

This draft applies to parent accounts for the protected newsletter archive; event RSVPs remain available without accounts for the MVP. It is not implemented yet. Agents should determine the secure Supabase mechanics separately and report back before access is enabled.

1. A parent requests access from the Cubmaster, or the Cubmaster offers an invitation.
2. The Cubmaster confirms the person is a current Pack 44 parent/guardian using existing pack membership information. Do not collect extra sensitive information for verification.
3. The Cubmaster approves and invites the parent's email. The system grants only the `parent` role after approval; parents cannot self-register into an authorized role or change their own role.
4. The parent signs in by email and can access approved newsletters only. Parent access does not include signup rosters or Cubmaster administration.
5. The Cubmaster can revoke a parent's access at any time. Record who approved or revoked access and when.

For the MVP, only the Cubmaster performs parent approvals and revocations. Add delegated parent approvers only if needed after the MVP is in use.

### MVP Access Decisions

- Families follow event links and RSVP without accounts, entering the required parent contact and attendance details. Private manage links support later changes.
- Parent accounts are for approved access to the private newsletter archive. Do not require account creation to RSVP.
- Keep full signup rosters Cubmaster-only. Public event pages show event details and aggregate signup/slot totals, not family names or contact details.

“No-account” RSVP is not anonymous in the privacy sense: the signup still collects identifying contact information. Keep parent emails, notes, and private manage tokens hidden from other families, and do not expose private newsletter files publicly.

## Agent TODO

- [x] Build and deploy the Vite site to GitHub Pages through Actions, publishing only `dist/` so local newsletter PDFs are excluded.
- [x] Add the newsletter sign-in/archive UI, Cubmaster invite/revoke controls, private-PDF upload flow, RLS migration, and invitation Edge Function in the repository. This is local implementation only; it is not active in Supabase until deployed.
- [ ] Apply `supabase/newsletters.sql` to the restored Supabase project and confirm the Cubmaster membership row is correct.
- [ ] Deploy the `invite-newsletter-parent` Edge Function to the linked Supabase project.
- [ ] Test invitation, newsletter access, revocation, and denied access with Cubmaster, approved-parent, revoked-parent, and unauthorized accounts.
- [ ] Build out the public, unauthenticated Pack 44 home/about content using the approved copy, including who-we-are and meeting details; link to event signups and the protected newsletter sign-in without exposing newsletter issues.
- [ ] Implement no-account event RSVP and Cubmaster-approved parent accounts for newsletter access. Keep role changes server-controlled; never allow users to grant themselves roles.
- [ ] Research and document the Supabase Auth, database/RLS, and private Storage setup needed for no-account RSVP plus protected newsletters; present the recommendation for Cubmaster approval before enabling access.
- [ ] Provide the Cubmaster a way to approve/invite parents and revoke any parent account.
- [ ] Do not allow unrestricted self-registration into the protected newsletter archive; event RSVP remains available without an account.
- [ ] Record who approved or revoked each parent's access and when; make the audit history visible to the Cubmaster.
- [ ] Create a private Supabase Storage bucket for approved newsletter PDFs; never use a public bucket or put a service-role key in browser code.
- [ ] Implement parent-only authorization for listing issues and issuing downloads. Apply authorization to the actual PDF objects and direct download URLs, not only the archive page.
- [ ] Keep the public newsletter landing page free of issue content and links until the protected archive is ready. Do not put private PDFs or extracted newsletter HTML in the GitHub Pages build.
- [ ] Grant parent accounts newsletter access only; keep signup rosters and Cubmaster administration restricted to the Cubmaster, and never expose other families' email addresses or private manage tokens.
- [ ] Test anonymous access, signed-in but unauthorized access, authorized parent access, and expired/revoked download links against every protected feature and direct file URL.
- [ ] Document the upload, access revocation, and backup/restore procedures; update this backlog as items are verified.

## Acceptance Criteria

- [ ] Logged-out visitors and signed-in non-parents cannot list or retrieve newsletter issues, PDFs, images, or other newsletter files, including by direct URL.
- [ ] Full signup rosters and family details are visible only to the Cubmaster; public event pages show aggregate counts only.
- [ ] Parent accounts can access approved newsletters only, not signup rosters or Cubmaster administration; no other family's email or private manage token is exposed.
- [ ] Only the Cubmaster can approve/invite parents or revoke parent access when parent accounts are used; revocation blocks new protected requests immediately. PDF download links have a short, documented expiry because an already-issued signed URL may remain usable until it expires.
- [ ] Parents cannot grant access to other accounts, change their role, or access Cubmaster-only administration.
- [ ] No private issue content is present in the public GitHub Pages output.

GitHub Pages serves deployed static files publicly. Hiding links, using an unguessable URL, making a repository private, or adding `noindex` does not make newsletter content parents-only. Do not put private issues in the GitHub Pages build unless a separate authenticated service protects the content itself.
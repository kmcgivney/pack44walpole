# Pack44walpole.org Site Backlog

Site-wide work for the home page and sections outside the signup app is tracked here. Signup-specific work remains in `PLAN.md`.

## Your TODO

- [x] Set the access policy: the Cubmaster is the sole top-level authority, appoints/removes parent-access approvers, and can revoke any parent's or approver's access. Appointed approvers may approve/invite parents but cannot appoint approvers or change the Cubmaster role.
- [x] Confirm the restored `pack-44-signups` Supabase project is the production project, the app connection is correct, and email sign-in is enabled.
- [x] Register `pack44walpole.org` with Namecheap.
- [ ] Connect the domain's DNS to the website host and verify HTTPS works.
- [ ] After the domain is live, add the production signup redirect URL (for example, `https://pack44walpole.org/signups/`) in Supabase Auth URL Configuration; keep `http://localhost:5173/**` for local development.
- [ ] Review how to configure Supabase parent invitations and role assignment before enabling newsletter accounts; follow the role policy below and do not enable unrestricted public signup.
- [ ] Decide how to handle Supabase's approximately 7-day inactivity pause risk: review current plan limits and choose an appropriate plan/hosting arrangement before relying on the project for live signups.
- [ ] Keep a second copy of the original newsletter PDFs somewhere separate from Supabase; the local `newsletter_archive/` folder is intentionally excluded from Git and the public build.
- [ ] Choose a repeatable newsletter authoring workflow and keep original image assets together with the editable source document before exporting each issue to PDF.
- [ ] Review the issue PDFs and approve which issues may be made available to parents.

## Agent TODO

- [ ] Implement distinct `cubmaster`, `parent_approver`, and `parent` permissions. Keep role changes server-controlled; never allow users to grant themselves roles or let parent approvers appoint other approvers.
- [ ] Provide the Cubmaster a way to add/remove parent approvers and revoke any parent account. Provide parent approvers a way to approve/invite parents, without Cubmaster or signup-roster privileges.
- [ ] Disable unrestricted public signup. Require an approval/invitation step before a parent account can access the newsletter archive.
- [ ] Record who approved or revoked each parent's access and when; make the audit history visible to the Cubmaster.
- [ ] Create a private Supabase Storage bucket for approved newsletter PDFs; never use a public bucket or put a service-role key in browser code.
- [ ] Implement parent-only authorization for listing issues and issuing downloads. Apply authorization to the actual PDF objects and direct download URLs, not only the archive page.
- [ ] Keep the public newsletter landing page free of issue content and links until the protected archive is ready. Do not put private PDFs or extracted newsletter HTML in the GitHub Pages build.
- [ ] Give parent accounts newsletter access only; do not grant Cubmaster signup privileges or access to signup rosters.
- [ ] Test anonymous access, signed-in but unauthorized access, authorized parent access, and expired/revoked download links against both the archive and direct file URLs.
- [ ] Document the upload, access revocation, and backup/restore procedures; update this backlog as items are verified.

## Acceptance Criteria

- [ ] Logged-out visitors and signed-in non-parents cannot list or retrieve newsletter issues, PDFs, images, or other newsletter files, including by direct URL.
- [ ] An authorized parent can view the archive and download approved issues without gaining access to signup rosters or Cubmaster tools.
- [ ] Parent approvers can approve/invite parents but cannot add/remove approvers, grant Cubmaster access, or access signup rosters.
- [ ] The Cubmaster can add/remove approvers and revoke parent access; revocation blocks new archive requests immediately. PDF download links have a short, documented expiry because an already-issued signed URL may remain usable until it expires.
- [ ] No private issue content is present in the public GitHub Pages output.

GitHub Pages serves deployed static files publicly. Hiding links, using an unguessable URL, making a repository private, or adding `noindex` does not make newsletter content parents-only. Do not put private issues in the GitHub Pages build unless a separate authenticated service protects the content itself.
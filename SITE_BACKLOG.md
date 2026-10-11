# Pack44walpole.org Site Backlog

Site-wide work for the home page and sections outside the signup app is tracked here. Signup-specific work remains in `PLAN.md`.

## Newsletter Privacy

- [ ] Keep newsletter issues private to Pack 44 parents; do not publish issue content or attachments until access control is in place.
- [ ] Choose and document how parents are verified, invited, and removed when they are no longer part of the pack.
- [ ] Require authentication and authorization before serving both the newsletter archive and every issue or attachment. Protect direct file URLs, not only the page that links to them.
- [ ] Give parent accounts access only to newsletters; do not grant signup roster or Cubmaster privileges.
- [ ] Verify logged-out visitors cannot retrieve the archive, issue pages, PDFs, images, or other newsletter files, while an authorized parent can.

GitHub Pages serves deployed static files publicly. Hiding links, using an unguessable URL, making a repository private, or adding `noindex` does not make newsletter content parents-only. Do not put private issues in the GitHub Pages build unless a separate authenticated service protects the content itself.
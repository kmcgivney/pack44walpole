import { supabase, supabaseConfigured } from './supabase.js';

const BUCKET = 'pack44-newsletters';
const SIGNED_URL_SECONDS = 300;
const app = document.querySelector('#newsletter-app');

let session = null;
let access = { parent: false, cubmaster: false };
let issues = [];
let members = [];
let auditEntries = [];
let pageError = '';
let pageNotice = '';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function renderMessages() {
  if (!pageError && !pageNotice) return '';
  return `<div class="newsletter-message ${pageError ? 'is-error' : 'is-success'}" role="status">${escapeHtml(pageError || pageNotice)}</div>`;
}

function renderIssue(issue) {
  const issueDate = new Date(`${issue.issue_date}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return `<article class="newsletter-issue">
    <div class="issue-date"><span>${escapeHtml(issueDate)}</span><strong>PDF</strong></div>
    <div class="issue-details"><h3>${escapeHtml(issue.title)}</h3><p>Pack 44 newsletter</p></div>
    <div class="issue-actions">
      <button class="small-button" type="button" data-issue-download="${escapeHtml(issue.id)}">Create private download link</button>
      ${access.cubmaster ? `<button class="small-button danger" type="button" data-issue-publish="${escapeHtml(issue.id)}">${issue.is_published ? 'Unpublish' : 'Publish'}</button>` : ''}
    </div>
  </article>`;
}

function renderCubmasterTools() {
  return `<section class="newsletter-admin" aria-labelledby="newsletter-admin-heading">
    <div class="archive-heading"><div><p class="eyebrow orange">Cubmaster tools</p><h2 id="newsletter-admin-heading">Publish an issue</h2></div></div>
    <p class="field-help">Only upload issues you have approved for parent access. PDFs are stored in the private newsletter bucket.</p>
    <form id="newsletter-upload" class="newsletter-form newsletter-upload-form">
      <label>Issue title<input name="title" required maxlength="160" placeholder="October 2026" /></label>
      <label>Issue date<input name="issueDate" type="date" required /></label>
      <label>PDF file<input name="pdf" type="file" accept="application/pdf,.pdf" required /></label>
      <button class="button button-primary" type="submit">Upload and publish issue</button>
    </form>
    <hr />
    <h3>Approve a parent</h3>
    <form id="parent-invite" class="newsletter-form invite-form">
      <label>Parent email<input name="email" type="email" autocomplete="email" required placeholder="parent@example.com" /></label>
      <button class="button button-secondary" type="submit">Approve and send sign-in email</button>
    </form>
  </section>`;
}

function renderMemberTools() {
  return `<section class="newsletter-admin member-admin" aria-labelledby="member-heading">
    <div class="archive-heading"><div><p class="eyebrow orange">Access management</p><h2 id="member-heading">Parent access</h2></div></div>
    ${members.length ? `<div class="member-list">${members.map((member) => `
      <article class="member-row"><div><strong>${escapeHtml(member.email)}</strong><small>${member.status === 'active' ? 'Access active' : 'Access revoked'}${member.approved_at ? ` · approved ${escapeHtml(new Date(member.approved_at).toLocaleDateString())}` : ''}</small></div>
      ${member.status === 'active' ? `<button class="small-button danger" type="button" data-parent-revoke="${escapeHtml(member.user_id)}">Revoke access</button>` : ''}</article>`).join('')}</div>` : '<p class="archive-empty-state">No parent accounts yet.</p>'}
    <h3>Recent access activity</h3>
    ${auditEntries.length ? `<div class="audit-list">${auditEntries.map((entry) => `<p><strong>${escapeHtml(entry.action)}</strong> · ${escapeHtml(entry.subject_email)} · ${escapeHtml(new Date(entry.created_at).toLocaleString())}</p>`).join('')}</div>` : '<p class="archive-empty-state">No access changes recorded yet.</p>'}
  </section>`;
}

function render() {
  if (!supabaseConfigured) {
    app.innerHTML = `<section class="page-intro"><p class="eyebrow"><span></span> Pack 44, Walpole</p><h1>Newsletters</h1><p>Newsletter access is not configured in this deployment.</p></section>`;
    return;
  }

  if (!session) {
    app.innerHTML = `
      <section class="page-intro" aria-labelledby="page-title">
        <p class="eyebrow"><span></span> Pack 44, Walpole</p><h1 id="page-title">Newsletters</h1>
        <p>Sign in with an email address approved by the Cubmaster to read Pack 44 newsletters.</p>
      </section>
      ${renderMessages()}
      <section class="newsletter-auth" aria-labelledby="signin-heading">
        <h2 id="signin-heading">Parent sign-in</h2>
        <form id="newsletter-signin" class="newsletter-form">
          <label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></label>
          <button class="button button-primary" type="submit">Email me a sign-in link</button>
        </form>
        <p class="field-help">Access is approved by the Cubmaster. No account? Contact <a href="mailto:walpole.pack44.cubmaster@gmail.com">the Cubmaster</a>.</p>
      </section>`;
    app.querySelector('#newsletter-signin')?.addEventListener('submit', requestSignInLink);
    return;
  }

  if (!access.parent) {
    app.innerHTML = `
      <section class="page-intro"><p class="eyebrow"><span></span> Pack 44, Walpole</p><h1>Newsletters</h1><p>This account does not have access to the Pack 44 newsletter archive.</p></section>
      ${renderMessages()}
      <div class="newsletter-session"><span>Signed in as ${escapeHtml(session.user.email)}</span><button class="auth-button" id="newsletter-signout" type="button">Sign out</button></div>
      <p class="newsletter-help">For parent access, contact <a href="mailto:walpole.pack44.cubmaster@gmail.com">the Cubmaster</a>.</p>`;
    app.querySelector('#newsletter-signout')?.addEventListener('click', signOut);
    return;
  }

  app.innerHTML = `
    <section class="page-intro newsletter-intro" aria-labelledby="page-title">
      <p class="eyebrow"><span></span> Pack 44, Walpole</p><h1 id="page-title">Newsletters</h1><p>Approved Pack 44 updates and past issues.</p>
      <div class="newsletter-session"><span>${access.cubmaster ? 'Cubmaster' : 'Parent'} · ${escapeHtml(session.user.email)}</span><button class="auth-button" id="newsletter-signout" type="button">Sign out</button></div>
    </section>
    ${renderMessages()}
    ${access.cubmaster ? renderCubmasterTools() : ''}
    <section class="newsletter-archive" aria-labelledby="archive-heading">
      <div class="archive-heading"><div><p class="eyebrow">Parent archive</p><h2 id="archive-heading">Past issues</h2></div><span class="archive-count">${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}</span></div>
      ${issues.length ? `<div class="issue-list">${issues.map(renderIssue).join('')}</div>` : '<p class="archive-empty-state">No newsletters have been published yet.</p>'}
    </section>
    ${access.cubmaster ? renderMemberTools() : ''}`;

  app.querySelector('#newsletter-signout')?.addEventListener('click', signOut);
  app.querySelector('#parent-invite')?.addEventListener('submit', inviteParent);
  app.querySelector('#newsletter-upload')?.addEventListener('submit', uploadIssue);
  app.querySelectorAll('[data-issue-publish]').forEach((button) => button.addEventListener('click', toggleIssuePublished));
  app.querySelectorAll('[data-issue-download]').forEach((button) => button.addEventListener('click', createIssueLink));
  app.querySelectorAll('[data-parent-revoke]').forEach((button) => button.addEventListener('click', revokeParent));
}

async function requestSignInLink(event) {
  event.preventDefault();
  pageError = '';
  pageNotice = '';
  const email = new FormData(event.currentTarget).get('email').trim();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
  });
  pageError = error?.message || '';
  pageNotice = error ? '' : 'If this email has an account, Supabase will send a sign-in link.';
  render();
}

async function signOut() {
  await supabase.auth.signOut();
  session = null;
  access = { parent: false, cubmaster: false };
  issues = [];
  members = [];
  auditEntries = [];
  pageError = '';
  pageNotice = '';
  render();
}

async function loadData() {
  const [cubmasterResult, parentResult] = await Promise.all([
    supabase.rpc('is_newsletter_cubmaster'),
    supabase.rpc('is_newsletter_parent'),
  ]);
  if (cubmasterResult.error || parentResult.error) throw cubmasterResult.error || parentResult.error;
  access = { cubmaster: cubmasterResult.data === true, parent: parentResult.data === true };
  if (!access.parent) {
    render();
    return;
  }

  const { data: issueRows, error: issueError } = await supabase.from('newsletter_issues')
    .select('id,title,issue_date,storage_path,is_published,created_at')
    .order('issue_date', { ascending: false });
  if (issueError) throw issueError;
  issues = issueRows || [];

  if (access.cubmaster) {
    const [memberResult, auditResult] = await Promise.all([
      supabase.from('newsletter_members').select('user_id,email,role,status,approved_at').eq('role', 'parent').order('email'),
      supabase.from('newsletter_access_audit').select('subject_email,action,actor_user_id,created_at').order('created_at', { ascending: false }).limit(50),
    ]);
    if (memberResult.error || auditResult.error) throw memberResult.error || auditResult.error;
    members = memberResult.data || [];
    auditEntries = auditResult.data || [];
  }
  render();
}

async function inviteParent(event) {
  event.preventDefault();
  pageError = '';
  pageNotice = '';
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const email = new FormData(form).get('email').trim();
  const { data, error } = await supabase.functions.invoke('invite-newsletter-parent', { body: { email } });
  button.disabled = false;
  if (error) pageError = error.message || 'Could not approve this parent.';
  else pageNotice = data?.message || 'Parent access approved.';
  await loadData();
}

async function revokeParent(event) {
  const userId = event.currentTarget.dataset.parentRevoke;
  if (!window.confirm('Revoke this parent\'s newsletter access?')) return;
  pageError = '';
  pageNotice = '';
  const { data, error } = await supabase.rpc('revoke_newsletter_parent', { p_user_id: userId });
  if (error) pageError = error.message;
  else pageNotice = data ? 'Parent access revoked.' : 'Parent access was already inactive.';
  await loadData();
}

async function uploadIssue(event) {
  event.preventDefault();
  pageError = '';
  pageNotice = '';
  const form = event.currentTarget;
  const values = new FormData(form);
  const file = values.get('pdf');
  const title = values.get('title').trim();
  const issueDate = values.get('issueDate');
  if (!(file instanceof File) || file.type !== 'application/pdf' || file.size > 50 * 1024 * 1024) {
    pageError = 'Choose a PDF smaller than 50 MB.';
    render();
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const storagePath = `issues/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: 'application/pdf', upsert: false,
  });
  if (uploadError) {
    pageError = uploadError.message;
    await loadData();
    return;
  }

  const { error: issueError } = await supabase.from('newsletter_issues').insert({
    title, issue_date: issueDate, storage_path: storagePath, is_published: true, created_by: session.user.id,
  });
  if (issueError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    pageError = issueError.message;
    await loadData();
    return;
  }

  pageNotice = 'Newsletter PDF uploaded and published for approved parents.';
  await loadData();
}

async function toggleIssuePublished(event) {
  const issue = issues.find((item) => item.id === event.currentTarget.dataset.issuePublish);
  if (!issue) return;
  const publish = !issue.is_published;
  if (!publish && !window.confirm(`Unpublish “${issue.title}” from the parent archive?`)) return;
  pageError = '';
  pageNotice = '';
  const { error } = await supabase.from('newsletter_issues').update({ is_published: publish }).eq('id', issue.id);
  if (error) pageError = error.message;
  else pageNotice = publish ? 'Issue published.' : 'Issue unpublished for parents.';
  await loadData();
}

async function createIssueLink(event) {
  const button = event.currentTarget;
  const issue = issues.find((item) => item.id === button.dataset.issueDownload);
  if (!issue) return;
  button.disabled = true;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(issue.storage_path, SIGNED_URL_SECONDS);
  button.disabled = false;
  if (error) {
    pageError = error.message;
    render();
    return;
  }
  const link = document.createElement('a');
  link.className = 'small-button issue-download-link';
  link.href = data.signedUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open PDF (link expires in 5 minutes)';
  button.replaceWith(link);
}

async function initialize() {
  if (!supabase) return render();
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (session) {
    try { await loadData(); } catch (error) {
      pageError = error?.message || 'Could not load the private newsletter archive.';
      render();
    }
  } else {
    render();
  }

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    access = { parent: false, cubmaster: false };
    issues = [];
    members = [];
    auditEntries = [];
    if (session) {
      window.setTimeout(() => {
        loadData().catch((error) => {
          pageError = error?.message || 'Could not load the private newsletter archive.';
          render();
        });
      }, 0);
    } else {
      render();
    }
  });
}

render();
initialize();
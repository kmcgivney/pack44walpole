import './style.css';
import { supabase, supabaseConfigured } from './supabase.js';
import { loadPublicRoster, loadRemoteEvents } from './data.js';

const STORAGE_KEY = 'pack44-signups';

const fallbackEvents = [
  {
    id: 'fall-hike-2026',
    title: 'Pack 44 Fall Hike',
    date: 'Saturday, October 3, 2026',
    dateLabel: 'OCT 03',
    time: '9:00 AM - 12:00 PM',
    location: 'Adams Farm, Walpole, MA',
    description: 'A morning on the trail with our Pack 44 families. Bring water, a snack, and layers for changing weather.',
    type: 'RSVP',
    overnightDetails: false,
  },
  {
    id: 'fall-campout-2026',
    title: 'Pack 44 Campout',
    date: 'Saturday, October 24, 2026',
    dateLabel: 'OCT 24',
    time: 'Details coming soon',
    location: 'Jarvis Farm with Troop 44',
    description: 'A Pack 44 campout with our friends in Troop 44. More details about the schedule and what to bring will follow.',
    type: 'RSVP',
    overnightDetails: true,
  },
  {
    id: 'rockys-fundraiser-2026',
    title: 'Rocky\'s Ace Hardware Fundraiser',
    date: 'Saturday, October 10, 2026',
    dateLabel: 'OCT 10',
    time: 'Time slots coming soon',
    location: 'Rocky\'s Ace Hardware, Walpole, MA',
    description: 'Help Pack 44 raise money at Rocky\'s Ace Hardware. Families can choose one or more shifts, and each shift can welcome multiple families.',
    type: 'FUNDRAISER',
    signupType: 'time-slots',
    timeSlotFamilyLimit: 20,
    timeSlots: [
      { id: 'nine-to-ten', label: '9:00 AM - 10:00 AM', time: 'One-hour shift' },
      { id: 'ten-to-eleven', label: '10:00 AM - 11:00 AM', time: 'One-hour shift' },
      { id: 'eleven-to-twelve', label: '11:00 AM - 12:00 PM', time: 'One-hour shift' },
    ],
  },
];

let events = fallbackEvents;
let selectedEventId = events[0].id;
let remoteDataLoaded = false;
const tokenStorageKey = 'pack44-edit-tokens';

const sampleSignup = {
  id: 'kyle-test-signup',
  eventId: events[0].id,
  familyName: 'Test family',
  contactName: 'Test contact',
  email: 'test@example.com',
  scouts: 0,
  adults: 0,
  notes: 'Test signup',
};

let signups = loadSignups();
let editingSignupId = null;
let authSession = null;

function selectedEvent() {
  return events.find((item) => item.id === selectedEventId) || events[0];
}

function loadSignups() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return [sampleSignup];
}

function saveSignups() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signups));
}

function loadEditTokens() {
  try {
    return JSON.parse(localStorage.getItem(tokenStorageKey) || '{}');
  } catch {
    return {};
  }
}

function saveEditToken(signupId, token, email) {
  const tokens = loadEditTokens();
  tokens[signupId] = { token, email };
  localStorage.setItem(tokenStorageKey, JSON.stringify(tokens));
}

async function loadRemoteRoster(eventId) {
  const roster = await loadPublicRoster(eventId);
  return roster.map((signup) => ({
    id: signup.id,
    eventId: signup.event_id,
    familyName: signup.family_name,
    adults: signup.adults,
    scouts: signup.scouts,
    dayAdults: signup.day_adults,
    dayScouts: signup.day_scouts,
    overnightAdults: signup.overnight_adults,
    overnightScouts: signup.overnight_scouts,
    timeSlotIds: signup.slot_ids || [],
    email: loadEditTokens()[signup.id]?.email || '',
  }));
}

function totals(eventId) {
  return signups.filter((signup) => signup.eventId === eventId).reduce((result, signup) => ({
    families: result.families + 1,
    scouts: result.scouts + Number(signup.scouts || 0) + Number(signup.dayScouts || 0) + Number(signup.overnightScouts || 0),
    adults: result.adults + Number(signup.adults || 0) + Number(signup.dayAdults || 0) + Number(signup.overnightAdults || 0),
    overnightScouts: result.overnightScouts + Number(signup.overnightScouts || 0),
    overnightAdults: result.overnightAdults + Number(signup.overnightAdults || 0),
  }), { families: 0, scouts: 0, adults: 0, overnightScouts: 0, overnightAdults: 0 });
}

function slotSignupCount(slotId) {
  return signups.filter((signup) => signup.eventId === selectedEventId && (signup.timeSlotIds || []).includes(slotId)).length;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function render() {
  const event = selectedEvent();
  const summary = totals(event.id);
  const editing = signups.find((signup) => signup.id === editingSignupId);
  const root = document.querySelector('#app');

  root.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="/" aria-label="Pack 44 home">
          <span class="brand-mark">44</span>
          <span><strong>Pack 44</strong><small>Walpole, MA</small></span>
        </a>
        <div class="header-tools"><span class="header-note">Cub Scout families, together</span><div id="auth-status"></div></div>
      </div>
    </header>

    <main>
      <section class="hero section-inner">
        <div class="hero-copy">
          <p class="eyebrow"><span></span> Upcoming pack events</p>
          <h1>Make room for<br /><em>adventure.</em></h1>
          <p class="hero-text">Let us know which Pack 44 gathering your family will join.</p>
          <a class="text-link" href="#signup">RSVP below <span aria-hidden="true">↓</span></a>
        </div>
        <div class="hero-badge" aria-label="Pack 44 event badge">
          <span>${escapeHtml(event.dateLabel.split(' ')[0])}</span><strong>${escapeHtml(event.dateLabel.split(' ')[1])}</strong><small>2026</small>
        </div>
      </section>

      <section class="event-picker section-inner" aria-label="Choose an event">
        ${events.map((item) => `<button class="event-choice ${item.id === event.id ? 'selected' : ''}" data-event="${item.id}" type="button"><span>${escapeHtml(item.dateLabel)}</span><strong>${escapeHtml(item.title.replace('Pack 44 ', ''))}</strong><small>${escapeHtml(item.location)}</small></button>`).join('')}
      </section>

      <section class="event-layout section-inner" id="signup">
        <article class="event-card">
          <div class="event-image"><span class="trail-line"></span><span class="sun"></span><span class="ridge ridge-back"></span><span class="ridge ridge-front"></span><span class="badge">${escapeHtml(event.type)}</span></div>
          <div class="event-content">
            <p class="eyebrow orange">Pack 44 gathering</p>
            <h2>${escapeHtml(event.title)}</h2>
            <p class="event-description">${escapeHtml(event.description)}</p>
            <dl class="event-details">
              <div><dt>When</dt><dd>${escapeHtml(event.date)}<br />${escapeHtml(event.time)}</dd></div>
              <div><dt>Where</dt><dd>${escapeHtml(event.location)}</dd></div>
            </dl>
          </div>
        </article>

        <section class="signup-panel">
          <div class="panel-heading">
            <div><p class="eyebrow orange">Family RSVP</p><h2>${editing ? 'Update your RSVP' : 'Will you join us?'}</h2></div>
            <div class="attendance"><strong>${summary.families}</strong><span>families<br />coming</span></div>
          </div>
          <form id="signup-form">
            <label>Family name <input name="familyName" required value="${escapeHtml(editing?.familyName || '')}" placeholder="The Smith family" /></label>
            ${event.overnightDetails ? `
              <p class="form-section-label">Attendance plans</p>
              <div class="form-grid">
                <label>Day adults <input name="dayAdults" type="number" min="0" value="${editing?.dayAdults ?? ''}" required /></label>
                <label>Day scouts <input name="dayScouts" type="number" min="0" value="${editing?.dayScouts ?? ''}" required /></label>
                <label>Overnight adults <input name="overnightAdults" type="number" min="0" value="${editing?.overnightAdults ?? ''}" required /></label>
                <label>Overnight scouts <input name="overnightScouts" type="number" min="0" value="${editing?.overnightScouts ?? ''}" required /></label>
              </div>
              <p class="field-help">It is fine for some family members to stay overnight while others come just for the day.</p>
            ` : event.signupType === 'time-slots' ? `
              <p class="form-section-label">Choose one or more shifts</p>
              <div class="time-slot-list">
                ${event.timeSlots.map((slot) => `<label class="time-slot"><input type="checkbox" name="timeSlotIds" value="${escapeHtml(slot.id)}" ${editing?.timeSlotIds?.includes(slot.id) ? 'checked' : ''} /><span><strong>${escapeHtml(slot.label)}</strong><small>${escapeHtml(slot.time)} · ${slotSignupCount(slot.id)} of ${event.timeSlotFamilyLimit} families</small></span></label>`).join('')}
              </div>
              <p class="field-help">Each family may choose multiple shifts. Up to ${event.timeSlotFamilyLimit} families can claim each shift.</p>
            ` : ''}
            ${!event.overnightDetails ? `<div class="form-grid">
              <label>${event.signupType === 'time-slots' ? 'Adults helping' : 'Adults'} <input name="adults" type="number" min="0" value="${editing?.adults ?? ''}" required /></label>
              <label>${event.signupType === 'time-slots' ? 'Scouts helping' : 'Scouts'} <input name="scouts" type="number" min="0" value="${editing?.scouts ?? ''}" required /></label>
            </div>` : ''}
            <label>Email for RSVP updates <input name="email" type="email" required value="${escapeHtml(editing?.email || '')}" placeholder="you@example.com" /></label>
            <label>Note <span class="optional">optional</span><textarea name="notes" rows="2" placeholder="Anything we should know?">${escapeHtml(editing?.notes || '')}</textarea></label>
            <button class="button button-primary" type="submit">${editing ? 'Save changes' : 'Add our family'} <span aria-hidden="true">→</span></button>
            ${editing ? '<button class="button button-quiet" id="cancel-edit" type="button">Cancel editing</button>' : ''}
            <p class="privacy-note"><span aria-hidden="true">✦</span> Your email is only used for pack communications and is never shown publicly.</p>
          </form>
        </section>
      </section>

      <section class="roster section-inner">
        <div class="roster-heading"><div><p class="eyebrow">${event.overnightDetails ? 'The campout roster' : event.signupType === 'time-slots' ? 'The fundraiser roster' : 'The trail roster'}</p><h2>Who’s coming</h2></div><div class="total-pills"><span><b>${summary.scouts}</b> scouts</span><span><b>${summary.adults}</b> adults</span>${event.overnightDetails ? `<span><b>${summary.overnightScouts + summary.overnightAdults}</b> overnight</span>` : ''}</div></div>
        <div class="roster-list">${renderRoster()}</div>
      </section>
    </main>
    <footer class="site-footer"><div class="section-inner"><strong>Pack 44</strong><span>Walpole, Massachusetts</span><a href="mailto:walpole.pack44.cubmaster@gmail.com">walpole.pack44.cubmaster@gmail.com</a></div></footer>
  `;

  document.querySelector('#signup-form').addEventListener('submit', handleSubmit);
  document.querySelectorAll('[data-event]').forEach((button) => button.addEventListener('click', async () => {
    selectedEventId = button.dataset.event;
    editingSignupId = null;
    if (remoteDataLoaded) signups = await loadRemoteRoster(selectedEventId);
    render();
    document.querySelector('#signup').scrollIntoView({ behavior: 'smooth' });
  }));
  document.querySelector('#cancel-edit')?.addEventListener('click', () => { editingSignupId = null; render(); });
  document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => { editingSignupId = button.dataset.edit; render(); document.querySelector('#signup').scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => cancelSignup(button.dataset.cancel)));
  renderAuthStatus();
}

function renderAuthStatus() {
  const target = document.querySelector('#auth-status');
  if (!target) return;
  if (!supabaseConfigured) {
    target.innerHTML = '<span class="auth-note">Local preview</span>';
    return;
  }
  if (authSession?.user) {
    target.innerHTML = `<span class="auth-note">Cubmaster signed in</span><button class="auth-button" id="sign-out" type="button">Sign out</button>`;
    target.querySelector('#sign-out').addEventListener('click', async () => {
      await supabase.auth.signOut();
    });
    return;
  }
  target.innerHTML = '<button class="auth-button" id="sign-in" type="button">Cubmaster sign in</button>';
  target.querySelector('#sign-in').addEventListener('click', () => {
    target.innerHTML = `<form class="auth-form" id="auth-form"><input type="email" name="email" required placeholder="Cubmaster email" aria-label="Cubmaster email" /><button class="auth-button" type="submit">Email me a link</button></form>`;
    target.querySelector('#auth-form').addEventListener('submit', requestMagicLink);
  });
}

async function requestMagicLink(submitEvent) {
  submitEvent.preventDefault();
  const email = new FormData(submitEvent.target).get('email').trim();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  submitEvent.target.outerHTML = error
    ? `<span class="auth-error">${escapeHtml(error.message)}</span>`
    : '<span class="auth-note">Check your email for the sign-in link.</span>';
}

async function initializeAuth() {
  if (!supabase) {
    renderAuthStatus();
    return;
  }
  const { data } = await supabase.auth.getSession();
  authSession = data.session;
  renderAuthStatus();
  supabase.auth.onAuthStateChange((_event, session) => {
    authSession = session;
    renderAuthStatus();
  });
}

function renderRoster() {
  const eventSignups = signups.filter((signup) => signup.eventId === selectedEventId);
  if (!eventSignups.length) return '<div class="empty-state">No families yet. Be the first to RSVP.</div>';
  return eventSignups.map((signup) => `
    <article class="roster-row">
      <div class="avatar">${escapeHtml(signup.familyName.charAt(0).toUpperCase())}</div>
      <div class="roster-name"><strong>${escapeHtml(signup.familyName)}</strong><span>${rosterAttendance(signup)}</span></div>
      ${!remoteDataLoaded || loadEditTokens()[signup.id] ? `<div class="roster-actions"><button class="small-button" data-edit="${escapeHtml(signup.id)}">Edit</button><button class="small-button danger" data-cancel="${escapeHtml(signup.id)}">Cancel</button></div>` : ''}
    </article>
  `).join('');
}

async function handleSubmit(submitEvent) {
  submitEvent.preventDefault();
  const event = selectedEvent();
  const formData = new FormData(submitEvent.target);
  const timeSlotIds = formData.getAll('timeSlotIds');
  const signup = {
    id: editingSignupId || crypto.randomUUID(),
    eventId: event.id,
    familyName: formData.get('familyName').trim(),
    contactName: formData.get('familyName').trim(),
    email: formData.get('email').trim(),
    adults: Number(formData.get('adults') || 0),
    scouts: Number(formData.get('scouts') || 0),
    dayAdults: Number(formData.get('dayAdults') || 0),
    dayScouts: Number(formData.get('dayScouts') || 0),
    overnightAdults: Number(formData.get('overnightAdults') || 0),
    overnightScouts: Number(formData.get('overnightScouts') || 0),
    timeSlotIds,
    notes: formData.get('notes').trim(),
  };
  const attendeeCount = event.overnightDetails
    ? signup.dayAdults + signup.dayScouts + signup.overnightAdults + signup.overnightScouts
    : signup.adults + signup.scouts;
  if (attendeeCount === 0 || (event.signupType === 'time-slots' && timeSlotIds.length === 0)) {
    if (event.signupType === 'time-slots' && timeSlotIds.length === 0) {
      alert('Please choose at least one fundraiser shift.');
      return;
    }
    alert('Please enter at least one adult or scout.');
    return;
  }
  if (event.signupType === 'time-slots') {
    const fullSlot = event.timeSlots.find((slot) => timeSlotIds.includes(slot.id) && slotSignupCount(slot.id) - (editingSignupId && (signups.find((item) => item.id === editingSignupId)?.timeSlotIds || []).includes(slot.id) ? 1 : 0) >= event.timeSlotFamilyLimit);
    if (fullSlot) {
      alert(`${fullSlot.label} is full. Please choose another shift.`);
      return;
    }
  }
  if (remoteDataLoaded) {
    const tokenRecord = editingSignupId ? loadEditTokens()[editingSignupId] : null;
    const { data, error } = editingSignupId
      ? await supabase.rpc('update_family_signup', {
        p_edit_token: tokenRecord?.token,
        p_family_name: signup.familyName,
        p_email: signup.email,
        p_adults: signup.adults,
        p_scouts: signup.scouts,
        p_day_adults: signup.dayAdults,
        p_day_scouts: signup.dayScouts,
        p_overnight_adults: signup.overnightAdults,
        p_overnight_scouts: signup.overnightScouts,
        p_notes: signup.notes,
        p_slot_ids: signup.timeSlotIds,
      })
      : await supabase.rpc('create_family_signup', {
        p_event_id: signup.eventId,
        p_family_name: signup.familyName,
        p_email: signup.email,
        p_adults: signup.adults,
        p_scouts: signup.scouts,
        p_day_adults: signup.dayAdults,
        p_day_scouts: signup.dayScouts,
        p_overnight_adults: signup.overnightAdults,
        p_overnight_scouts: signup.overnightScouts,
        p_notes: signup.notes,
        p_slot_ids: signup.timeSlotIds,
      });
    if (error) {
      alert(error.message);
      return;
    }
    if (!editingSignupId && data?.signup_id && data?.edit_token) saveEditToken(data.signup_id, data.edit_token, signup.email);
    signups = await loadRemoteRoster(event.id);
    editingSignupId = null;
    render();
    document.querySelector('.roster').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (editingSignupId) {
    signups = signups.map((item) => item.id === editingSignupId ? signup : item);
  } else {
    signups.push(signup);
  }
  saveSignups();
  editingSignupId = null;
  render();
  document.querySelector('.roster').scrollIntoView({ behavior: 'smooth' });
}

function rosterAttendance(signup) {
  if (selectedEvent().signupType === 'time-slots') {
    const slotLabels = selectedEvent().timeSlots.filter((slot) => (signup.timeSlotIds || []).includes(slot.id)).map((slot) => slot.label);
    return `${slotLabels.join(' · ')} · ${Number(signup.scouts || 0)} scout${Number(signup.scouts || 0) === 1 ? '' : 's'} · ${Number(signup.adults || 0)} adult${Number(signup.adults || 0) === 1 ? '' : 's'}`;
  }
  if (selectedEvent().overnightDetails) {
    const dayCount = Number(signup.dayAdults || 0) + Number(signup.dayScouts || 0);
    const overnightCount = Number(signup.overnightAdults || 0) + Number(signup.overnightScouts || 0);
    return `${dayCount} day · ${overnightCount} overnight`;
  }
  return `${Number(signup.scouts || 0)} scout${Number(signup.scouts || 0) === 1 ? '' : 's'} · ${Number(signup.adults || 0)} adult${Number(signup.adults || 0) === 1 ? '' : 's'}`;
}

async function cancelSignup(id) {
  const signup = signups.find((item) => item.id === id);
  if (!signup || !window.confirm(`Remove ${signup.familyName} from this RSVP?`)) return;
  if (remoteDataLoaded) {
    const tokenRecord = loadEditTokens()[id];
    const { error } = await supabase.rpc('cancel_family_signup', { p_edit_token: tokenRecord?.token });
    if (error) {
      alert(error.message);
      return;
    }
    signups = await loadRemoteRoster(selectedEventId);
    render();
    return;
  }
  signups = signups.filter((item) => item.id !== id);
  saveSignups();
  render();
}

async function initializeRemoteData() {
  if (!supabase) return;
  try {
    const remoteEvents = await loadRemoteEvents();
    if (!remoteEvents?.length) return;
    events = remoteEvents;
    if (!events.some((event) => event.id === selectedEventId)) selectedEventId = events[0].id;
    signups = await loadRemoteRoster(selectedEventId);
    remoteDataLoaded = true;
    render();
  } catch (error) {
    console.error('Supabase data unavailable; keeping local preview.', error);
  }
}

render();
initializeAuth();
initializeRemoteData();

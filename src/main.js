import './style.css';

const STORAGE_KEY = 'pack44-signups';

const events = [
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

let selectedEventId = events[0].id;

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
        <span class="header-note">Cub Scout families, together</span>
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
  document.querySelectorAll('[data-event]').forEach((button) => button.addEventListener('click', () => { selectedEventId = button.dataset.event; editingSignupId = null; render(); document.querySelector('#signup').scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelector('#cancel-edit')?.addEventListener('click', () => { editingSignupId = null; render(); });
  document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => { editingSignupId = button.dataset.edit; render(); document.querySelector('#signup').scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', () => cancelSignup(button.dataset.cancel)));
}

function renderRoster() {
  const eventSignups = signups.filter((signup) => signup.eventId === selectedEventId);
  if (!eventSignups.length) return '<div class="empty-state">No families yet. Be the first to RSVP.</div>';
  return eventSignups.map((signup) => `
    <article class="roster-row">
      <div class="avatar">${escapeHtml(signup.familyName.charAt(0).toUpperCase())}</div>
      <div class="roster-name"><strong>${escapeHtml(signup.familyName)}</strong><span>${rosterAttendance(signup)}</span></div>
      <div class="roster-actions"><button class="small-button" data-edit="${escapeHtml(signup.id)}">Edit</button><button class="small-button danger" data-cancel="${escapeHtml(signup.id)}">Cancel</button></div>
    </article>
  `).join('');
}

function handleSubmit(submitEvent) {
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

function cancelSignup(id) {
  const signup = signups.find((item) => item.id === id);
  if (!signup || !window.confirm(`Remove ${signup.familyName} from this RSVP?`)) return;
  signups = signups.filter((item) => item.id !== id);
  saveSignups();
  render();
}

render();

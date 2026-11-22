import { parseIcs } from './ics.js';

const FEED_URL = 'https://api.scouting.org/advancements/events/calendar/46471';

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function localDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function slotText(slots = []) {
  return slots.map((slot) => `${slot.label}|${String(slot.start_time).slice(0, 5)}|${String(slot.end_time).slice(0, 5)}|${slot.family_limit}`).join('\n');
}

function parseSlots(text) {
  if (!text.trim()) return [];
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const [label, start, end, limit = '20'] = line.split('|').map((part) => part.trim());
    if (!label || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || !/^\d+$/.test(limit) || Number(limit) < 1) {
      throw new Error('Each shift must be Label|HH:MM|HH:MM|family limit (minimum 1).');
    }
    return { label, start_time: `${start}:00`, end_time: `${end}:00`, family_limit: Number(limit) };
  });
}

function formMarkup(event = null, signupCount = 0) {
  const slots = event?.event_slots || [];
  const canAdjustSignupSettings = !event || signupCount === 0;
  return `<form class="event-admin-form" id="managed-event-form">
    <h3>${event ? 'Edit event' : 'Create event'}</h3>
    ${event ? `<input type="hidden" name="id" value="${esc(event.id)}">` : ''}
    <div class="admin-form-grid">
      <label>Event title<input name="title" required maxlength="160" value="${esc(event?.title || '')}"></label>
      <label>Date<input name="event_date" type="date" required value="${esc(localDate(event?.event_date))}"></label>
      <label>End date <span class="optional">(optional, for multi-day events)</span><input name="end_date" type="date" value="${esc(localDate(event?.end_date))}"></label>
      <label>Start time<input name="start_time" type="time" value="${esc(event?.start_time?.slice(0, 5) || '')}"></label>
      <label>End time<input name="end_time" type="time" value="${esc(event?.end_time?.slice(0, 5) || '')}"></label>
      <label class="admin-checkbox"><input name="is_all_day" type="checkbox" value="true" ${event?.is_all_day ? 'checked' : ''}> All day</label>
      <label>Location<input name="location" required maxlength="240" value="${esc(event?.location || '')}"></label>
      <label>Signup type<select name="kind" ${canAdjustSignupSettings ? '' : 'disabled'}>
        <option value="rsvp" ${event?.kind === 'rsvp' ? 'selected' : ''}>RSVP</option>
        <option value="campout" ${event?.kind === 'campout' ? 'selected' : ''}>Campout</option>
        <option value="fundraiser" ${event?.kind === 'fundraiser' ? 'selected' : ''}>Fundraiser (time slots)</option>
      </select></label>
    </div>
    <label>Description<textarea name="description" rows="3" maxlength="4000">${esc(event?.description || '')}</textarea></label>
    <label>Fundraiser shifts <span class="optional">(one per line: Label|HH:MM|HH:MM|family limit)</span>
      <textarea name="slots" rows="4" placeholder="9:00–10:00 AM|09:00|10:00|20" ${canAdjustSignupSettings ? '' : 'disabled'}>${esc(slotText(slots))}</textarea>
    </label>
    ${event && !canAdjustSignupSettings ? '<p class="admin-help">This event has signup records. Signup type and shifts are locked to protect existing family choices.</p>' : ''}
    <p class="admin-form-error" role="alert" aria-live="assertive"></p>
    <button class="button button-primary" type="submit">${event ? 'Save event details' : 'Create event'}</button>
    ${event ? '<button class="button button-quiet" type="button" id="stop-editing-event">Cancel edit</button>' : ''}
  </form>`;
}

function importedFields(feedEvent) {
  return {
    title: feedEvent.title,
    event_date: feedEvent.date,
    end_date: feedEvent.endDate !== feedEvent.date ? feedEvent.endDate : null,
    start_time: feedEvent.startTime,
    end_time: feedEvent.endTime,
    is_all_day: feedEvent.allDay,
    location: feedEvent.location || 'Details to be confirmed',
    description: feedEvent.description || '',
  };
}

function displayTime(item) {
  if (item.allDay) return 'All day';
  return item.start_time
    ? `${String(item.start_time).slice(0, 5)}${item.end_time ? `–${String(item.end_time).slice(0, 5)}` : ''}`
    : 'Time not provided';
}

function displayDate(item) {
  return item.endDate && item.endDate !== item.date ? `${item.date} – ${item.endDate}` : item.date;
}

export async function renderEventAdmin(root, { supabase, onEventsChanged }) {
  root.innerHTML = `<section class="event-admin section-inner" aria-labelledby="event-admin-title">
    <div class="admin-heading"><div><p class="eyebrow orange">Cubmaster tools</p><h2 id="event-admin-title">Manage events</h2></div></div>
    <div class="admin-status" role="status" aria-live="polite"></div>
    <div class="admin-columns"><div class="admin-editor"></div>
      <div class="admin-import"><h3>Import scouting.org calendar</h3>
        <p>Feed: <a href="${FEED_URL}" target="_blank" rel="noreferrer">scouting.org event calendar</a>. Import suggestions are never saved until you review the preview and confirm.</p>
        <button type="button" class="button button-secondary" id="load-ics-preview">Load calendar preview</button>
        <div class="ics-preview" aria-live="polite"></div>
      </div>
    </div>
    <div class="managed-events"><h3>Current and archived events</h3><div class="managed-event-list">Loading events…</div></div>
  </section>`;

  const status = root.querySelector('.admin-status');
  const editor = root.querySelector('.admin-editor');
  const list = root.querySelector('.managed-event-list');
  const preview = root.querySelector('.ics-preview');
  let allEvents = [];
  let editingId = null;
  let feedEvents = [];

  const say = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('error', isError);
  };

  async function loadEvents() {
    const { data, error } = await supabase.from('events')
      .select('id,title,event_date,end_date,start_time,end_time,is_all_day,location,description,kind,is_archived,source_uid,event_slots(id,label,start_time,end_time,family_limit)')
      .order('event_date', { ascending: true });
    if (error) throw error;
    allEvents = data || [];
    await renderList();
  }

  async function renderList() {
    if (!allEvents.length) {
      list.innerHTML = '<p>No events have been created yet.</p>';
      return;
    }
    const rows = await Promise.all(allEvents.map(async (event) => {
      const { count, error } = await supabase.from('signups').select('id', { count: 'exact', head: true }).eq('event_id', event.id);
      if (error) throw error;
      return { event, count: count || 0 };
    }));
    list.innerHTML = rows.map(({ event, count }) => `<article class="managed-event">
      <div><strong>${esc(event.title)}</strong><span>${esc(localDate(event.event_date))}${event.end_date && event.end_date !== event.event_date ? ` – ${esc(localDate(event.end_date))}` : ''} · ${event.is_all_day ? 'All day' : displayTime(event)} · ${esc(event.location)} · ${event.is_archived ? 'Archived' : 'Active'}</span></div>
      <div class="managed-event-actions"><button type="button" class="small-button" data-edit-event="${esc(event.id)}">Edit</button>
      <button type="button" class="small-button ${event.is_archived ? '' : 'danger'}" data-toggle-archive="${esc(event.id)}" data-archived="${event.is_archived}">${event.is_archived ? 'Restore' : 'Archive'}</button></div>
      <span class="admin-help">${count} signup record${count === 1 ? '' : 's'}</span></article>`).join('');
    list.querySelectorAll('[data-edit-event]').forEach((button) => button.addEventListener('click', () => {
      const event = allEvents.find((item) => item.id === button.dataset.editEvent);
      editingId = event.id;
      getEventSignupCount(event.id).then((count) => {
        editor.innerHTML = formMarkup(event, count);
        bindForm(event, count);
        editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch((error) => say(error.message, true));
    }));
    list.querySelectorAll('[data-toggle-archive]').forEach((button) => button.addEventListener('click', async () => {
      const event = allEvents.find((item) => item.id === button.dataset.toggleArchive);
      const archive = button.dataset.archived === 'false';
      const choice = archive ? 'archive' : 'restore';
      if (!window.confirm(`${archive ? 'Archive' : 'Restore'} “${event.title}”? ${archive ? 'Its signups will be preserved and families will no longer be able to submit new RSVPs.' : 'It will become publicly visible and available for signup.'}`)) return;
      const { error } = await supabase.from('events').update({ is_archived: archive }).eq('id', event.id);
      if (error) return say(error.message, true);
      say(`Event ${choice}d.`);
      await afterChange();
    }));
  }

  async function getEventSignupCount(eventId) {
    const { count, error } = await supabase.from('signups').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
    if (error) throw error;
    return count || 0;
  }

  function bindForm(event, signupCount) {
    editor.querySelector('#stop-editing-event')?.addEventListener('click', () => {
      editingId = null;
      editor.innerHTML = formMarkup();
      bindForm(null, 0);
    });
    editor.querySelector('#managed-event-form').addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      const form = submitEvent.currentTarget;
      const submitButton = form.querySelector('button[type="submit"]');
      const feedback = form.querySelector('.admin-form-error');
      submitButton.disabled = true;
      submitButton.textContent = event ? 'Saving…' : 'Creating…';
      feedback.textContent = '';
      try {
        const values = Object.fromEntries(new FormData(submitEvent.currentTarget));
        if (values.end_date && values.end_date < values.event_date) throw new Error('End date must be on or after the event date.');
        const canAdjustSignupSettings = !event || signupCount === 0;
        const kind = canAdjustSignupSettings ? values.kind : event.kind;
        const slots = canAdjustSignupSettings ? parseSlots(values.slots || '') : (event.event_slots || []);
        if (kind === 'fundraiser' && slots.length === 0) throw new Error('A fundraiser needs at least one shift.');
        const allDay = Boolean(values.is_all_day);
        if (!allDay && values.start_time && values.end_time && values.end_time <= values.start_time && (!values.end_date || values.end_date === values.event_date)) throw new Error('End time must be later than start time for a single-day event.');
        const record = {
          title: values.title.trim(), event_date: values.event_date, end_date: values.end_date || null,
          start_time: allDay ? null : (values.start_time || null), end_time: allDay ? null : (values.end_time || null),
          is_all_day: allDay, location: values.location.trim(), description: values.description.trim(), kind,
        };
        if (event) {
          const { error } = await supabase.from('events').update(record).eq('id', event.id);
          if (error) throw error;
          if (canAdjustSignupSettings) {
            const { error: deleteError } = await supabase.from('event_slots').delete().eq('event_id', event.id);
            if (deleteError) throw deleteError;
            if (slots.length) {
              const { error: slotError } = await supabase.from('event_slots').insert(slots.map((slot) => ({ ...slot, event_id: event.id })));
              if (slotError) throw slotError;
            }
          }
          say('Event updated. Existing family signups were preserved.');
        } else {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData.user) throw new Error('Cubmaster session expired. Sign in again.');
          const { data, error } = await supabase.from('events').insert({ ...record, created_by: userData.user.id }).select('id').single();
          if (error) throw error;
          if (slots.length) {
            const { error: slotError } = await supabase.from('event_slots').insert(slots.map((slot) => ({ ...slot, event_id: data.id })));
            if (slotError) throw slotError;
          }
          say('Event created.');
        }
        editingId = null;
        editor.innerHTML = formMarkup();
        bindForm(null, 0);
        await afterChange();
      } catch (error) {
        const message = error.message || 'Could not save event.';
        feedback.textContent = message;
        say(message, true);
      } finally {
        if (form.isConnected) {
          submitButton.disabled = false;
          submitButton.textContent = event ? 'Save event details' : 'Create event';
        }
      }
    });
  }

  async function afterChange() {
    await loadEvents();
    await onEventsChanged();
  }

  function renderPreview() {
    const eventByUid = new Map(allEvents.filter((event) => event.source_uid).map((event) => [event.source_uid, event]));
    preview.innerHTML = `<div class="ics-review-note">Review every proposed change. New imported events are created archived. Existing event type, signup slots, archive state, and family choices are never changed by the importer. Canceled feed items are never applied automatically.</div>
      <div class="ics-review-list">${feedEvents.map((item, index) => {
        const match = eventByUid.get(item.uid);
        const canceled = item.status === 'CANCELLED';
        const proposed = importedFields(item);
        const diff = match ? ['title', 'event_date', 'end_date', 'start_time', 'end_time', 'is_all_day', 'location', 'description']
          .filter((key) => String(match[key] ?? '') !== String(proposed[key] ?? '')) : [];
        return `<article class="ics-review-row">
          <label class="ics-choice"><input type="checkbox" data-apply-ics="${index}" ${canceled ? 'disabled' : ''}>
            <span><strong>${esc(item.title)}</strong><small>${esc(displayDate(item))} · ${esc(item.time)} · ${esc(item.location || 'Location not listed')}</small></span>
          </label>
          <span class="ics-match">${canceled ? 'Canceled in source — no automatic action' : match ? `Matched by stable UID: ${diff.length ? `review ${diff.length} proposed field change${diff.length === 1 ? '' : 's'}` : 'no field changes'}` : 'New event — will be created archived'}</span>
          ${match && canceled ? `<label class="ics-cancel-choice"><input type="checkbox" data-archive-ics="${index}"> I reviewed this cancellation and want to archive “${esc(match.title)}”.</label>` : ''}
          ${match && !canceled && diff.length ? `<details><summary>Review field changes</summary><ul>${diff.map((key) => `<li><strong>${esc(key.replace('_', ' '))}:</strong> “${esc(match[key] ?? '—')}” → “${esc(proposed[key] ?? '—')}”</li>`).join('')}</ul></details>` : ''}
        </article>`;
      }).join('')}</div>
      <button type="button" class="button button-primary" id="apply-ics-preview">Apply selected reviewed actions</button>`;
    preview.querySelector('#apply-ics-preview').addEventListener('click', applyPreview);
  }

  async function applyPreview() {
    const selected = [...preview.querySelectorAll('[data-apply-ics]:checked')].map((checkbox) => feedEvents[Number(checkbox.dataset.applyIcs)]);
    const archives = [...preview.querySelectorAll('[data-archive-ics]:checked')].map((checkbox) => feedEvents[Number(checkbox.dataset.archiveIcs)]);
    if (!selected.length && !archives.length) return say('Select at least one reviewed event action.', true);
    const confirmText = `Apply ${selected.length} selected calendar import/update action${selected.length === 1 ? '' : 's'}${archives.length ? ` and archive ${archives.length} reviewed canceled event${archives.length === 1 ? '' : 's'}` : ''}? New imports will remain archived.`;
    if (!window.confirm(confirmText)) return;
    try {
      for (const item of selected) {
        const existing = allEvents.find((event) => event.source_uid === item.uid);
        const fields = importedFields(item);
        if (existing) {
          const { error } = await supabase.from('events').update(fields).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData.user) throw new Error('Cubmaster session expired. Sign in again.');
          const { error } = await supabase.from('events').insert({
            ...fields, source_uid: item.uid, is_archived: true, kind: 'rsvp', created_by: userData.user.id,
          });
          if (error) throw error;
        }
      }
      for (const item of archives) {
        const existing = allEvents.find((event) => event.source_uid === item.uid);
        if (!existing || existing.is_archived) continue;
        const { error } = await supabase.from('events').update({ is_archived: true }).eq('id', existing.id);
        if (error) throw error;
      }
      say('Reviewed calendar actions applied. Imported events remain archived until you deliberately restore them.');
      await afterChange();
      await renderPreview();
    } catch (error) {
      say(error.message || 'Could not apply calendar actions.', true);
      await loadEvents();
    }
  }

  editor.innerHTML = formMarkup();
  bindForm(null, 0);
  root.querySelector('#load-ics-preview').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    preview.textContent = 'Fetching scouting.org calendar…';
    try {
      const { data, error } = await supabase.functions.invoke('scouting-calendar');
      if (error) throw error;
      const calendarText = typeof data === 'string' ? data : data?.ics;
      if (!calendarText) throw new Error('Calendar proxy returned an empty response.');
      feedEvents = parseIcs(calendarText);
      if (!feedEvents.length) throw new Error('No valid events were found in the ICS feed.');
      renderPreview();
      say(`Loaded ${feedEvents.length} calendar item${feedEvents.length === 1 ? '' : 's'} for review.`);
    } catch (error) {
      preview.textContent = 'Calendar preview could not be loaded.';
      say(error.message || 'Calendar preview could not be loaded.', true);
    } finally {
      button.disabled = false;
    }
  });

  try {
    await loadEvents();
  } catch (error) {
    list.textContent = 'Could not load management events. Confirm the database migration and Cubmaster permissions are installed.';
    say(error.message || 'Could not load event management data.', true);
  }
}

import { supabase } from './supabase.js';

function formatDateLabel(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(date).toUpperCase();
}

function formatTime(startTime, endTime) {
  if (!startTime || !endTime) return 'Details coming soon';
  const format = (value) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(`1970-01-01T${value}`));
  return `${format(startTime)} - ${format(endTime)}`;
}

export async function loadRemoteEvents() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_active_events');
  if (error) throw error;
  return (data || []).map((event) => ({
    id: event.id,
    title: event.title,
    date: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${event.event_date}T12:00:00`)),
    dateLabel: formatDateLabel(event.event_date),
    time: formatTime(event.start_time, event.end_time),
    location: event.location,
    description: event.description,
    type: event.kind === 'fundraiser' ? 'FUNDRAISER' : 'RSVP',
    signupType: event.kind === 'fundraiser' ? 'time-slots' : undefined,
    overnightDetails: event.kind === 'campout',
    timeSlotFamilyLimit: event.kind === 'fundraiser' ? 20 : undefined,
    timeSlots: (event.event_slots || []).map((slot) => ({
      id: slot.id,
      label: slot.label,
      time: formatTime(slot.start_time, slot.end_time),
      familyLimit: slot.family_limit,
    })),
  }));
}

export async function loadPublicRoster(eventId) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_public_roster', { p_event_id: eventId });
  if (error) throw error;
  return data;
}

export async function loadPublicSummary(eventId) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_public_event_summary', { p_event_id: eventId });
  if (error) throw error;
  const summary = typeof data === 'string' ? JSON.parse(data) : data;
  return {
    families: Number(summary?.families || 0),
    scouts: Number(summary?.scouts || 0),
    adults: Number(summary?.adults || 0),
    overnight: Number(summary?.overnight || 0),
    overnightScouts: 0,
    overnightAdults: 0,
    slots: Array.isArray(summary?.slots) ? summary.slots : [],
  };
}

export async function loadFamilySignup(editToken) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_family_signup', { p_edit_token: editToken });
  if (error) throw error;
  return data?.[0] || null;
}

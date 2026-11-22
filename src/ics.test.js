import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs } from './ics.js';

test('parses folded content lines and ICS-escaped text', () => {
  const [event] = parseIcs([
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:scout-1',
    'SUMMARY:Pack 44\\, fall',
    'DESCRIPTION:Bring water\\nWear layers\\; bring a map\\\\n literal',
    'LOCATION:Adams Farm\\, Walpole',
    'DTSTART;TZID=America/New_York:20261003T090000',
    'DTEND;TZID=America/New_York:20261003T103000',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n'));
  assert.equal(event.title, 'Pack 44, fall');
  assert.equal(event.description, 'Bring water\nWear layers; bring a map\\n literal');
  assert.equal(event.location, 'Adams Farm, Walpole');
  assert.equal(event.date, '2026-10-03');
  assert.equal(event.startTime, '09:00:00');
  assert.equal(event.endTime, '10:30:00');
});

test('converts UTC dates and times to the pack timezone', () => {
  const [event] = parseIcs('BEGIN:VEVENT\nUID:utc-1\nDTSTART:20261122T150000Z\nDTEND:20261122T163000Z\nEND:VEVENT');
  assert.equal(event.date, '2026-11-22');
  assert.equal(event.startTime, '10:00:00');
  assert.equal(event.endTime, '11:30:00');
});

test('parses all-day and canceled events without treating cancellation as an automatic action', () => {
  const [event] = parseIcs('BEGIN:VEVENT\nUID:cancel-1\nSTATUS:CANCELLED\nDTSTART;VALUE=DATE:20261205\nDTEND;VALUE=DATE:20261206\nEND:VEVENT');
  assert.equal(event.date, '2026-12-05');
  assert.equal(event.endDate, '2026-12-05');
  assert.equal(event.allDay, true);
  assert.equal(event.status, 'CANCELLED');
  assert.equal(event.time, 'All day');
});

test('handles DST offsets for America/New_York', () => {
  const [event] = parseIcs('BEGIN:VEVENT\nUID:dst-1\nDTSTART;TZID=America/New_York:20261101T013000\nEND:VEVENT');
  assert.equal(event.date, '2026-11-01');
  assert.equal(event.startTime, '01:30:00');
});

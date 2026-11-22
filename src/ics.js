const PACK_TIME_ZONE = 'America/New_York';

function splitContentLine(line) {
  let quoted = false;
  let separator = -1;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (line[index] === ':' && !quoted) {
      separator = index;
      break;
    }
  }
  if (separator < 0) return null;

  const [name, ...rawParams] = line.slice(0, separator).split(';');
  const params = {};
  for (const rawParam of rawParams) {
    const equals = rawParam.indexOf('=');
    if (equals > 0) params[rawParam.slice(0, equals).toUpperCase()] = rawParam.slice(equals + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(separator + 1) };
}

function unescapeText(value = '') {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\' || index + 1 >= value.length) {
      result += value[index];
      continue;
    }
    const escaped = value[++index];
    if (escaped === 'n' || escaped === 'N') result += '\n';
    else if ('\\,;'.includes(escaped)) result += escaped;
    else result += `\\${escaped}`;
  }
  return result;
}

function localDateTimeToUtc(parts, timeZone) {
  const [year, month, day, hour = 0, minute = 0, second = 0] = parts.map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = wanted;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actualParts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(actualParts.year, actualParts.month - 1, actualParts.day, actualParts.hour, actualParts.minute, actualParts.second);
    const difference = wanted - represented;
    if (!difference) break;
    candidate += difference;
  }
  return new Date(candidate);
}

function formatLocalDateTime(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACK_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:00`,
  };
}

function parseDateProperty(property) {
  if (!property) return null;
  const value = property.value;
  if (property.params.VALUE?.toUpperCase() === 'DATE' || /^\d{8}$/.test(value)) {
    return { date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, time: null, allDay: true };
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00', utc] = match;
  const date = utc
    ? new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)))
    : localDateTimeToUtc([year, month, day, hour, minute, second], property.params.TZID || PACK_TIME_ZONE);
  return { ...formatLocalDateTime(date), allDay: false };
}

function unfoldLines(input) {
  const physicalLines = String(input).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const logicalLines = [];
  for (const line of physicalLines) {
    if (/^[ \t]/.test(line) && logicalLines.length) logicalLines[logicalLines.length - 1] += line.slice(1);
    else logicalLines.push(line);
  }
  return logicalLines;
}

export function parseIcs(input) {
  const events = [];
  let current = null;
  for (const line of unfoldLines(input)) {
    const property = splitContentLine(line);
    if (!property) continue;
    if (property.name === 'BEGIN' && property.value.toUpperCase() === 'VEVENT') {
      current = {};
      continue;
    }
    if (property.name === 'END' && property.value.toUpperCase() === 'VEVENT') {
      if (current?.uid) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    if (['UID', 'SUMMARY', 'DESCRIPTION', 'LOCATION', 'STATUS'].includes(property.name)) {
      current[property.name.toLowerCase()] = unescapeText(property.value);
    } else if (property.name === 'DTSTART' || property.name === 'DTEND') {
      current[property.name.toLowerCase()] = parseDateProperty(property);
    }
  }

  const uniqueEvents = [...new Map(events.map((event) => [event.uid.trim(), event])).values()];
  return uniqueEvents.map((event) => {
    const start = event.dtstart;
    const end = event.dtend;
    const startDate = start?.date || '';
    let endDate = end?.date || startDate;
    // RFC 5545 DATE-valued DTEND is non-inclusive.
    if (start?.allDay && end?.allDay) {
      const exclusiveEnd = new Date(`${endDate}T00:00:00Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() - 1);
      endDate = exclusiveEnd.toISOString().slice(0, 10);
      if (endDate < startDate) endDate = startDate;
    }
    const sameDay = startDate === endDate;
    const time = start?.allDay || !start?.time
      ? 'All day'
      : `${start.time.slice(0, 5)}${end?.time && sameDay ? ` - ${end.time.slice(0, 5)}` : ''}`;
    return {
      uid: event.uid.trim(),
      title: (event.summary || 'Scouting event').trim(),
      date: startDate,
      endDate,
      time,
      startTime: start?.time || null,
      endTime: end?.time && sameDay ? end.time : null,
      allDay: Boolean(start?.allDay),
      location: (event.location || '').trim(),
      description: (event.description || '').trim(),
      status: (event.status || 'CONFIRMED').toUpperCase(),
    };
  }).filter((event) => event.uid && /^\d{4}-\d{2}-\d{2}$/.test(event.date));
}

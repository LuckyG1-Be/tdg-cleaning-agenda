import { RRule, rrulestr } from "rrule";

export type Occurrence = {
  start: Date;
  end: Date;
  dateKey: string; // YYYY-MM-DD in timezone (assumed Europe/Brussels)
};

function pad2(n: number) { return String(n).padStart(2, "0"); }

export function dateKeyLocal(d: Date) {
  // We store dates as Date (UTC in DB), but treat them as local-date markers.
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${y}-${m}-${dd}`;
}

export function parseHHMM(t: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) throw new Error("Invalid time");
  return { h: Number(m[1]), min: Number(m[2]) };
}

export function toLocalDateTime(date: Date, hhmm: string) {
  const { h, min } = parseHHMM(hhmm);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, min, 0, 0);
}

export function buildRRule(rrule: string, dtstart: Date) {
  // rrulestr can parse RRULE:... or full string
  const rule = rrulestr(rrule.includes("RRULE") ? rrule : `RRULE:${rrule}`, { dtstart });
  if (!(rule instanceof RRule)) throw new Error("Invalid RRULE");
  return rule;
}

export function occurrencesBetween(params: {
  startDate: Date; // first occurrence local date
  startTime: string;
  endTime: string;
  rrule: string | null;
  untilDate: Date | null;
  rangeStart: Date;
  rangeEnd: Date;
}) : Occurrence[] {
  const { startDate, startTime, endTime, rrule, untilDate, rangeStart, rangeEnd } = params;

  // single appointment
  if (!rrule) {
    const s = toLocalDateTime(startDate, startTime);
    const e = toLocalDateTime(startDate, endTime);
    if (e <= rangeStart || s >= rangeEnd) return [];
    return [{ start: s, end: e, dateKey: dateKeyLocal(startDate) }];
  }

  const dtstart = toLocalDateTime(startDate, startTime);
  const rule = buildRRule(rrule, dtstart);

  // Apply UNTIL manually if provided (inclusive local date)
  const effectiveEnd = untilDate ? new Date(untilDate.getFullYear(), untilDate.getMonth(), untilDate.getDate(), 23, 59, 59, 999) : null;

  const between = rule.between(rangeStart, rangeEnd, true);

  const out: Occurrence[] = [];
  for (const occ of between) {
    if (effectiveEnd && occ > effectiveEnd) continue;
    const baseDate = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate());
    const s = toLocalDateTime(baseDate, startTime);
    const e = toLocalDateTime(baseDate, endTime);
    out.push({ start: s, end: e, dateKey: dateKeyLocal(baseDate) });
  }
  return out;
}

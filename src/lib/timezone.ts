// An interview's "Date & Time" is a <input type="datetime-local"> value — a
// wall-clock time with no offset ("2026-10-02T10:00") — meant to be read in
// the interview's own Timezone field. `new Date(value)` on the server would
// instead read it in the server's zone (UTC on Vercel), so 10:00 entered for
// America/New_York got stored as 10:00 UTC and displayed back as 6:00 AM.

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function wallClockParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Milliseconds `timeZone` is ahead of UTC at the given instant.
function offsetMs(date: Date, timeZone: string): number {
  const p = wallClockParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-02T10:00" read as wall-clock time in `timeZone` → the real instant.
 *  Returns null for an unparseable value. */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const naiveUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  if (Number.isNaN(naiveUtc)) return null;
  // Two passes so a time on the far side of a DST transition from the naive
  // guess still picks up the right offset.
  let result = naiveUtc - offsetMs(new Date(naiveUtc), timeZone);
  result = naiveUtc - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** The inverse: an instant → "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone`,
 *  for pre-filling a datetime-local input. */
export function utcToZonedLocal(date: Date, timeZone: string): string {
  const p = wallClockParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

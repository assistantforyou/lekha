/**
 * Derive the default task check-in time from the evening-summary time.
 * Check-in fires 30 minutes before the evening summary.
 */
export function deriveCheckInTime(eveningTime: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(eveningTime);
  if (!m) return "20:30";
  let hh = parseInt(m[1]!, 10);
  let mm = parseInt(m[2]!, 10);
  mm -= 30;
  if (mm < 0) {
    mm += 60;
    hh -= 1;
  }
  if (hh < 0) hh += 24;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

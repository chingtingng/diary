/** Noon local time so the calendar day survives UTC conversion. */
export function atLocalNoon(date: Date): Date {
  const next = new Date(date)
  next.setHours(12, 0, 0, 0)
  return next
}

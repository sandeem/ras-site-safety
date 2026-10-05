// Dates are stored as 'YYYY-MM-DD' strings (the Postgres `date` type).
// Strings in that format sort correctly, so '2026-10-03' < '2026-10-04' works.

// The date n days from today, in the browser's local time zone.
export function localDateString(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function todayLocal() {
  return localDateString(0)
}

// '2026-10-04' -> 'Sun, Oct 4, 2026'
// (Built from parts so the browser doesn't shift it by the time zone.)
export function formatDate(ymd) {
  if (!ymd) return ''
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ISO timestamp -> 'Oct 4, 7:24 a.m.'
export function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Shared style tokens.
export const ACCENT_DEFAULT = '#D9FF00'

export const c = {
  faint: 'rgba(255,255,255,0.4)',
  faint45: 'rgba(255,255,255,0.45)',
  hair: 'rgba(255,255,255,0.06)',
  hair7: 'rgba(255,255,255,0.07)',
  hair9: 'rgba(255,255,255,0.09)',
  bebas: "'Bebas Neue', sans-serif",
}

export const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
export const MONTHS = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC']

// Monday-indexed weekday (0 = Mon … 6 = Sun)
export function todayWeekday(d = new Date()) {
  return (d.getDay() + 6) % 7
}

// Local YYYY-MM-DD
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dateLabel(d = new Date()) {
  return `${WEEKDAYS[todayWeekday(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

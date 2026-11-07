import type { Limit } from '../types'

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'wk', spend_limit: '$' }
const ORDER = ['five_hour', 'seven_day']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const label = (kind: string) => LABELS[kind] ?? kind.replace(/_/g, ' ')

const rank = (kind: string) => {
  const i = ORDER.indexOf(kind)
  return i === -1 ? ORDER.length : i
}

// Keeps only what the meters draw, in a fixed order; anything malformed (an old stored value) is dropped.
export const toLimits = (raw: unknown): Limit[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (l): l is Limit =>
        typeof l === 'object' && l !== null && typeof l.kind === 'string' && typeof l.percentUsed === 'number',
    )
    .map(({ kind, percentUsed, resetsAt }) => ({
      kind,
      percentUsed,
      ...(typeof resetsAt === 'string' ? { resetsAt } : {}),
    }))
    .sort((a, b) => rank(a.kind) - rank(b.kind))
}

export const hasReset = (l: Limit, now: number) => {
  const at = l.resetsAt ? Date.parse(l.resetsAt) : NaN
  return !Number.isNaN(at) && at <= now
}

// Under a day: a countdown ("2h 13m"); further out: the local weekday and time ("Thu 9am").
export const formatReset = (resetsAt: string | undefined, now: number) => {
  const at = resetsAt ? Date.parse(resetsAt) : NaN
  if (Number.isNaN(at)) return ''
  const mins = Math.ceil((at - now) / 60_000)
  if (mins <= 0) return 'reset'
  if (mins < 60) return `${mins}m`
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`

  const d = new Date(at)
  const h = d.getHours()
  const m = d.getMinutes()
  const clock = `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
  return `${DAYS[d.getDay()]} ${clock}`
}

export const meter = (percent: number, width: number) => {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return { filled, empty: width - filled }
}

export const tone = (percent: number) => (percent >= 80 ? 'red' : percent >= 50 ? 'yellow' : 'green')

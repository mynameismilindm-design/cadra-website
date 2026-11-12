import { validatePlan } from './runner-performance-plan.js'

const DAY = 86_400_000
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dateStamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(`${value}T12:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null
}

export function addDays(value, days) {
  const stamp = dateStamp(value)
  return stamp == null ? null : new Date(stamp + days * DAY).toISOString().slice(0, 10)
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function createTrainingCalendar(input) {
  const start = dateStamp(input?.startDate), event = dateStamp(input?.eventDate)
  if (start == null || event == null) return { error: 'Choose valid start and event dates.' }
  const daysUntil = Math.round((event - start) / DAY)
  if (daysUntil < 28 || daysUntil > 112) return { error: 'Choose an event 4–16 weeks after the plan starts.' }
  const distanceKm = Number(input.distanceKm), current5kMinutes = Number(input.current5kMinutes)
  const goalMinutes = Number(input.goalMinutes), weeklyMinutes = Number(input.weeklyMinutes)
  if (![5, 10, 21.1].includes(distanceKm)) return { error: 'Choose a 5 km, 10 km or half-marathon goal.' }
  if (!Number.isFinite(current5kMinutes) || current5kMinutes < 15 || current5kMinutes > 90) return { error: 'Enter a recent 5 km time between 15 and 90 minutes.' }
  if (!Number.isFinite(goalMinutes) || goalMinutes < distanceKm * 3 || goalMinutes > distanceKm * 18) return { error: 'Check your target finish time: use a pace between 3 and 18 minutes per km.' }
  if (!Number.isFinite(weeklyMinutes) || weeklyMinutes < 45 || weeklyMinutes > 300) return { error: 'Choose 45–300 training minutes per week.' }
  const availableDays = [...new Set(Array.isArray(input.availableDays) ? input.availableDays : [])].sort((a, b) => a - b)
  if (availableDays.length < 2 || availableDays.length > 5 || availableDays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) return { error: 'Choose 2–5 running days each week, leaving room for rest.' }
  if (weeklyMinutes < availableDays.length * 10) return { error: 'Allow at least 10 minutes per selected running day, or choose fewer days.' }
  const buildPercent = Number(input.buildPercent ?? 0)
  if (![0, 2, 5].includes(buildPercent)) return { error: 'Choose a weekly duration change of 0%, 2% or 5%.' }
  const settings = { startDate: input.startDate, eventDate: input.eventDate, distanceKm, current5kMinutes, goalMinutes, weeklyMinutes, availableDays, buildPercent }
  const weeks = Math.ceil(daysUntil / 7)
  const sessions = []
  for (let week = 0; week < weeks; week++) {
    const firstDay = addDays(input.startDate, week * 7)
    const dates = Array.from({ length: 7 }, (_, i) => addDays(firstDay, i)).filter(date => date < input.eventDate && availableDays.includes(new Date(dateStamp(date)).getUTCDay()))
    const daysLeft = Math.round((event - dateStamp(firstDay)) / DAY)
    // User-selected progression, capped at 25% over the starting duration.
    // A lighter fourth week and taper are visible in the generated calendar.
    let multiplier = Math.min(1.25, (1 + buildPercent / 100) ** week)
    if ((week + 1) % 4 === 0) multiplier *= .8
    if (daysLeft <= 7) multiplier = .5
    else if (daysLeft <= 14) multiplier *= .75
    const weeklyBudget = Math.round(weeklyMinutes * multiplier)
    const fullWeekCount = availableDays.length
    const baseMinutes = Math.max(10, Math.min(90, Math.floor(weeklyBudget / fullWeekCount)))
    dates.forEach((date, index) => {
      const isLast = index === dates.length - 1
      const isEventWeek = Math.round((event - dateStamp(date)) / DAY) <= 7
      const minutes = isEventWeek ? Math.min(30, baseMinutes) : baseMinutes
      const kind = isEventWeek ? 'recovery' : 'easy'
      const workout = { version: 1, type: kind, values: { duration: minutes, ...(kind === 'easy' ? { fast: '', slow: '' } : {}) } }
      sessions.push({ id: `session-${date}`, date, originalDate: date, kind, title: isEventWeek ? 'Easy taper session' : isLast ? 'Steady weekly run' : 'Easy run', workout, status: 'planned', week: week + 1 })
    })
  }
  sessions.push({ id: `event-${input.eventDate}`, date: input.eventDate, originalDate: input.eventDate, kind: 'event', title: `${distanceKm} km goal run`, workout: { version: 1, type: 'long', values: { distance: distanceKm, reminder: 0 } }, status: 'planned', week: weeks + 1 })
  return { plan: { version: 1, title: `${distanceKm} km · ${goalMinutes} min goal`, settings, sessions } }
}

export function sessionMinutes(session) {
  const workout = validatePlan(session?.workout)
  return workout?.totalSeconds == null ? null : workout.totalSeconds / 60
}

export function moveTrainingSession(plan, sessionId, nextDate, today = localDateKey()) {
  const session = plan?.sessions?.find(s => s.id === sessionId)
  if (!session || session.status !== 'planned' || session.kind === 'event') return { error: 'Only an unfinished training session can be moved.' }
  if (dateStamp(nextDate) == null || nextDate < today || nextDate < plan.settings.startDate || nextDate >= plan.settings.eventDate) return { error: 'Choose today or a later date before your event.' }
  if (!plan.settings.availableDays.includes(new Date(dateStamp(nextDate)).getUTCDay())) return { error: 'Choose one of your selected running days.' }
  if (plan.sessions.some(s => s.id !== sessionId && s.date === nextDate && s.status !== 'skipped')) return { error: 'You already have a session that day. Keep one session per day.' }
  return { plan: { ...plan, sessions: plan.sessions.map(s => s.id === sessionId ? { ...s, date: nextDate } : s).sort((a, b) => a.date.localeCompare(b.date)) } }
}

export function setTrainingSessionStatus(plan, sessionId, status) {
  if (!['planned', 'completed', 'skipped'].includes(status) || !plan?.sessions?.some(s => s.id === sessionId)) return { error: 'Choose a valid session and status.' }
  const session = plan.sessions.find(s => s.id === sessionId)
  if (status !== 'skipped' && plan.sessions.some(s => s.id !== sessionId && s.date === session.date && s.status !== 'skipped')) return { error: 'Another session is using that date. Move or skip it before restoring this session.' }
  return { plan: { ...plan, sessions: plan.sessions.map(s => s.id === sessionId ? { ...s, status } : s) } }
}

// Rebalance is explicit and previewable. It never adds catch-up sessions or
// raises duration based on a missed run; completed sessions remain unchanged.
export function rebalanceTrainingCalendar(plan, today = localDateKey()) {
  if (dateStamp(today) == null || !Array.isArray(plan?.sessions)) return { error: 'Choose a valid plan and date.' }
  const previous = plan.sessions.filter(s => s.kind !== 'event' && s.date < today && s.date >= addDays(today, -14))
  const missed = previous.filter(s => s.status !== 'completed').length
  if (!missed) return { plan, changed: 0 }
  let changed = 0
  const sessions = plan.sessions.map(s => {
    if (s.kind === 'event' || s.status !== 'planned') return s
    if (s.date < today) { changed++; return { ...s, status: 'skipped' } }
    if (s.date >= addDays(today, 7)) return s
    if (s.adaptedOn === today) return s
    const minutes = sessionMinutes(s)
    if (minutes == null) return s
    const duration = Math.max(10, Math.floor(minutes * .8))
    if (duration >= minutes) return s
    changed++
    return { ...s, title: 'Return to routine', kind: 'recovery', adaptedOn: today, workout: { version: 1, type: 'recovery', values: { duration } } }
  })
  return { plan: { ...plan, sessions }, changed }
}

const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0

export function formatRaceSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const whole = Math.round(seconds), hours = Math.floor(whole / 3600)
  return hours ? `${hours}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}` : `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function makeRaceTimeline(race) {
  if (!finitePositive(race?.distance_km)) return null
  const distanceM = Number(race.distance_km) * 1000
  const splits = (Array.isArray(race.splits) ? race.splits : []).filter(s => finitePositive(s.km) && finitePositive(s.elapsedSecs)).sort((a, b) => Number(a.km) - Number(b.km))
  const points = [{ distanceM: 0, seconds: 0 }]
  for (const split of splits) {
    const distance = Number(split.km) * 1000, seconds = Number(split.elapsedSecs)
    const last = points.at(-1)
    if (distance > distanceM + .5 || distance <= last.distanceM || seconds <= last.seconds) continue
    points.push({ distanceM: distance, seconds })
  }
  // Cadra's split elapsedSecs are ACTIVE time. Never append an elapsed-wall
  // endpoint to that series: a paused run would otherwise appear slower.
  const hasSplits = points.length > 1
  const active = finitePositive(race.moving_time_secs) ? Number(race.moving_time_secs) : null
  const total = active ?? (!hasSplits && finitePositive(race.duration_secs) ? Number(race.duration_secs) : null)
  const last = points.at(-1)
  if (total != null && distanceM > last.distanceM + .5 && total > last.seconds) points.push({ distanceM, seconds: total })
  if (points.length < 2) return null
  return { raceId: race.id, points, maxDistanceM: points.at(-1).distanceM, basis: hasSplits || active != null ? 'active' : 'elapsed', coarse: !hasSplits, startedAt: race.started_at }
}

export function timeAtRecordedDistance(timeline, distanceM) {
  if (!timeline || !Number.isFinite(distanceM) || distanceM < 0 || distanceM > timeline.maxDistanceM) return null
  if (distanceM === 0) return 0
  for (let i = 1; i < timeline.points.length; i++) {
    const before = timeline.points[i - 1], after = timeline.points[i]
    if (distanceM <= after.distanceM) return before.seconds + ((distanceM - before.distanceM) / (after.distanceM - before.distanceM)) * (after.seconds - before.seconds)
  }
  return null
}

export function compareRaceTimelines(first, second, distanceM) {
  if (!first || !second || first.basis !== second.basis) return null
  const firstSeconds = timeAtRecordedDistance(first, distanceM), secondSeconds = timeAtRecordedDistance(second, distanceM)
  if (firstSeconds == null || secondSeconds == null) return null
  return { firstSeconds, secondSeconds, gapSeconds: secondSeconds - firstSeconds, leader: Math.abs(secondSeconds - firstSeconds) < .5 ? 'even' : secondSeconds > firstSeconds ? 'first' : 'second' }
}

export function comparableRunTrends(races, distanceKm = 5) {
  if (!finitePositive(distanceKm)) return []
  return (races || []).filter(r => Number(r.distance_km) >= distanceKm && Number(r.distance_km) <= distanceKm * 1.06 && Number.isFinite(Date.parse(r.started_at))).map(r => {
    const timeline = makeRaceTimeline(r)
    const seconds = timeAtRecordedDistance(timeline, distanceKm * 1000)
    return seconds == null ? null : { id: r.id, startedAt: r.started_at, seconds, pace: seconds / distanceKm, basis: timeline.basis, estimated: timeline.coarse || !timeline.points.some(p => p.distanceM === distanceKm * 1000) }
  }).filter(Boolean).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
}

function haversine(a, b) {
  const rad = n => n * Math.PI / 180
  const lat = rad(b.lat - a.lat), lng = rad(b.lng - a.lng)
  const value = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(lng / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
}

// Route similarity is an explicit secondary filter, not proof of equal terrain.
// Compare sampled positions along the whole path in the same running direction.
export function similarRoutes(first, second) {
  const clean = points => (Array.isArray(points) ? points : []).filter(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
  const a = clean(first), b = clean(second)
  if (a.length < 8 || b.length < 8) return null
  const distances = Array.from({ length: 12 }, (_, i) => haversine(a[Math.round(i * (a.length - 1) / 11)], b[Math.round(i * (b.length - 1) / 11)]))
  return distances.every(d => d <= 250) && distances.reduce((sum, d) => sum + d, 0) / distances.length <= 100
}

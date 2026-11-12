// Analytics are derived only from captured samples and recorded split boundaries.
// No pace is reconstructed from a route's geometry or invented timestamps.
export const MAX_ANALYSIS_GAP_S = 15
const finite = value => typeof value === 'number' && Number.isFinite(value)
const nonnegative = value => finite(value) && value >= 0
const numeric = value => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null
const validPoint = point => finite(point?.lat) && finite(point?.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180

export function formatAnalysisTime(seconds) {
  if (!finite(seconds) || seconds < 0) return '—'
  const whole = Math.round(seconds), hours = Math.floor(whole / 3600)
  return hours ? `${hours}:${String(Math.floor(whole / 60) % 60).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}` : `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function normalizeAnalysisSamples(samples) {
  if (!Array.isArray(samples)) return []
  const clean = []
  let interrupted = false
  for (const sample of samples) {
    if (!sample || !finite(sample.t) || sample.t <= 0 || !nonnegative(sample.elapsedS) || !nonnegative(sample.activeS) || !nonnegative(sample.distanceM) || sample.activeS > sample.elapsedS + 1 || !['fix', 'pause', 'resume', 'finish'].includes(sample.kind) || (sample.kind === 'fix' && !validPoint(sample))) {
      interrupted = true
      continue
    }
    const previous = clean.at(-1)
    if (previous && (sample.t < previous.t || sample.elapsedS < previous.elapsedS || sample.activeS < previous.activeS || sample.distanceM < previous.distanceM)) {
      interrupted = true
      continue
    }
    if (previous && sample.t === previous.t && sample.kind === previous.kind) continue
    clean.push({
      t: sample.t, elapsedS: sample.elapsedS, activeS: sample.activeS, distanceM: sample.distanceM,
      kind: sample.kind,
      lat: validPoint(sample) ? sample.lat : null,
      lng: validPoint(sample) ? sample.lng : null,
      altitudeM: finite(sample.altitudeM) && sample.altitudeM >= -500 && sample.altitudeM <= 9000 ? sample.altitudeM : null,
      accuracyM: nonnegative(sample.accuracyM) ? sample.accuracyM : null,
      breakBefore: interrupted,
    })
    interrupted = false
  }
  return clean
}

export function recordedAnalysisSplits(race) {
  const distanceM = (numeric(race?.distance_km) || 0) * 1000
  const rows = []
  let previousM = 0, previousS = 0
  const source = Array.isArray(race?.splits) ? race.splits : []
  for (const split of source) {
    const km = numeric(split?.km), cumulative = numeric(split?.elapsedSecs)
    if (!(km > 0) || !(cumulative > previousS) || km * 1000 <= previousM || km * 1000 > distanceM + 1) continue
    const meters = km * 1000 - previousM
    // Missing boundaries must not be presented as individual kilometre splits.
    const completeKm = Math.abs(meters - 1000) < 1
    rows.push({ label: completeKm ? `Km ${km}` : `${(previousM / 1000).toFixed(1)}–${km.toFixed(1)} km`, distanceM: meters, seconds: cumulative - previousS, pace: (cumulative - previousS) * 1000 / meters, fullKm: completeKm, partial: false, endM: km * 1000 })
    previousM = km * 1000
    previousS = cumulative
  }
  const moving = numeric(race?.moving_time_secs)
  const remainder = distanceM - previousM
  // A partial final km uses the same active-time basis as saved km splits.
  // Elapsed time is never appended to active splits.
  if (remainder >= 10 && remainder < 1000 && moving > previousS && rows.length > 0) {
    rows.push({ label: `Last ${(remainder / 1000).toFixed(2)} km`, distanceM: remainder, seconds: moving - previousS, pace: (moving - previousS) * 1000 / remainder, fullKm: false, partial: true, endM: distanceM })
  }
  return rows
}

function sampleAtDistance(samples, distanceM) {
  for (let i = 0; i < samples.length; i++) {
    const after = samples[i]
    if (Math.abs(after.distanceM - distanceM) < .001) return after
    const before = samples[i - 1]
    if (!before || distanceM <= before.distanceM || distanceM >= after.distanceM) continue
    if (after.breakBefore || after.kind !== 'fix' || before.kind === 'pause' || before.kind === 'finish' || after.elapsedS - before.elapsedS > MAX_ANALYSIS_GAP_S || (after.t - before.t) / 1000 > MAX_ANALYSIS_GAP_S) return null
    const ratio = (distanceM - before.distanceM) / (after.distanceM - before.distanceM)
    return { activeS: before.activeS + ratio * (after.activeS - before.activeS), elapsedS: before.elapsedS + ratio * (after.elapsedS - before.elapsedS), distanceM }
  }
  return null
}

export function buildRunAnalysis(race, analysis) {
  const samples = normalizeAnalysisSamples(analysis?.version === 1 ? analysis.samples : [])
  const distanceM = (numeric(race?.distance_km) || 0) * 1000
  const elapsedS = numeric(race?.duration_secs)
  const activeS = numeric(race?.moving_time_secs)
  const avgBasis = activeS == null ? 'elapsed' : 'active'
  const averagePace = distanceM > 0 && (activeS ?? elapsedS) > 0 ? (activeS ?? elapsedS) * 1000 / distanceM : null
  const gaps = [], pauses = [], points = []
  let window = [], segment = 0, pausedAt = null
  for (const sample of samples) {
    const previous = points.at(-1)
    const gap = previous && (sample.breakBefore || sample.elapsedS - previous.elapsedS > MAX_ANALYSIS_GAP_S || (sample.t - previous.t) / 1000 > MAX_ANALYSIS_GAP_S)
    if (gap && !pausedAt) gaps.push({ start: previous, end: sample, kind: 'gap' })
    if (sample.kind === 'pause') pausedAt = sample
    if (pausedAt && ['resume', 'finish'].includes(sample.kind)) {
      pauses.push({ start: pausedAt, end: sample, kind: 'pause' })
      pausedAt = null
    }
    if (gap || sample.kind !== 'fix' || pausedAt) { window = []; segment++ }
    let pace = null
    if (sample.kind === 'fix' && !pausedAt) {
      // Stop intervals are deliberate breaks, never a line to infinite pace.
      if (window.length && sample.distanceM === window.at(-1).distanceM) { window = []; segment++ }
      window.push(sample)
      while (window.length > 2 && sample.activeS - window[1].activeS >= 10) window.shift()
      const from = window[0], seconds = sample.activeS - from.activeS, meters = sample.distanceM - from.distanceM
      if (seconds >= 3 && meters >= 3) {
        const value = seconds * 1000 / meters
        if (value >= 60 && value <= 3600) pace = value
      }
    }
    points.push({ ...sample, pace, segment })
  }
  if (pausedAt && points.at(-1) !== pausedAt) pauses.push({ start: pausedAt, end: points.at(-1), kind: 'pause' })
  const fixes = points.filter(point => point.kind === 'fix')
  const hasDetailed = fixes.length >= 2
  const pacePoints = points.filter(point => point.pace != null)
  const elevationPoints = fixes.filter(point => point.altitudeM != null)
  const splits = recordedAnalysisSplits(race)
  const fullSplits = splits.filter(row => row.fullKm)
  const fastest = fullSplits.length ? fullSplits.reduce((a, b) => b.pace < a.pace ? b : a) : null
  const slowest = fullSplits.length ? fullSplits.reduce((a, b) => b.pace > a.pace ? b : a) : null
  const meanSplit = fullSplits.length ? fullSplits.reduce((sum, split) => sum + split.pace, 0) / fullSplits.length : 0
  const variationPct = fullSplits.length >= 3 && meanSplit > 0 ? Math.sqrt(fullSplits.reduce((sum, split) => sum + (split.pace - meanSplit) ** 2, 0) / fullSplits.length) / meanSplit * 100 : null
  const half = distanceM >= 100 && hasDetailed && samples[0]?.distanceM <= 10 && samples.at(-1)?.distanceM >= distanceM - Math.max(2, distanceM * .001) ? sampleAtDistance(samples, distanceM / 2) : null
  const halves = half && activeS > half.activeS && half.activeS > 0 ? {
    firstPace: half.activeS * 2000 / distanceM,
    secondPace: (activeS - half.activeS) * 2000 / distanceM,
    firstSeconds: half.activeS, secondSeconds: activeS - half.activeS,
    deltaSeconds: activeS - 2 * half.activeS,
  } : null
  return { points, pacePoints, gaps, pauses, hasDetailed, hasElevation: elevationPoints.length >= 3, elevationPoints, splits, fastest, slowest, variationPct, halves, distanceM, elapsedS, activeS, averagePace, avgBasis }
}

export function nearestAnalysisPoint(points, value, axis = 'distance') {
  if (!points?.length || !finite(value)) return -1
  const field = axis === 'time' ? 'elapsedS' : 'distanceM'
  let nearest = 0
  for (let index = 1; index < points.length; index++) if (Math.abs(points[index][field] - value) < Math.abs(points[nearest][field] - value)) nearest = index
  return nearest
}

export function analysisRouteSegments(points) {
  const segments = []
  let current = [], previous = null
  for (const point of points || []) {
    const split = point.breakBefore || point.kind !== 'fix' || !validPoint(point) || (previous && (point.t - previous.t) / 1000 > MAX_ANALYSIS_GAP_S)
    if (split && current.length) { segments.push(current); current = [] }
    if (point.kind === 'fix' && validPoint(point)) current.push([point.lat, point.lng])
    previous = point
  }
  if (current.length) segments.push(current)
  return segments
}

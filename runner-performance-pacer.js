// A target pacer is a calculated training guide, never somebody else's run.
// Keep its configuration in the run URL/checkpoint so recovery is deterministic.
export const PACER_STRATEGIES = ['even', 'negative']

export function validateTargetPacer(raw) {
  if (!raw || raw.version !== 1) return null
  const distanceKm = Number(raw.distanceKm)
  const targetSeconds = Number(raw.targetSeconds)
  if (!Number.isFinite(distanceKm) || distanceKm < 0.1 || distanceKm > 100) return null
  if (!Number.isInteger(targetSeconds) || targetSeconds < 60 || targetSeconds > 86400) return null
  if (!PACER_STRATEGIES.includes(raw.strategy)) return null
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : ''
  return { version: 1, distanceKm: Math.round(distanceKm * 1000) / 1000, targetSeconds, strategy: raw.strategy, name }
}

export function parseTargetPacer(value) {
  try { return validateTargetPacer(JSON.parse(value || 'null')) } catch { return null }
}

export function buildTargetPacerTrack(raw) {
  const config = validateTargetPacer(raw)
  if (!config) return null
  const distanceM = config.distanceKm * 1000
  const firstHalfSeconds = config.targetSeconds * (config.strategy === 'negative' ? 0.52 : 0.5)
  return {
    id: null,
    race_id: null,
    user_id: null,
    owner: { display_name: 'Target pacer' },
    total_distance_m: distanceM,
    total_duration_s: config.targetSeconds,
    avg_pace_s_per_km: config.targetSeconds / config.distanceKm,
    sample_cadence_s: 0,
    sample_source: 'target_pacer',
    t_seconds: [0, firstHalfSeconds, config.targetSeconds],
    dist_m: [0, distanceM / 2, distanceM],
  }
}

export function targetPacerSummary(raw) {
  const config = validateTargetPacer(raw)
  if (!config) return null
  const averagePace = config.targetSeconds / config.distanceKm
  return {
    averagePace,
    firstHalfPace: averagePace * (config.strategy === 'negative' ? 1.04 : 1),
    secondHalfPace: averagePace * (config.strategy === 'negative' ? 0.96 : 1),
  }
}

export function formatPacerTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const secs = rounded % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`
}

// Compare the runner with the pacer's current phase, so following the slower
// first half of a negative split is not incorrectly labelled off pace.
export function targetPacerPaceAtTime(track, elapsedSeconds = 0) {
  if (track?.sample_source !== 'target_pacer' || track.t_seconds?.length !== 3 || track.dist_m?.length !== 3) return null
  const i = elapsedSeconds >= track.t_seconds[1] ? 1 : 0
  const meters = track.dist_m[i + 1] - track.dist_m[i]
  const seconds = track.t_seconds[i + 1] - track.t_seconds[i]
  return meters > 0 && seconds > 0 ? seconds / (meters / 1000) : null
}

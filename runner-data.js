/* Read-only web counterpart to Cadra's profileService, raceService.getRecentRaces
 * and rankingsService.getUserRanking. Pass the signed-in supabase-js client
 * and the ID of the account currently displayed by the auth controller.
 *
 * load(client, expectedUserId) → { profile, ranking, bests, activities,
 *   activityCount, nextOffset, errors }. more(client, expectedUserId, offset)
 * returns the same activity fields and errors. Missing rows/metrics are null.
 * A failed section has a message in errors; a successful empty section does
 * not. Both calls reject if identity cannot be verified. On an auth change,
 * the renderer must clear its view and discard pending results for that view.
 */
(() => {
  'use strict'

  const pageSize = 12
  const distances = ['1K', '5K', '10K', 'HALF', 'MARATHON']
  const errorMessages = {
    profile: 'Your profile could not be loaded.',
    ranking: 'Your rankings could not be loaded.',
    bests: 'Your personal bests could not be loaded.',
    activities: 'Your saved runs could not be loaded.'
  }

  async function verifyAccount(client, expectedUserId) {
    const { data, error } = await client.auth.getUser()
    if (error || !expectedUserId || data?.user?.id !== expectedUserId) {
      throw new Error('Your account could not be verified. Please sign in again.')
    }
    return data.user.id
  }

  function optionalText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  function numeric(value) {
    if (typeof value !== 'number' && !optionalText(value)) return null
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? number : null
  }

  function positive(value) {
    const number = numeric(value)
    return number > 0 ? number : null
  }

  async function read(query) {
    const { data, error } = await query
    if (error) throw error
    return data
  }

  async function profile(client, id) {
    const row = await read(client.from('profiles')
      .select('display_name,username,city,country,bio')
      .eq('id', id).maybeSingle())
    return row && {
      displayName: optionalText(row.display_name) || optionalText(row.username),
      username: optionalText(row.username), city: optionalText(row.city),
      country: optionalText(row.country), bio: optionalText(row.bio)
    }
  }

  async function ranking(client, id) {
    // These are Cadra's persisted score ranks, including its geographic ranks.
    // They are distinct from positions computed by re-sorting runs by distance.
    const row = await read(client.from('rankings')
      .select('global_rank,country_rank,city_rank,total_score,total_distance,total_races')
      .eq('user_id', id).maybeSingle())
    return row && {
      globalRank: positive(row.global_rank), countryRank: positive(row.country_rank),
      cityRank: positive(row.city_rank), totalScore: numeric(row.total_score),
      totalDistanceKm: numeric(row.total_distance), totalRuns: numeric(row.total_races)
    }
  }

  async function bests(client, id) {
    const rows = await read(client.from('personal_bests')
      .select('category,time_secs').eq('user_id', id))
    const byDistance = new Map(rows.map(row => [row.category, positive(row.time_secs)]))
    return distances.filter(key => byDistance.get(key))
      .map(category => ({ category, timeSeconds: byDistance.get(category) }))
  }

  function emptyPage() {
    return { activities: [], activityCount: null, nextOffset: null }
  }

  async function activities(client, id, offset) {
    const { data, count, error } = await client.from('races')
      .select('id,title,started_at,distance_km,duration_secs,pace_sec_per_km,elevation_gain_m', { count: 'exact' })
      .eq('user_id', id)
      .order('started_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    const end = offset + data.length
    const hasMore = count == null ? data.length === pageSize : data.length > 0 && end < count
    return {
      activityCount: count ?? null,
      nextOffset: hasMore ? end : null,
      activities: data.map(row => ({
        id: row.id, title: optionalText(row.title) || 'Run', startedAt: row.started_at || null,
        distanceKm: numeric(row.distance_km), durationSeconds: numeric(row.duration_secs),
        paceSecondsPerKm: positive(row.pace_sec_per_km), elevationMetres: numeric(row.elevation_gain_m)
      }))
    }
  }

  async function section(key, pending, fallback, errors) {
    try {
      return await pending
    } catch {
      errors[key] = errorMessages[key]
      return fallback
    }
  }

  async function load(client, expectedUserId) {
    const id = await verifyAccount(client, expectedUserId)
    const errors = {}
    const [identity, standing, records, page] = await Promise.all([
      section('profile', profile(client, id), null, errors),
      section('ranking', ranking(client, id), null, errors),
      section('bests', bests(client, id), [], errors),
      section('activities', activities(client, id, 0), emptyPage(), errors)
    ])
    return { profile: identity, ranking: standing, bests: records, ...page, errors }
  }

  async function more(client, expectedUserId, offset) {
    if (!Number.isSafeInteger(offset) || offset < 0) throw new RangeError('Invalid run history offset.')
    const id = await verifyAccount(client, expectedUserId)
    const errors = {}
    const page = await section('activities', activities(client, id, offset), emptyPage(), errors)
    return { ...page, errors }
  }

  window.CadraRunnerData = Object.freeze({ load, more })
})()

// Shared mobile catalog from src/lib/challengesSeed.js.
(() => {
/**
 * Active Challenges seed catalog — 30 entries.
 *
 *   4 featured · 6 elite · 6 hard · 6 medium · 8 easy
 *
 * Loaded into `public.challenges` on first run via seedChallenges() in
 * challengesService.js, idempotent on slug.  Fixed-date challenges resolve
 * their dates at seed-time against the current calendar year.
 */

// Diwali dates for the next several years (approx — refresh annually).
const DIWALI = { 2025: '2025-10-20', 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-11-17', 2029: '2029-11-05' }

function currentMonsoonYear() {
  return new Date().getFullYear()
}
function diwaliRange() {
  const y = new Date().getFullYear()
  const d = DIWALI[y] || `${y}-10-20`
  const dt = new Date(d)
  const minus3 = new Date(dt); minus3.setDate(dt.getDate() - 3)
  const plus3  = new Date(dt); plus3.setDate(dt.getDate() + 3)
  return { start: minus3.toISOString().slice(0, 10), end: plus3.toISOString().slice(0, 10) }
}

const Y = currentMonsoonYear()
const diwali = diwaliRange()

window.CadraChallengeCatalog = [
  // ─── FEATURED (4) ────────────────────────────────────────────────────────
  {
    slug: 'monsoon-madness-100k',
    title: 'Monsoon Madness 100K',
    tagline: 'Cover 100 kilometres across the monsoon season. Rain, slush, and all. Earn the limited-edition Monsoon medal for your trophy case.',
    tier: 'featured', type: 'distance',
    target: { type: 'distance', metric: 'total_km', value: 100 },
    constraints: null,
    window_type: 'fixed_date',
    fixed_start_date: `${Y}-06-01`, fixed_end_date: `${Y}-09-30`,
    icon_key: 'water_drop', medal_design_key: 'monsoon', medal_inner_symbol: 'water_drop',
    locale_tags: ['india', 'monsoon'], sort_priority: 100,
  },
  {
    slug: 'republic-day-26k-tribute',
    title: 'Republic Day 26K Tribute',
    tagline: 'Cover 26 kilometres between Jan 20-26. One for every year of the Republic.',
    tier: 'featured', type: 'distance',
    target: { type: 'distance', metric: 'total_km', value: 26 },
    constraints: null,
    window_type: 'fixed_date',
    fixed_start_date: `${Y}-01-20`, fixed_end_date: `${Y}-01-26`,
    icon_key: 'flag', medal_design_key: 'republic_day', medal_inner_symbol: 'flag',
    locale_tags: ['india'], sort_priority: 95,
  },
  {
    slug: 'new-year-new-pr',
    title: 'New Year, New PR',
    tagline: 'Beat your old 5K personal best during the month of January.',
    tier: 'featured', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 5, max_duration_sec: 'user_pr_5k' },
    constraints: null,
    window_type: 'fixed_date',
    fixed_start_date: `${Y}-01-01`, fixed_end_date: `${Y}-01-31`,
    icon_key: 'star', medal_design_key: 'new_year', medal_inner_symbol: 'auto_awesome',
    locale_tags: [], sort_priority: 90,
  },
  {
    slug: 'diwali-lantern-sprints',
    title: 'Diwali Lantern Sprints',
    tagline: 'Run 5 evenings during Diwali week — keep the lanterns lit.',
    tier: 'featured', type: 'frequency',
    target: { type: 'frequency', metric: 'run_count', value: 5, window_days: 7 },
    constraints: { earliest_hour: 17 },
    window_type: 'fixed_date',
    fixed_start_date: diwali.start, fixed_end_date: diwali.end,
    icon_key: 'lightbulb', medal_design_key: 'diwali', medal_inner_symbol: 'celebration',
    locale_tags: ['india', 'festival'], sort_priority: 85,
  },

  // ─── ELITE (6) ────────────────────────────────────────────────────────────
  {
    slug: 'sub-25-5k-sprint',
    title: 'Sub-25 5K Sprint',
    tagline: 'Run 5 kilometres in under 25 minutes. One effort, no shortcuts.',
    tier: 'elite', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 5, max_duration_sec: 1500 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'bolt', medal_design_key: 'elite_speed', medal_inner_symbol: 'bolt',
    locale_tags: [], sort_priority: 80,
  },
  {
    slug: 'sub-40-10k-threshold',
    title: 'Sub-40 10K Threshold',
    tagline: 'Complete a 10K under 40 minutes. Threshold territory.',
    tier: 'elite', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 10, max_duration_sec: 2400 },
    constraints: null, window_type: 'rolling', window_duration_days: 45,
    icon_key: 'timer', medal_design_key: 'elite_speed', medal_inner_symbol: 'timer',
    locale_tags: [], sort_priority: 75,
  },
  {
    slug: 'half-marathon-145-wall',
    title: 'Half Marathon · 1:45 Wall',
    tagline: 'Finish 21.1 km in under 1:45:00. Race-day fitness.',
    tier: 'elite', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 21.1, max_duration_sec: 6300 },
    constraints: null, window_type: 'rolling', window_duration_days: 90,
    icon_key: 'emoji_events', medal_design_key: 'elite_distance', medal_inner_symbol: 'emoji_events',
    locale_tags: [], sort_priority: 70,
  },
  {
    slug: '4-min-mile-pace',
    title: '4-Minute Mile Pace',
    tagline: 'Hold a 4:00/km pace for 1.6 km in a single effort.',
    tier: 'elite', type: 'pace',
    target: { type: 'pace', metric: 'min_pace_sec_per_km', value: 240, distance_km: 1.6 },
    constraints: null, window_type: 'rolling', window_duration_days: 21,
    icon_key: 'speed', medal_design_key: 'elite_speed', medal_inner_symbol: 'speed',
    locale_tags: [], sort_priority: 65,
  },
  {
    slug: 'negative-split-mastery',
    title: 'Negative Split Mastery',
    tagline: 'Run your second half 30+ seconds faster than the first. On any distance ≥ 5K.',
    tier: 'elite', type: 'pace',
    target: { type: 'single_effort', metric: 'negative_split_seconds', value: 30, distance_km: 5 },
    constraints: { requires_splits: true },
    window_type: 'rolling', window_duration_days: 21,
    icon_key: 'compare_arrows', medal_design_key: 'elite_pace', medal_inner_symbol: 'compare_arrows',
    locale_tags: [], sort_priority: 60,
  },
  {
    slug: 'everest-foothills-climb',
    title: 'Everest Foothills Climb',
    tagline: 'Climb 3,000 metres of total elevation gain this month.',
    tier: 'elite', type: 'elevation',
    target: { type: 'elevation', metric: 'total_elevation_m', value: 3000 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'landscape', medal_design_key: 'elite_climb', medal_inner_symbol: 'landscape',
    locale_tags: [], sort_priority: 55,
  },

  // ─── HARD (6) ─────────────────────────────────────────────────────────────
  {
    slug: 'dawn-patrol-7-day',
    title: 'Dawn Patrol 7-Day',
    tagline: 'Complete a run that finishes before 7AM every day for 7 consecutive days.',
    tier: 'hard', type: 'streak',
    target: { type: 'streak', metric: 'consecutive_days', value: 7 },
    constraints: { latest_finish_hour: 7 },
    window_type: 'rolling', window_duration_days: 14,
    icon_key: 'local_fire_department', medal_design_key: 'hard_streak', medal_inner_symbol: 'wb_twilight',
    locale_tags: [], sort_priority: 50,
  },
  {
    slug: 'double-century-month',
    title: 'Double Century Month',
    tagline: 'Cover 200 kilometres in a single calendar month.',
    tier: 'hard', type: 'distance',
    target: { type: 'distance', metric: 'total_km', value: 200 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'bar_chart', medal_design_key: 'hard_distance', medal_inner_symbol: 'looks_two',
    locale_tags: [], sort_priority: 45,
  },
  {
    slug: '25k-long-run',
    title: '25K Long Run',
    tagline: 'Complete a single run of 25+ kilometres within 30 days.',
    tier: 'hard', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 25 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'terrain', medal_design_key: 'hard_distance', medal_inner_symbol: 'route',
    locale_tags: [], sort_priority: 40,
  },
  {
    slug: 'iron-will-30-day',
    title: 'Iron Will 30-Day',
    tagline: 'Run every single day for 30 days. No skips. No exceptions.',
    tier: 'hard', type: 'streak',
    target: { type: 'streak', metric: 'consecutive_days', value: 30 },
    constraints: { min_distance_km: 1.6 },
    window_type: 'rolling', window_duration_days: 35,
    icon_key: 'south', medal_design_key: 'hard_streak', medal_inner_symbol: 'shield',
    locale_tags: [], sort_priority: 35,
  },
  {
    slug: 'nandi-hills-conqueror',
    title: 'Nandi Hills Conqueror',
    tagline: 'Gain 1,500 metres of elevation across any number of runs in 2 weeks.',
    tier: 'hard', type: 'elevation',
    target: { type: 'elevation', metric: 'total_elevation_m', value: 1500 },
    constraints: null, window_type: 'rolling', window_duration_days: 14,
    icon_key: 'hiking', medal_design_key: 'hard_climb', medal_inner_symbol: 'filter_hdr',
    locale_tags: ['bengaluru'], sort_priority: 30,
  },
  {
    slug: 'marathon-distance',
    title: 'Marathon Distance',
    tagline: 'Complete 42.2 km in a single effort. The classic distance.',
    tier: 'hard', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 42.2 },
    constraints: null, window_type: 'rolling', window_duration_days: 45,
    icon_key: 'directions_run', medal_design_key: 'hard_distance', medal_inner_symbol: 'sports_score',
    locale_tags: [], sort_priority: 25,
  },

  // ─── MEDIUM (6) ───────────────────────────────────────────────────────────
  {
    slug: 'monsoon-50k-month',
    title: 'Monsoon 50K Month',
    tagline: "Cover 50 kilometres in any calendar month. Don't let the rain stop you.",
    tier: 'medium', type: 'distance',
    target: { type: 'distance', metric: 'total_km', value: 50 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'star', medal_design_key: 'medium_distance', medal_inner_symbol: '50',
    locale_tags: [], sort_priority: 20,
  },
  {
    slug: 'two-week-locked-in',
    title: 'Two-Week Locked-In',
    tagline: 'Run 14 days in a row. Build the muscle of showing up.',
    tier: 'medium', type: 'streak',
    target: { type: 'streak', metric: 'consecutive_days', value: 14 },
    constraints: { min_distance_km: 1.6 },
    window_type: 'rolling', window_duration_days: 18,
    icon_key: 'calendar_month', medal_design_key: 'medium_streak', medal_inner_symbol: 'lock',
    locale_tags: [], sort_priority: 18,
  },
  {
    slug: 'sub-30-5k-breakthrough',
    title: 'Sub-30 5K Breakthrough',
    tagline: 'Run 5 kilometres in under 30 minutes.',
    tier: 'medium', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 5, max_duration_sec: 1800 },
    constraints: null, window_type: 'rolling', window_duration_days: 21,
    icon_key: 'bolt', medal_design_key: 'medium_speed', medal_inner_symbol: 'speed',
    locale_tags: [], sort_priority: 16,
  },
  {
    slug: 'five-day-warrior',
    title: 'Five-Day Warrior',
    tagline: 'Complete 5 runs in 7 days. Consistency over intensity.',
    tier: 'medium', type: 'frequency',
    target: { type: 'frequency', metric: 'run_count', value: 5, window_days: 7 },
    constraints: null, window_type: 'rolling', window_duration_days: 7,
    icon_key: 'check_circle', medal_design_key: 'medium_freq', medal_inner_symbol: 'looks_5',
    locale_tags: [], sort_priority: 14,
  },
  {
    slug: 'tempo-threshold-5-00',
    title: 'Tempo Threshold 5:00',
    tagline: 'Hold 5:00/km pace for at least 3 km in a single effort.',
    tier: 'medium', type: 'pace',
    target: { type: 'pace', metric: 'min_pace_sec_per_km', value: 300, distance_km: 3 },
    constraints: null, window_type: 'rolling', window_duration_days: 21,
    icon_key: 'arrow_upward', medal_design_key: 'medium_pace', medal_inner_symbol: 'trending_up',
    locale_tags: [], sort_priority: 12,
  },
  {
    slug: '10k-milestone',
    title: '10K Milestone',
    tagline: 'Complete a single 10K run. A classic milestone for any runner.',
    tier: 'medium', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 10 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'location_on', medal_design_key: 'medium_distance', medal_inner_symbol: '10K',
    locale_tags: [], sort_priority: 10,
  },

  // ─── EASY (8) ─────────────────────────────────────────────────────────────
  {
    slug: 'your-first-5k',
    title: 'Your First 5K',
    tagline: 'Complete a 5K run at any pace. Everyone starts somewhere.',
    tier: 'easy', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 5 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'star', medal_design_key: 'easy_distance', medal_inner_symbol: 'star',
    locale_tags: [], sort_priority: 8,
  },
  {
    slug: 'three-times-habit',
    title: 'Three-Times Habit',
    tagline: 'Complete 3 runs this week.',
    tier: 'easy', type: 'frequency',
    target: { type: 'frequency', metric: 'run_count', value: 3, window_days: 7 },
    constraints: null, window_type: 'rolling', window_duration_days: 7,
    icon_key: 'calendar_month', medal_design_key: 'easy_freq', medal_inner_symbol: 'looks_3',
    locale_tags: [], sort_priority: 7,
  },
  {
    slug: 'twenty-k-starter',
    title: 'Twenty-K Starter',
    tagline: 'Cover 20 kilometres in a calendar month.',
    tier: 'easy', type: 'distance',
    target: { type: 'distance', metric: 'total_km', value: 20 },
    constraints: null, window_type: 'rolling', window_duration_days: 30,
    icon_key: 'bar_chart', medal_design_key: 'easy_distance', medal_inner_symbol: 'pin_drop',
    locale_tags: [], sort_priority: 6,
  },
  {
    slug: 'three-day-spark',
    title: 'Three-Day Spark',
    tagline: 'Run 3 days in a row to ignite a habit.',
    tier: 'easy', type: 'streak',
    target: { type: 'streak', metric: 'consecutive_days', value: 3 },
    constraints: { min_distance_km: 1 },
    window_type: 'rolling', window_duration_days: 7,
    icon_key: 'local_fire_department', medal_design_key: 'easy_streak', medal_inner_symbol: 'looks_3',
    locale_tags: [], sort_priority: 5,
  },
  {
    slug: 'morning-light-club',
    title: 'Morning Light Club',
    tagline: 'Complete 2 runs that finish before 8AM in any single week.',
    tier: 'easy', type: 'frequency',
    target: { type: 'frequency', metric: 'run_count', value: 2, window_days: 7 },
    constraints: { latest_finish_hour: 8 },
    window_type: 'rolling', window_duration_days: 7,
    icon_key: 'wb_sunny', medal_design_key: 'easy_streak', medal_inner_symbol: 'wb_sunny',
    locale_tags: [], sort_priority: 4,
  },
  {
    slug: 'cubbon-park-loop',
    title: 'Cubbon Park Loop',
    tagline: 'One run of 5+ km that passes through Cubbon Park, Bengaluru.',
    tier: 'easy', type: 'single_effort',
    target: { type: 'single_effort', metric: 'distance_km', value: 5 },
    // Polygon bbox lat/lng — replace with full polygon in a follow-up.
    constraints: { location_bbox: { minLat: 12.972, maxLat: 12.982, minLng: 77.585, maxLng: 77.602 } },
    window_type: 'rolling', window_duration_days: 30,
    icon_key: 'park', medal_design_key: 'easy_local', medal_inner_symbol: 'park',
    locale_tags: ['bengaluru'], sort_priority: 3,
  },
  {
    slug: 'easy-pace-patrol',
    title: 'Easy Pace Patrol',
    tagline: 'Complete a 3K run at a conversational pace (slower than 7:00/km).',
    tier: 'easy', type: 'pace',
    target: { type: 'single_effort', metric: 'distance_km', value: 3, max_pace_sec_per_km: 420 },
    constraints: null, window_type: 'rolling', window_duration_days: 14,
    icon_key: 'waves', medal_design_key: 'easy_pace', medal_inner_symbol: 'self_improvement',
    locale_tags: [], sort_priority: 2,
  },
  {
    slug: 'welcome-back-week',
    title: 'Welcome Back Week',
    tagline: 'Complete 2 runs after taking a 7+ day break from running.',
    tier: 'easy', type: 'frequency',
    target: { type: 'frequency', metric: 'run_count', value: 2, window_days: 7 },
    constraints: { gap_days_before_join: 7 },
    window_type: 'rolling', window_duration_days: 7,
    icon_key: 'refresh', medal_design_key: 'easy_freq', medal_inner_symbol: 'restart_alt',
    locale_tags: [], sort_priority: 1,
  },
]

})();

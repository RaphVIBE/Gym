// ============================================================
// Pulse Coach — rule-based program generator.
//
// Turns a user's profile (age, bodyweight, goal, experience,
// rhythm, equipment, things to avoid) into a structured weekly
// program written into programs / program_days / day_exercises.
//
// AI-ready: generateProgram() is a pure function of (profile,
// catalog). To swap in an AI engine later, replace its body with
// a call that returns the same { name, goal, days[] } shape, and
// persistProgram() keeps working unchanged.
// ============================================================

// ---- which equipment each setup can use ----
const EQUIPMENT_SETS = {
  full_gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell'],
  dumbbells: ['dumbbell', 'bodyweight', 'kettlebell'],
  home: ['dumbbell', 'bodyweight', 'kettlebell'],
  bodyweight: ['bodyweight'],
}

// ---- distinct sessions per training frequency (A, B, C…) ----
const SESSION_PLAN = {
  2: ['full', 'full'],
  3: ['full', 'full', 'full'],
  4: ['upper', 'lower'],
  5: ['push', 'pull', 'legs', 'upper', 'lower'],
  6: ['push', 'pull', 'legs'],
}

// ---- pattern slots per day type ----
const DAY_TEMPLATES = {
  full: { title: 'CORPS COMPLET', patterns: ['squat', 'hinge', 'push', 'pull', 'lunge', 'core'] },
  upper: { title: 'HAUT DU CORPS', patterns: ['push', 'pull', 'push', 'pull', 'core'] },
  lower: { title: 'BAS DU CORPS', patterns: ['squat', 'hinge', 'lunge', 'calf', 'core'] },
  push: { title: 'POUSSÉE', patterns: ['push', 'push', 'push', 'push', 'core'] },
  pull: { title: 'TIRAGE', patterns: ['pull', 'pull', 'pull', 'pull', 'core'] },
  legs: { title: 'JAMBES', patterns: ['squat', 'hinge', 'lunge', 'calf', 'core'] },
}

// ---- goal → set / rest / tempo scheme ----
const GOAL_SCHEME = {
  strength: { focus: 'FORCE', sets: 5, rest: '3:00', tempo: '3-1-1', compoundReps: '5', finisher: false },
  hypertrophy: { focus: 'HYPERTROPHIE', sets: 4, rest: '1:30', tempo: '2-1-1', compoundReps: '8', finisher: false },
  fat_loss: { focus: 'PERTE DE GRAS', sets: 3, rest: '0:45', tempo: '2-0-1', compoundReps: '12', finisher: true },
  conditioning: { focus: 'CARDIO', sets: 3, rest: '0:40', tempo: '2-0-1', compoundReps: '12', finisher: true },
  general: { focus: 'GÉNÉRAL', sets: 3, rest: '1:30', tempo: '2-1-1', compoundReps: '8', finisher: false },
}

// ---- estimated working load as a fraction of bodyweight ----
const LOAD_COEF = { squat: 1.0, hinge: 1.1, push: 0.6, pull: 0.55, lunge: 0.35, calf: 0.5 }
const COMPOUND_PATTERNS = ['squat', 'hinge', 'push', 'pull']

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function round2_5(n) {
  return Math.max(5, Math.round(n / 2.5) * 2.5)
}

function estimateLoad(ex, profile, scheme) {
  if (ex.equipment === 'bodyweight') return 'BW'
  const coef = LOAD_COEF[ex.pattern]
  if (!coef || !profile.bodyweight) return ex.equipment === 'machine' ? '—' : '—'
  const expF = profile.experience === 'beginner' ? 0.6 : profile.experience === 'advanced' ? 1.05 : 0.85
  const age = profile.age || 30
  const ageF = Math.max(0.8, 1 - Math.max(0, age - 40) * 0.006)
  // dumbbell movements are loaded per hand → scale down
  const handF = ex.equipment === 'dumbbell' ? 0.5 : 1
  let kg = profile.bodyweight * coef * expF * ageF * handF
  if (ex.unilateral) kg *= 0.6
  return round2_5(kg) + ' kg'
}

function targetCount(profile) {
  let n = 5
  if (profile.experience === 'beginner') n = 4
  if (profile.experience === 'advanced') n = 6
  const mins = profile.session_minutes || 50
  if (mins < 40) n -= 1
  if (mins >= 70) n += 1
  return Math.max(3, Math.min(7, n))
}

// Generate a full weekly program. Pure function — same inputs, structured output.
export function generateProgram(profile, catalog) {
  const goal = profile.goal || 'general'
  const scheme = GOAL_SCHEME[goal] || GOAL_SCHEME.general
  const freq = Math.max(2, Math.min(6, profile.days_per_week || 4))
  const allowedEquip = EQUIPMENT_SETS[profile.equipment] || EQUIPMENT_SETS.full_gym
  const diffCap = profile.experience === 'beginner' ? 2 : 3
  const avoid = (profile.avoid || []).map((a) => a.toLowerCase())

  // usable catalog for this user
  const usable = catalog.filter((e) =>
    allowedEquip.includes(e.equipment) &&
    e.difficulty <= diffCap &&
    !avoid.includes(e.pattern) &&
    !avoid.includes(e.name.toLowerCase()),
  )

  // group by pattern, pre-shuffled for variety
  const byPattern = {}
  for (const e of usable) (byPattern[e.pattern] ||= []).push(e)
  for (const k in byPattern) byPattern[k] = shuffle(byPattern[k])

  const usedCount = {} // exercise id → times used, to spread variety
  const pick = (pattern, dayUsed) => {
    const pool = byPattern[pattern]
    if (!pool || pool.length === 0) return null
    // never repeat an exercise within the same day — skip the slot instead
    const candidates = pool.filter((e) => !dayUsed.has(e.id))
    if (candidates.length === 0) return null
    candidates.sort((a, b) => (usedCount[a.id] || 0) - (usedCount[b.id] || 0))
    return candidates[0]
  }

  const count = targetCount(profile)
  const types = SESSION_PLAN[freq] || SESSION_PLAN[3]
  const typeCounts = {}
  types.forEach((t) => { typeCounts[t] = (typeCounts[t] || 0) + 1 })
  const typeSeen = {}

  const sessions = types.map((type) => {
    const tpl = DAY_TEMPLATES[type]
    let patterns = tpl.patterns.slice(0, count)
    if (scheme.finisher) patterns = [...patterns, 'conditioning']

    const used = new Set()
    const exercises = []
    let pos = 0
    for (const pattern of patterns) {
      const ex = pick(pattern, used)
      if (!ex) continue
      used.add(ex.id)
      usedCount[ex.id] = (usedCount[ex.id] || 0) + 1
      const isCompound = COMPOUND_PATTERNS.includes(pattern)
      const reps = pattern === 'conditioning' || pattern === 'core'
        ? ex.default_reps
        : (isCompound ? scheme.compoundReps : ex.default_reps)
      exercises.push({
        exercise_id: ex.id, name: ex.name, muscle_group: ex.muscle_group, pattern: ex.pattern,
        description: ex.description || '',
        sets: pattern === 'conditioning' ? 1 : (isCompound ? scheme.sets : Math.max(3, scheme.sets - 1)),
        reps, weight: estimateLoad(ex, profile, scheme),
        rest: pattern === 'conditioning' ? '1:00' : scheme.rest, tempo: scheme.tempo,
        video: ex.name, cues: ex.cues || [], position: pos++,
      })
    }
    let title = tpl.title
    if (typeCounts[type] > 1) { typeSeen[type] = (typeSeen[type] || 0) + 1; title += ' ' + String.fromCharCode(64 + typeSeen[type]) }
    return { title, focus: scheme.focus, exercises }
  })

  const goalName = { strength: 'Force', hypertrophy: 'Hypertrophie', fat_loss: 'Perte de Gras', conditioning: 'Cardio', general: 'Forme Générale' }[goal]
  return { name: `${freq} jours · ${goalName}`, goal, sessions }
}

// Persist a generated program, making it the active one.
export async function persistProgram(supabase, userId, program) {
  // deactivate any current program
  await supabase.from('programs').update({ is_active: false }).eq('user_id', userId).eq('is_active', true)

  const { data: prog, error: pErr } = await supabase
    .from('programs')
    .insert({ user_id: userId, name: program.name, goal: program.goal, is_active: true })
    .select().single()
  if (pErr) throw pErr

  const sessions = program.sessions || []
  for (let i = 0; i < sessions.length; i++) {
    const sdef = sessions[i]
    const { data: day, error: dErr } = await supabase
      .from('program_days')
      .insert({ program_id: prog.id, user_id: userId, position: i, weekday: i, title: sdef.title, focus: sdef.focus, is_rest: false })
      .select().single()
    if (dErr) throw dErr
    if (sdef.exercises.length) {
      const rows = sdef.exercises.map((e) => ({
        program_day_id: day.id, user_id: userId, position: e.position,
        exercise_id: e.exercise_id, name: e.name, muscle_group: e.muscle_group,
        pattern: e.pattern, description: e.description,
        sets: e.sets, reps: e.reps, weight: e.weight, rest: e.rest, tempo: e.tempo,
        video: e.video, cues: e.cues,
      }))
      const { error: eErr } = await supabase.from('day_exercises').insert(rows)
      if (eErr) throw eErr
    }
  }
  return prog.id
}

export { WEEKDAY_LABELS }

// ---- quick / express sessions (started ad-hoc on the day) ----
export const QUICK_LABELS = {
  short: 'SÉANCE COURTE',
  legs: 'FOCUS JAMBES',
  upper: 'HAUT DU CORPS',
  cardio: 'CARDIO EXPRESS',
  empty: 'SÉANCE LIBRE',
}

const QUICK_DEFS = {
  short: { patterns: ['squat', 'push', 'pull', 'core'], goal: null },
  legs: { patterns: ['squat', 'hinge', 'lunge', 'calf', 'core'], goal: null },
  upper: { patterns: ['push', 'pull', 'push', 'pull', 'core'], goal: null },
  cardio: { patterns: ['conditioning', 'conditioning', 'core'], goal: 'conditioning' },
}

// Build a one-off session (returns the same exercise shape as a generated day).
export function quickSession(kind, profile, catalog) {
  if (kind === 'empty') return []
  const def = QUICK_DEFS[kind]
  if (!def) return []
  const goal = def.goal || profile.goal || 'general'
  const scheme = GOAL_SCHEME[goal] || GOAL_SCHEME.general
  const allowedEquip = EQUIPMENT_SETS[profile.equipment] || EQUIPMENT_SETS.full_gym
  const diffCap = profile.experience === 'beginner' ? 2 : 3
  const usable = catalog.filter((e) => allowedEquip.includes(e.equipment) && e.difficulty <= diffCap)
  const byPattern = {}
  for (const e of usable) (byPattern[e.pattern] ||= []).push(e)
  for (const k in byPattern) byPattern[k] = shuffle(byPattern[k])

  const used = new Set()
  const out = []
  let pos = 0
  for (const pattern of def.patterns) {
    const pool = (byPattern[pattern] || []).filter((e) => !used.has(e.id))
    if (!pool.length) continue
    const ex = pool[0]
    used.add(ex.id)
    const isCompound = COMPOUND_PATTERNS.includes(pattern)
    const reps = pattern === 'conditioning' || pattern === 'core'
      ? ex.default_reps : (isCompound ? scheme.compoundReps : ex.default_reps)
    let sets = pattern === 'conditioning' ? 1 : (isCompound ? scheme.sets : Math.max(3, scheme.sets - 1))
    if (kind === 'short') sets = Math.max(2, sets - 1)
    out.push({
      exercise_id: ex.id, name: ex.name, muscle_group: ex.muscle_group, pattern: ex.pattern,
      description: ex.description || '', sets, reps, weight: estimateLoad(ex, profile, scheme),
      rest: pattern === 'conditioning' ? '1:00' : scheme.rest, tempo: scheme.tempo,
      video: ex.name, cues: ex.cues || [], position: pos++,
    })
  }
  return out
}

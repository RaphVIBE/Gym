import { useState, useEffect } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { c, ACCENT_DEFAULT, WEEKDAYS, todayWeekday, localDateStr, dateLabel } from './theme.js'
import { quickSession, QUICK_LABELS } from './coach.js'
import ProgramEditor from './ProgramEditor.jsx'

const CAT_CHIPS = ['TOUS', 'POUSSÉE', 'TIRAGE', 'JAMBES', 'ABDOS', 'CARDIO']
const CAT_PATTERNS = {
  'POUSSÉE': ['push'], 'TIRAGE': ['pull'], 'JAMBES': ['squat', 'hinge', 'lunge', 'calf'], 'ABDOS': ['core'], 'CARDIO': ['conditioning'],
}
const EXPRESS = [
  { kind: 'short', label: 'SÉANCE COURTE', desc: '~25 min, l’essentiel' },
  { kind: 'legs', label: 'FOCUS JAMBES', desc: 'Quadri, ischios, fessiers, mollets' },
  { kind: 'upper', label: 'HAUT DU CORPS', desc: 'Poussée + tirage' },
  { kind: 'cardio', label: 'CARDIO EXPRESS', desc: 'Condition & souffle' },
  { kind: 'empty', label: 'SÉANCE LIBRE', desc: 'Pars de zéro, ajoute tes exos' },
]
const ytSearch = (n) => window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(n + ' technique musculation'), '_blank', 'noopener')

const buildSetLog = (count, reps, weight) => Array.from({ length: Math.max(0, count || 0) }, () => ({ reps, weight, done: false }))

function weekRange(d = new Date()) {
  const wd = todayWeekday(d)
  const mon = new Date(d); mon.setDate(d.getDate() - wd); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { mon, sun }
}
function computeStreak(dateSet) {
  let streak = 0
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (!dateSet.has(localDateStr(d))) d.setDate(d.getDate() - 1)
  while (dateSet.has(localDateStr(d))) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

export default function MainApp({ session, profile, onReonboard, onSignOut }) {
  const uid = session.user.id
  const accent = profile.accent || ACCENT_DEFAULT
  const name = (profile.display_name || 'ATHLETE').toUpperCase()

  const [tab, setTab] = useState('home')
  const [overlay, setOverlay] = useState(null)
  const [selected, setSelected] = useState(0)
  const [variant, setVariant] = useState('focus')
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('TOUS')
  const [weight, setWeight] = useState('')
  const [addedName, setAddedName] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const [programId, setProgramId] = useState(null)
  const [programName, setProgramName] = useState('')
  const [programDays, setProgramDays] = useState([])
  const [templates, setTemplates] = useState([])     // non-rest days, startable any day
  const [suggestion, setSuggestion] = useState(null)  // today's weekday slot
  const [exercises, setExercises] = useState([])
  const [workoutId, setWorkoutId] = useState(null)
  const [sessionTitle, setSessionTitle] = useState('')
  const [weightHistory, setWeightHistory] = useState([])
  const [catalog, setCatalog] = useState([])
  const [recentDates, setRecentDates] = useState([])
  const [volumeRows, setVolumeRows] = useState([])
  const [copied, setCopied] = useState(false)
  const [programsList, setProgramsList] = useState([])
  const [sessionDayId, setSessionDayId] = useState(null)
  const [editorProgramId, setEditorProgramId] = useState(null)
  const [toast, setToast] = useState(null)
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1800) }

  const inviteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://belgium.netlify.app'
  const inviteMsg = `Rejoins-moi sur Pulse Gym, mon app d'entraînement 💪\n${inviteUrl}`
  const shareWhatsApp = () => window.open('https://wa.me/?text=' + encodeURIComponent(inviteMsg), '_blank', 'noopener')
  const shareEmail = () => { window.location.href = 'mailto:?subject=' + encodeURIComponent('Rejoins-moi sur Pulse Gym') + '&body=' + encodeURIComponent(inviteMsg) }
  const copyLink = async () => { try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard unavailable */ } }

  const todayStr = localDateStr()
  const wd = todayWeekday()
  const started = !!workoutId

  const mapWO = (r) => ({
    woExId: r.id, day_exercise_id: r.day_exercise_id, name: r.name, group: r.muscle_group,
    sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest, tempo: r.tempo, video: r.video,
    cues: r.cues || [], description: r.description || '', pattern: r.pattern || '', completed: r.completed,
    setLog: Array.isArray(r.set_log) && r.set_log.length ? r.set_log : buildSetLog(r.sets, r.reps, r.weight),
  })
  const planFromDE = (r) => ({
    day_exercise_id: r.id, name: r.name, group: r.muscle_group, pattern: r.pattern || '', description: r.description || '',
    sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest, tempo: r.tempo, video: r.video, cues: r.cues || [],
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      const since = new Date(); since.setDate(since.getDate() - 56)
      const [progRes, progAllRes, catRes, wRes, recRes] = await Promise.all([
        supabase.from('programs').select('id,name').eq('user_id', uid).eq('is_active', true).maybeSingle(),
        supabase.from('programs').select('id,name,is_active').eq('user_id', uid).order('created_at'),
        supabase.from('exercises').select('*'),
        supabase.from('weight_log').select('weight,logged_at').eq('user_id', uid).order('logged_at'),
        supabase.from('workouts').select('id, performed_on').eq('user_id', uid).gte('performed_on', localDateStr(since)),
      ])
      if (!active) return
      const prog = progRes.data
      let days = []
      if (prog) {
        const { data: dayRows } = await supabase.from('program_days').select('*').eq('program_id', prog.id).order('weekday')
        days = dayRows || []
        const ids = days.map((d) => d.id)
        let exByDay = {}
        if (ids.length) {
          const { data: exRows } = await supabase.from('day_exercises').select('*').in('program_day_id', ids).order('position')
          for (const e of exRows || []) (exByDay[e.program_day_id] ||= []).push(planFromDE(e))
        }
        days = days.map((d) => ({ ...d, exercises: exByDay[d.id] || [] }))
      }
      const tmpl = days.filter((d) => !d.is_rest)
      const sugg = days.find((d) => d.weekday === wd) || null

      const { data: wo } = await supabase
        .from('workouts').select('id, title, program_day_id, workout_exercises(*)').eq('user_id', uid).eq('performed_on', todayStr).maybeSingle()
      let exs = [], wid = null, stitle = '', sdid = null
      if (wo) {
        wid = wo.id; stitle = wo.title; sdid = wo.program_day_id
        exs = (wo.workout_exercises || []).slice().sort((x, y) => x.position - y.position).map(mapWO)
      }
      // logged sets across recent workouts → weekly volume
      const recentWk = recRes.data || []
      let volRows = []
      const woIds = recentWk.map((w) => w.id)
      if (woIds.length) {
        const { data: weRows } = await supabase.from('workout_exercises').select('workout_id, name, set_log').in('workout_id', woIds)
        const dateById = Object.fromEntries(recentWk.map((w) => [w.id, w.performed_on]))
        volRows = (weRows || []).map((r) => ({ date: dateById[r.workout_id], name: r.name, setLog: Array.isArray(r.set_log) ? r.set_log : [] }))
      }
      if (!active) return
      setVolumeRows(volRows)
      setProgramId(prog?.id || null)
      setProgramName(prog?.name || '')
      setProgramDays(days)
      setTemplates(tmpl)
      setSuggestion(sugg)
      setExercises(exs)
      setWorkoutId(wid)
      setSessionTitle(stitle)
      setSessionDayId(sdid)
      setProgramsList(progAllRes.data || [])
      if (wid && reloadKey === 0) setTab('train') // open straight into the active session

      setWeightHistory((wRes.data || []).map((r) => Number(r.weight)))
      setCatalog(catRes.data || [])
      setRecentDates((recRes.data || []).map((r) => r.performed_on))
      setLoading(false)
    })()
    return () => { active = false }
  }, [uid, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- start (or switch) today's session from a list ----
  const startSession = async (list, title, programDayId) => {
    if (workoutId) await supabase.from('workouts').delete().eq('id', workoutId)
    const { data: wo } = await supabase.from('workouts')
      .insert({ user_id: uid, program_day_id: programDayId ?? null, title, performed_on: todayStr })
      .select('id').single()
    if (!wo) return
    const norm = list.map((e, i) => ({
      day_exercise_id: e.day_exercise_id ?? null, name: e.name, group: e.group ?? e.muscle_group,
      pattern: e.pattern || '', description: e.description || '', sets: e.sets, reps: e.reps,
      weight: e.weight, rest: e.rest, tempo: e.tempo, video: e.video, cues: e.cues || [], position: i,
    }))
    let created = []
    if (norm.length) {
      const rows = norm.map((e) => ({
        workout_id: wo.id, user_id: uid, day_exercise_id: e.day_exercise_id, position: e.position,
        name: e.name, muscle_group: e.group, pattern: e.pattern, description: e.description,
        sets: e.sets, reps: e.reps, weight: e.weight, rest: e.rest, tempo: e.tempo, video: e.video, cues: e.cues,
        set_log: buildSetLog(e.sets, e.reps, e.weight), completed: false,
      }))
      const { data } = await supabase.from('workout_exercises').insert(rows).select()
      created = (data || []).slice().sort((x, y) => x.position - y.position)
    }
    setWorkoutId(wo.id)
    setSessionTitle(title)
    setSessionDayId(programDayId ?? null)
    setExercises(norm.map((e, i) => ({
      woExId: created[i]?.id ?? null, day_exercise_id: e.day_exercise_id, name: e.name, group: e.group,
      pattern: e.pattern, description: e.description, sets: e.sets, reps: e.reps, weight: e.weight,
      rest: e.rest, tempo: e.tempo, video: e.video, cues: e.cues, setLog: buildSetLog(e.sets, e.reps, e.weight), completed: false,
    })))
    setRecentDates((d) => (d.includes(todayStr) ? d : [...d, todayStr]))
    setVariant('focus'); setOverlay(null); setTab('train')
  }

  const startTemplate = (t) => startSession(t.exercises, t.title, t.id)
  const startQuick = (kind) => startSession(quickSession(kind, profile, catalog), QUICK_LABELS[kind], null)

  const toggle = async (i) => {
    const ex = exercises[i]
    if (!ex) return
    const next = !ex.completed
    const setLog = (ex.setLog || []).map((s) => ({ ...s, done: next }))
    setExercises((list) => list.map((e, k) => (k === i ? { ...e, completed: next, setLog } : e)))
    if (ex.woExId) await supabase.from('workout_exercises').update({ completed: next, set_log: setLog }).eq('id', ex.woExId)
  }

  // ---- per-set logging (reps + load) ----
  const setSetField = (exIndex, setIndex, field, value, persist) => {
    const ex = exercises[exIndex]
    if (!ex) return
    const setLog = (ex.setLog || []).map((s, k) => (k === setIndex ? { ...s, [field]: value } : s))
    const completed = setLog.length > 0 && setLog.every((s) => s.done)
    setExercises((list) => list.map((e, i) => (i === exIndex ? { ...e, setLog, completed } : e)))
    if (persist && ex.woExId) supabase.from('workout_exercises').update({ set_log: setLog, completed }).eq('id', ex.woExId).then(() => {})
  }
  const persistExercise = (exIndex) => {
    const e = exercises[exIndex]
    if (e?.woExId) supabase.from('workout_exercises').update({ set_log: e.setLog, completed: e.completed }).eq('id', e.woExId).then(() => {})
  }

  // ---- edit the live session ----
  const removeExercise = async (i) => {
    const ex = exercises[i]
    setExercises((list) => list.filter((_, k) => k !== i))
    setOverlay(null)
    setSelected((s) => Math.max(0, s > i ? s - 1 : s))
    if (ex?.woExId) await supabase.from('workout_exercises').delete().eq('id', ex.woExId)
  }
  const addSet = (i) => {
    const ex = exercises[i]
    if (!ex) return
    const last = ex.setLog[ex.setLog.length - 1] || { reps: ex.reps, weight: ex.weight }
    const setLog = [...ex.setLog, { reps: last.reps, weight: last.weight, done: false }]
    setExercises((list) => list.map((e, k) => (k === i ? { ...e, setLog, sets: setLog.length, completed: false } : e)))
    if (ex.woExId) supabase.from('workout_exercises').update({ set_log: setLog, sets: setLog.length, completed: false }).eq('id', ex.woExId).then(() => {})
  }
  const removeSet = (i) => {
    const ex = exercises[i]
    if (!ex || ex.setLog.length <= 1) return
    const setLog = ex.setLog.slice(0, -1)
    const completed = setLog.every((s) => s.done)
    setExercises((list) => list.map((e, k) => (k === i ? { ...e, setLog, sets: setLog.length, completed } : e)))
    if (ex.woExId) supabase.from('workout_exercises').update({ set_log: setLog, sets: setLog.length, completed }).eq('id', ex.woExId).then(() => {})
  }

  const addFromCatalog = async (ex) => {
    setOverlay(null); setAddedName(ex.name)
    setTimeout(() => setAddedName(null), 1800)
    const w0 = ex.equipment === 'bodyweight' ? 'BW' : '—'
    const sl = buildSetLog(3, ex.default_reps, w0)
    const { data } = await supabase.from('workout_exercises').insert({
      workout_id: workoutId, user_id: uid, position: exercises.length, name: ex.name, muscle_group: ex.muscle_group,
      pattern: ex.pattern || '', description: ex.description || '',
      sets: 3, reps: ex.default_reps, weight: w0, rest: '1:30', tempo: '2-1-1', video: ex.name, cues: ex.cues || [], set_log: sl, completed: false,
    }).select('id').single()
    setExercises((l) => [...l, {
      woExId: data?.id ?? null, day_exercise_id: null, name: ex.name, group: ex.muscle_group, pattern: ex.pattern || '',
      description: ex.description || '', sets: 3, reps: ex.default_reps, weight: w0,
      rest: '1:30', tempo: '2-1-1', video: ex.name, cues: ex.cues || [], setLog: sl, completed: false,
    }])
  }

  const saveWeight = async () => {
    const w = parseFloat(weight)
    if (isNaN(w)) { setOverlay(null); return }
    setWeightHistory((h) => [...h, w])
    setOverlay(null)
    await supabase.from('weight_log').insert({ user_id: uid, weight: w })
  }

  // ---- session-level actions ----
  const resetSession = async () => {
    setOverlay(null)
    const cleared = exercises.map((e) => ({ ...e, completed: false, setLog: (e.setLog || []).map((s) => ({ ...s, done: false })) }))
    setExercises(cleared)
    await Promise.all(cleared.filter((e) => e.woExId).map((e) =>
      supabase.from('workout_exercises').update({ completed: false, set_log: e.setLog }).eq('id', e.woExId),
    ))
  }
  const deleteSession = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Supprimer la séance du jour ? Les données saisies seront perdues.')) return
    const wid = workoutId
    setOverlay(null)
    setWorkoutId(null); setSessionTitle(''); setExercises([]); setSessionDayId(null)
    setRecentDates((d) => d.filter((x) => x !== todayStr))
    if (wid) await supabase.from('workouts').delete().eq('id', wid)
  }
  // save the current session back into its program day (overwrite the template)
  const saveSessionToProgram = async () => {
    if (!sessionDayId) return
    setOverlay(null)
    await supabase.from('day_exercises').delete().eq('program_day_id', sessionDayId)
    const rows = exercises.map((e, i) => ({
      program_day_id: sessionDayId, user_id: uid, position: i, exercise_id: null,
      name: e.name, muscle_group: e.group, pattern: e.pattern || '', description: e.description || '',
      sets: e.sets, reps: e.reps, weight: e.weight, rest: e.rest, tempo: e.tempo, video: e.video, cues: e.cues,
    }))
    if (rows.length) await supabase.from('day_exercises').insert(rows)
    flash('Séance enregistrée dans le programme')
  }
  const activateProgram = async (pid) => {
    await supabase.from('programs').update({ is_active: false }).eq('user_id', uid).eq('is_active', true)
    await supabase.from('programs').update({ is_active: true }).eq('id', pid)
    setReloadKey((k) => k + 1)
  }

  // ---- guided session: advance exercise by exercise ----
  const goPrev = () => setSelected((s) => Math.max(0, s - 1))
  const goNext = () => setSelected((s) => Math.min(exercises.length - 1, s + 1))
  const primaryCta = async () => {
    const cur = exercises[selected]
    if (cur && !cur.completed) await toggle(selected)
    const pending = exercises.map((e, i) => ({ i, done: i === selected ? true : e.completed })).filter((x) => !x.done).map((x) => x.i)
    if (pending.length === 0) { setOverlay('done'); return }
    setSelected(pending.find((i) => i > selected) ?? pending[0])
  }

  const goTab = (t) => { setTab(t); setOverlay(null) }
  const openStart = () => setOverlay('start')
  const openDetail = (i) => { setSelected(i); setOverlay('detail') }
  const openAdd = () => { setOverlay('add'); setSearch(''); setCat('TOUS') }
  const openLog = () => { setOverlay('logweight'); setWeight(weightHistory.length ? String(weightHistory[weightHistory.length - 1]) : (profile.bodyweight ? String(profile.bodyweight) : '')) }
  const closeOverlay = () => setOverlay(null)

  if (loading) {
    return (
      <PhoneFrame>
        <div style={{ height: '100%', background: '#0A0A0A', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontFamily: c.bebas, fontSize: 40, letterSpacing: 2, color: accent }}>PULSE</div>
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: accent, animation: 'spin .8s linear infinite' }} />
        </div>
      </PhoneFrame>
    )
  }

  if (showEditor) {
    return (
      <ProgramEditor
        uid={uid} accent={accent} programId={editorProgramId || programId} catalog={catalog}
        onClose={() => { setShowEditor(false); setEditorProgramId(null); setReloadKey((k) => k + 1) }}
        onReonboard={onReonboard}
      />
    )
  }

  // ---- derived ----
  const suggIsRest = !suggestion || suggestion.is_rest
  const title = sessionTitle || ''
  const titleLines = title.split(' ')
  const total = exercises.length
  const done = exercises.filter((e) => e.completed).length
  const pct = total ? done / total : 0
  const exs = exercises.map((ex, i) => ({
    ...ex, scheme: ex.sets + ' × ' + ex.reps, pending: !ex.completed,
    num: String(i + 1).padStart(2, '0'),
    numColor: ex.completed ? accent : 'rgba(255,255,255,0.22)',
    nameColor: ex.completed ? 'rgba(255,255,255,0.4)' : '#fff', i,
  }))

  const ringCirc = 2 * Math.PI * 30
  const ringOffset = ringCirc * (1 - pct)

  const { mon } = weekRange()
  const weekDoneWeekdays = new Set()
  for (const ds of recentDates) {
    const d = new Date(ds + 'T00:00:00')
    if (d >= mon) weekDoneWeekdays.add(todayWeekday(d))
  }
  const week = programDays.map((d) => {
    const st = d.weekday === wd ? 'today' : (weekDoneWeekdays.has(d.weekday) ? 'done' : (d.is_rest ? 'rest' : 'next'))
    return {
      day: WEEKDAYS[d.weekday], focus: d.is_rest ? 'REPOS' : d.title,
      dayColor: st === 'today' ? accent : (d.is_rest ? 'rgba(255,255,255,0.3)' : '#fff'),
      focusColor: d.is_rest ? 'rgba(255,255,255,0.3)' : (st === 'today' ? '#fff' : 'rgba(255,255,255,0.7)'),
      stateColor: st === 'today' ? accent : (st === 'done' ? accent : 'rgba(255,255,255,0.35)'),
      stateLabel: st === 'today' ? 'AUJ.' : (st === 'done' ? 'FAIT' : (d.is_rest ? 'REPOS' : 'SUGGÉRÉ')),
    }
  })

  const sel = exercises[selected] || exercises[0] || null
  const selSetLog = sel ? (sel.setLog && sel.setLog.length ? sel.setLog : buildSetLog(sel.sets, sel.reps, sel.weight)) : []
  const cellInput = { width: 74, boxSizing: 'border-box', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 6px', color: '#fff', fontFamily: c.bebas, fontSize: 18, textAlign: 'center', outline: 'none' }
  const otherPending = exercises.filter((e, i) => i !== selected && !e.completed).length
  const curDone = !!(sel && sel.completed)
  const ctaLabel = !curDone
    ? (otherPending === 0 ? '✓ TERMINER LA SÉANCE' : '✓ TERMINER & SUIVANT')
    : (otherPending === 0 ? 'SÉANCE TERMINÉE ▸' : 'EXERCICE SUIVANT ▸')
  const numAt = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n }
  const sessionVolume = exercises.reduce((tot, e) => tot + (e.setLog || []).reduce((s, st) => {
    const w = numAt(st.weight), r = numAt(st.reps); return s + (w != null && r != null ? w * r : 0)
  }, 0), 0)
  const doneCount = exercises.filter((e) => e.completed).length
  // distinct sessions of the active program (A, B, C…), deduped by title
  const sessions = (() => { const seen = {}, out = []; for (const t of templates) { if (!seen[t.title]) { seen[t.title] = 1; out.push(t) } } return out })()

  const hist = weightHistory
  const bodyWeight = hist.length ? hist[hist.length - 1] : (profile.bodyweight || 0)
  const chartPts = hist.length >= 2 ? hist : (hist.length === 1 ? [hist[0], hist[0]] : [])
  const md = chartPts.length ? chartPts[chartPts.length - 1] - chartPts[0] : 0
  const W = 300, H = 104
  let linePoints = '', areaPath = '', pts = []
  if (chartPts.length) {
    const mn = Math.min(...chartPts) - 0.4, mx = Math.max(...chartPts) + 0.4
    const span = mx - mn || 1
    pts = chartPts.map((v, i) => [
      +((i / (chartPts.length - 1)) * W).toFixed(1),
      +(H - ((v - mn) / span) * H).toFixed(1),
    ])
    linePoints = pts.map((p) => p.join(',')).join(' ')
    areaPath = 'M0,' + H + ' ' + pts.map((p) => 'L' + p[0] + ',' + p[1]).join(' ') + ' L' + W + ',' + H + ' Z'
  }

  const bars = []
  for (let i = 7; i >= 0; i--) {
    const ref = new Date(); ref.setDate(ref.getDate() - i * 7)
    const { mon: m, sun: s } = weekRange(ref)
    const count = recentDates.filter((ds) => { const d = new Date(ds + 'T00:00:00'); return d >= m && d <= s }).length
    bars.push({ count, label: 'S' + (8 - i) })
  }
  const maxBar = Math.max(5, ...bars.map((b) => b.count))
  const barViews = bars.map((b, i) => ({
    h: Math.round((b.count / maxBar) * 100) + '%', label: b.label,
    barColor: i === bars.length - 1 ? accent : 'rgba(255,255,255,0.18)',
  }))

  // weekly training volume (tonnage) from logged sets
  const volBars = []
  for (let i = 7; i >= 0; i--) {
    const ref = new Date(); ref.setDate(ref.getDate() - i * 7)
    const { mon: m, sun: s } = weekRange(ref)
    let vol = 0
    for (const r of volumeRows) {
      if (!r.date) continue
      const d = new Date(r.date + 'T00:00:00')
      if (d < m || d > s) continue
      for (const st of r.setLog || []) {
        const wv = parseFloat(String(st.weight).replace(',', '.'))
        const rv = parseFloat(String(st.reps))
        if (!isNaN(wv) && !isNaN(rv)) vol += wv * rv
      }
    }
    volBars.push({ vol, label: 'S' + (8 - i) })
  }
  const maxVol = Math.max(1, ...volBars.map((b) => b.vol))
  const volViews = volBars.map((b, i) => ({
    h: Math.round((b.vol / maxVol) * 100) + '%', label: b.label,
    barColor: i === volBars.length - 1 ? accent : 'rgba(255,255,255,0.18)',
  }))
  const volThisWeek = volBars[volBars.length - 1].vol
  const anyVol = volBars.some((b) => b.vol > 0)

  // best estimated 1RM per exercise (Epley) from logged sets
  const exBest = {}
  for (const r of volumeRows) {
    for (const st of r.setLog || []) {
      const w = parseFloat(String(st.weight).replace(',', '.'))
      const rp = parseFloat(String(st.reps))
      if (isNaN(w) || isNaN(rp) || w <= 0 || rp <= 0) continue
      const e1 = w * (1 + rp / 30)
      if (!exBest[r.name] || e1 > exBest[r.name].e1) exBest[r.name] = { e1, w, rp }
    }
  }
  const records = Object.entries(exBest)
    .map(([n, v]) => ({ name: n, e1: Math.round(v.e1), w: v.w, rp: v.rp }))
    .sort((a, b) => b.e1 - a.e1).slice(0, 6)

  const dateSet = new Set(recentDates)
  const streak = computeStreak(dateSet)
  const sessionsThisWeek = bars[bars.length - 1].count
  const sessions8wk = recentDates.length

  const progressTiles = [
    { label: 'SÉANCES · 8SEM', value: String(sessions8wk), unit: '' },
    { label: 'CETTE SEM.', value: String(sessionsThisWeek), unit: '' },
    { label: 'JOURS DE SUITE', value: String(streak), unit: '' },
  ]

  const q = search.toLowerCase()
  const wantPatterns = CAT_PATTERNS[cat]
  const library = catalog
    .filter((l) => (!wantPatterns || wantPatterns.includes(l.pattern)) && l.name.toLowerCase().includes(q))
    .slice(0, 60)
  const chips = CAT_CHIPS.map((ch) => ({
    label: ch, bg: cat === ch ? accent : 'transparent',
    color: cat === ch ? '#000' : 'rgba(255,255,255,0.55)', border: cat === ch ? accent : 'rgba(255,255,255,0.14)',
  }))

  const navColor = (t) => (tab === t ? accent : 'rgba(255,255,255,0.4)')
  const monthDeltaStr = (md >= 0 ? '+' : '') + md.toFixed(1) + ' kg'
  const monthDeltaColor = md <= 0 ? accent : '#FF5A3C'
  const sessionMin = Math.round(Math.max(total, 1) * 8.5)
  const progressPctStr = Math.round(pct * 100) + '%'

  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: '#0A0A0A', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}>
        <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

          {/* ============ ACCUEIL ============ */}
          {tab === 'home' && (
            <div style={{ padding: '60px 20px 130px', animation: 'fadeUp .4s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
                <div>
                  <div style={{ font: "600 13px 'Barlow Condensed'", letterSpacing: 3, color: 'rgba(255,255,255,0.45)' }}>{dateLabel()}</div>
                  <div style={{ fontFamily: c.bebas, fontSize: 46, lineHeight: 0.88, letterSpacing: 1, marginTop: 6 }}>PRÊT À<br />T'ENTRAÎNER, {name}</div>
                </div>
                <div onClick={() => setOverlay('menu')} style={{ width: 46, height: 46, borderRadius: '50%', background: '#171717', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 22, color: accent, flexShrink: 0, cursor: 'pointer' }}>{name.charAt(0)}</div>
              </div>

              {/* hero today card */}
              <div onClick={() => (started ? goTab('train') : openStart())} style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: '#101010', border: '1px solid ' + c.hair9, padding: 22, marginBottom: 20, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`, opacity: 0.12 }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: "700 12px 'Barlow Condensed'", letterSpacing: 2.5, color: accent }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />{started ? 'SÉANCE EN COURS' : 'SÉANCE DU JOUR'}</div>
                    <span style={{ fontFamily: c.bebas, fontSize: 22, color: 'rgba(255,255,255,0.3)' }}>→</span>
                  </div>
                  <div style={{ fontFamily: c.bebas, fontSize: 56, lineHeight: 0.84, margin: '16px 0 8px' }}>{started ? title : (suggIsRest ? 'À TOI DE JOUER' : suggestion.title)}</div>
                  <div style={{ font: "600 14px 'Barlow Condensed'", letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>
                    {started ? `${total} EXOS · ${sessionMin} MIN` : (suggIsRest ? 'Choisis ta séance — entraîne-toi quand tu veux' : `SUGGÉRÉ · ${suggestion.exercises.length} EXOS`)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
                    {started ? (
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: progressPctStr, background: accent, borderRadius: 3, transition: 'width .4s' }} />
                        </div>
                        <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginTop: 7 }}>{done}/{total} TERMINÉS</div>
                      </div>
                    ) : <div style={{ flex: 1 }} />}
                    <div style={{ background: accent, color: '#000', fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, padding: '11px 24px', borderRadius: 30 }}>{started ? 'CONTINUER ▸' : 'CHOISIR ▸'}</div>
                  </div>
                </div>
              </div>

              {/* quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
                <Stat value={String(sessionsThisWeek)} label="SÉANCES / SEM" />
                <Stat value={String(streak)} label="JOURS DE SUITE" color={accent} />
                <Stat value={bodyWeight ? bodyWeight.toFixed(1) : '—'} label="POIDS KG" />
              </div>

              {/* this week */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                <div style={{ fontFamily: c.bebas, fontSize: 26, letterSpacing: 1 }}>CETTE SEMAINE</div>
                <div onClick={() => setShowEditor(true)} style={{ font: "700 12px 'Barlow Condensed'", letterSpacing: 1.5, color: accent, cursor: 'pointer' }}>MODIFIER ›</div>
              </div>
              <div style={{ font: "500 12px 'Barlow Condensed'", letterSpacing: 0.5, color: c.faint, marginBottom: 4 }}>Créneaux suggérés — entraîne-toi le jour que tu veux.</div>
              {week.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid ' + c.hair }}>
                  <div style={{ width: 40, fontFamily: c.bebas, fontSize: 21, color: d.dayColor }}>{d.day}</div>
                  <div style={{ flex: 1, font: "600 15px 'Barlow Condensed'", letterSpacing: 0.5, color: d.focusColor }}>{d.focus}</div>
                  <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 1.5, color: d.stateColor }}>{d.stateLabel}</div>
                </div>
              ))}
            </div>
          )}

          {/* ============ SÉANCE ============ */}
          {tab === 'train' && (
            <div style={{ padding: '60px 0 130px', animation: 'fadeUp .4s' }}>
              <div style={{ padding: '0 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ font: "700 12px 'Barlow Condensed'", letterSpacing: 2.5, color: accent }}>{dateLabel()} · AUJOURD'HUI</div>
                  {started && <div onClick={() => setOverlay('sessionMenu')} style={{ cursor: 'pointer', padding: '0 6px', color: c.faint, fontSize: 24, lineHeight: 1, letterSpacing: 1 }}>⋯</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                  <div style={{ fontFamily: c.bebas, fontSize: 54, lineHeight: 0.82 }}>{started ? titleLines.map((l, k) => <span key={k}>{l}{k < titleLines.length - 1 && <br />}</span>) : 'SÉANCE'}</div>
                  {started && (
                    <svg width="78" height="78" viewBox="0 0 78 78" style={{ flexShrink: 0 }}>
                      <circle cx="39" cy="39" r="30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
                      <circle cx="39" cy="39" r="30" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={ringCirc.toFixed(1)} strokeDashoffset={ringOffset.toFixed(1)} transform="rotate(-90 39 39)" style={{ transition: 'stroke-dashoffset .5s' }} />
                      <text x="39" y="38" textAnchor="middle" fill="#fff" fontFamily="Bebas Neue" fontSize="22">{done}</text>
                      <text x="39" y="52" textAnchor="middle" fill={c.faint} fontFamily="Barlow Condensed" fontSize="11" letterSpacing="1">/ {total}</text>
                    </svg>
                  )}
                </div>
              </div>

              {!started && (
                <div style={{ padding: '40px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 40, color: c.faint }}>+</div>
                  <div style={{ textAlign: 'center', font: "500 14px 'Barlow Condensed'", letterSpacing: 0.5, color: c.faint }}>Aucune séance lancée aujourd'hui.<br />Choisis-en une pour commencer.</div>
                  <div onClick={openStart} style={{ background: accent, color: '#000', borderRadius: 30, padding: '14px 28px', fontFamily: c.bebas, fontSize: 22, letterSpacing: 1.5, cursor: 'pointer' }}>+ CHOISIR MA SÉANCE</div>
                </div>
              )}

              {started && (
                <>
                  <div style={{ display: 'flex', gap: 5, background: '#141414', borderRadius: 30, padding: 5, margin: '20px 20px', border: '1px solid ' + c.hair }}>
                    {['focus', 'list'].map((v) => (
                      <div key={v} onClick={() => setVariant(v)} style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 24, fontFamily: c.bebas, fontSize: 18, letterSpacing: 1.5, cursor: 'pointer', background: variant === v ? accent : 'transparent', color: variant === v ? '#000' : 'rgba(255,255,255,0.5)', transition: 'all .2s' }}>{v === 'focus' ? 'DÉTAIL' : 'LISTE'}</div>
                    ))}
                  </div>

                  {total === 0 && (
                    <div style={{ padding: '10px 20px 6px', textAlign: 'center', font: "500 14px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>Séance libre — ajoute tes exercices.</div>
                  )}

                  {variant === 'focus' && (
                    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {exs.map((ex) => (
                        <div key={ex.i} onClick={() => openDetail(ex.i)} style={{ position: 'relative', background: '#141414', border: '1px solid ' + c.hair7, borderRadius: 18, padding: 18, cursor: 'pointer', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                            <div style={{ fontFamily: c.bebas, fontSize: 42, lineHeight: 0.72, color: ex.numColor, width: 44, flexShrink: 0 }}>{ex.num}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: c.bebas, fontSize: 27, lineHeight: 0.92, color: ex.nameColor }}>{ex.name}</div>
                              <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint, marginTop: 4 }}>{ex.group}</div>
                            </div>
                            <Check completed={ex.completed} accent={accent} size={38} onClick={(e) => { e.stopPropagation(); toggle(ex.i) }} />
                          </div>
                          <div style={{ display: 'flex', gap: 22, marginTop: 16, paddingTop: 14, borderTop: '1px solid ' + c.hair }}>
                            <Metric value={ex.scheme} label="SÉRIES × RÉPS" />
                            <Metric value={ex.weight} label="CHARGE" />
                            <Metric value={ex.rest} label="REPOS" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {variant === 'list' && (
                    <div style={{ padding: '0 20px' }}>
                      {exs.map((ex) => (
                        <div key={ex.i} onClick={() => openDetail(ex.i)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderBottom: '1px solid ' + c.hair7, cursor: 'pointer' }}>
                          <Check completed={ex.completed} accent={accent} square onClick={(e) => { e.stopPropagation(); toggle(ex.i) }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ font: "600 18px 'Barlow Condensed'", letterSpacing: 0.3, lineHeight: 1.05, color: ex.nameColor }}>{ex.name}</div>
                            <div style={{ font: "500 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint, marginTop: 2 }}>{ex.group}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: c.bebas, fontSize: 23, lineHeight: 0.9 }}>{ex.scheme}</div>
                            <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>{ex.weight}</div>
                          </div>
                          <span style={{ fontFamily: c.bebas, fontSize: 18, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>›</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div onClick={openAdd} style={{ border: '1.5px dashed rgba(255,255,255,0.2)', borderRadius: 16, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 20, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>+ AJOUTER UN EXERCICE</div>
                    <div onClick={() => setOverlay('done')} style={{ background: accent, color: '#000', borderRadius: 30, padding: 15, textAlign: 'center', fontFamily: c.bebas, fontSize: 21, letterSpacing: 1.5, cursor: 'pointer' }}>FINIR LA SÉANCE ▸</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ STATS ============ */}
          {tab === 'stats' && (
            <div style={{ padding: '60px 20px 130px', animation: 'fadeUp .4s' }}>
              <div style={{ fontFamily: c.bebas, fontSize: 46, lineHeight: 0.86, letterSpacing: 1, marginBottom: 22 }}>PROGRESSION</div>

              <div style={{ background: '#101010', border: '1px solid ' + c.hair9, borderRadius: 22, padding: 22, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint45 }}>POIDS DE CORPS</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                      <span style={{ fontFamily: c.bebas, fontSize: 60, lineHeight: 0.8 }}>{bodyWeight ? bodyWeight.toFixed(1) : '—'}</span>
                      <span style={{ fontFamily: c.bebas, fontSize: 24, color: c.faint45 }}>KG</span>
                    </div>
                  </div>
                  {chartPts.length > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ font: "700 14px 'Barlow Condensed'", letterSpacing: 1, color: monthDeltaColor }}>{monthDeltaStr}</div>
                      <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>TENDANCE</div>
                    </div>
                  )}
                </div>
                {pts.length > 0 ? (
                  <svg viewBox="0 0 300 104" preserveAspectRatio="none" style={{ width: '100%', height: 104, marginTop: 14, overflow: 'visible' }}>
                    <path d={areaPath} fill={accent} fillOpacity="0.1" />
                    <polyline points={linePoints} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4.5" fill={accent} stroke="#101010" strokeWidth="2.5" />
                  </svg>
                ) : (
                  <div style={{ height: 90, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "500 13px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>Note ta première pesée pour voir la tendance</div>
                )}
                <div onClick={openLog} style={{ marginTop: 16, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 30, padding: 11, textAlign: 'center', fontFamily: c.bebas, fontSize: 18, letterSpacing: 1.5, cursor: 'pointer' }}>+ AJOUTER UNE PESÉE</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                {progressTiles.map((p, i) => (
                  <div key={i} style={{ background: '#141414', border: '1px solid ' + c.hair, borderRadius: 16, padding: '15px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontFamily: c.bebas, fontSize: 30, lineHeight: 0.9 }}>{p.value}</span>
                      <span style={{ font: "600 11px 'Barlow Condensed'", color: c.faint45 }}>{p.unit}</span>
                    </div>
                    <div style={{ font: "600 9px 'Barlow Condensed'", letterSpacing: 1, color: c.faint45, marginTop: 5 }}>{p.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 1, marginBottom: 12 }}>SÉANCES / SEMAINE</div>
              <div style={{ background: '#141414', border: '1px solid ' + c.hair, borderRadius: 18, padding: '18px 16px 12px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 7, height: 90 }}>
                  {barViews.map((b, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: b.h, minHeight: 2, borderRadius: 5, background: b.barColor, transition: 'height .4s' }} />
                      <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 0.5, color: 'rgba(255,255,255,0.35)' }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 1 }}>VOLUME / SEMAINE</div>
                <div style={{ font: "700 12px 'Barlow Condensed'", letterSpacing: 1, color: accent }}>{(volThisWeek / 1000).toFixed(1)} T CETTE SEM.</div>
              </div>
              <div style={{ background: '#141414', border: '1px solid ' + c.hair, borderRadius: 18, padding: '18px 16px 12px', marginBottom: 24 }}>
                {anyVol ? (
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 7, height: 90 }}>
                    {volViews.map((b, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', height: b.h, minHeight: 2, borderRadius: 5, background: b.barColor, transition: 'height .4s' }} />
                        <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 0.5, color: 'rgba(255,255,255,0.35)' }}>{b.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', font: "500 13px 'Barlow Condensed'", letterSpacing: 0.5, color: c.faint }}>Note tes charges pendant la séance pour suivre ton volume (séries × réps × poids).</div>
                )}
              </div>

              {records.length > 0 && (
                <>
                  <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 1, marginBottom: 12 }}>RECORDS · 1RM ESTIMÉ</div>
                  <div style={{ background: '#141414', border: '1px solid ' + c.hair, borderRadius: 18, overflow: 'hidden', marginBottom: 24 }}>
                    {records.map((r, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < records.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: "600 15px 'Barlow Condensed'", letterSpacing: 0.3 }}>{r.name}</div>
                          <div style={{ font: "500 10px 'Barlow Condensed'", letterSpacing: 1, color: c.faint, marginTop: 1 }}>MEILLEUR : {r.w} KG × {r.rp}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: c.bebas, fontSize: 24, color: accent, lineHeight: 0.9 }}>{r.e1}<span style={{ fontSize: 13, color: c.faint45 }}> KG</span></div>
                          <div style={{ font: "600 8px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>1RM EST.</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 1 }}>PHOTOS DE PROGRÈS</div>
                <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>TOUCHE POUR AJOUTER</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {['SEM 1', 'SEM 4', 'SEM 8'].map((ph, i) => (<PhotoSlot key={i} label={ph} />))}
              </div>
            </div>
          )}
          {/* ============ PROGRAMMES ============ */}
          {tab === 'programs' && (
            <div style={{ padding: '60px 20px 130px', animation: 'fadeUp .4s' }}>
              <div style={{ fontFamily: c.bebas, fontSize: 46, lineHeight: 0.86, letterSpacing: 1, marginBottom: 6 }}>PROGRAMMES</div>
              <div style={{ font: "500 13px 'Barlow Condensed'", letterSpacing: 0.3, color: c.faint, marginBottom: 20 }}>Tes plans, suggérés par le coach. Active, modifie ou crée-en un nouveau.</div>

              {programsList.map((p) => (
                <div key={p.id} style={{ background: '#101010', border: '1px solid ' + (p.is_active ? accent : c.hair9), borderRadius: 18, padding: 18, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: c.bebas, fontSize: 26, letterSpacing: 0.5 }}>{p.name}</div>
                    {p.is_active && <div style={{ font: "700 9px 'Barlow Condensed'", letterSpacing: 1.5, color: '#000', background: accent, borderRadius: 20, padding: '3px 10px' }}>ACTIF</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    {!p.is_active && <div onClick={() => activateProgram(p.id)} style={{ flex: 1, textAlign: 'center', background: accent, color: '#000', borderRadius: 12, padding: '10px', fontFamily: c.bebas, fontSize: 16, letterSpacing: 1, cursor: 'pointer' }}>ACTIVER</div>}
                    <div onClick={() => { setEditorProgramId(p.id); setShowEditor(true) }} style={{ flex: 1, textAlign: 'center', background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px', fontFamily: c.bebas, fontSize: 16, letterSpacing: 1, cursor: 'pointer' }}>MODIFIER</div>
                  </div>
                </div>
              ))}

              <div onClick={onReonboard} style={{ border: '1.5px dashed rgba(255,255,255,0.2)', borderRadius: 16, padding: 15, textAlign: 'center', fontFamily: c.bebas, fontSize: 18, letterSpacing: 1.5, color: accent, cursor: 'pointer', marginBottom: 28 }}>+ NOUVEAU PROGRAMME (COACH)</div>

              {sessions.length > 0 && (
                <>
                  <div style={{ fontFamily: c.bebas, fontSize: 26, letterSpacing: 1, marginBottom: 4 }}>SÉANCES</div>
                  <div style={{ font: "500 12px 'Barlow Condensed'", letterSpacing: 0.3, color: c.faint, marginBottom: 10 }}>Du programme actif{programName ? ' · ' + programName : ''}.</div>
                  {sessions.map((s, i) => (
                    <div key={s.id} onClick={() => { setEditorProgramId(programId); setShowEditor(true) }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid ' + c.hair, cursor: 'pointer' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: '#1f1f1f', border: '1px solid ' + c.hair9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 20, color: accent, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 0.3 }}>{s.title}</div>
                        <div style={{ font: "500 11px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>{s.focus} · {s.exercises.length} exos</div>
                      </div>
                      <span style={{ fontFamily: c.bebas, fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>›</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* ============ TOAST ============ */}
        {(addedName || toast) && (
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 108, zIndex: 75, background: accent, color: '#000', borderRadius: 16, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'fadeUp .3s' }}>
            <span style={{ fontFamily: c.bebas, fontSize: 18, letterSpacing: 1 }}>{toast ? toast.toUpperCase() : 'AJOUTÉ À LA SÉANCE'}</span>
            {!toast && <span style={{ font: "700 13px 'Barlow Condensed'", letterSpacing: 0.5 }}>{addedName}</span>}
          </div>
        )}

        {/* ============ BOTTOM NAV ============ */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 70, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '13px 22px 30px', display: 'flex', justifyContent: 'space-between' }}>
          <NavItem onClick={() => goTab('home')} color={navColor('home')} label="ACCUEIL">
            <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </NavItem>
          <NavItem onClick={() => goTab('train')} color={navColor('train')} label="SÉANCE" cap>
            <line x1="4" y1="9" x2="4" y2="15" /><line x1="7" y1="6" x2="7" y2="18" /><line x1="17" y1="6" x2="17" y2="18" /><line x1="20" y1="9" x2="20" y2="15" /><line x1="7" y1="12" x2="17" y2="12" />
          </NavItem>
          <NavItem onClick={() => goTab('programs')} color={navColor('programs')} label="PROGRAMMES" cap>
            <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><line x1="4.5" y1="6" x2="4.5" y2="6" /><line x1="4.5" y1="12" x2="4.5" y2="12" /><line x1="4.5" y1="18" x2="4.5" y2="18" />
          </NavItem>
          <NavItem onClick={() => goTab('stats')} color={navColor('stats')} label="STATS" cap>
            <line x1="5" y1="20" x2="5" y2="13" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="19" y1="20" x2="19" y2="10" />
          </NavItem>
        </div>

        {/* ============ START PICKER ============ */}
        {overlay === 'start' && (
          <div onClick={closeOverlay} style={{ position: 'absolute', inset: 0, zIndex: 88, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', animation: 'overlayIn .25s' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '88%', overflowY: 'auto', boxSizing: 'border-box', background: '#161616', borderRadius: '26px 26px 0 0', padding: '20px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp .3s' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />
              <div style={{ fontFamily: c.bebas, fontSize: 32, letterSpacing: 0.5, marginBottom: 16 }}>DÉMARRER UNE SÉANCE</div>

              {suggestion && !suggestion.is_rest && (
                <div onClick={() => startTemplate(suggestion)} style={{ background: accent, color: '#000', borderRadius: 16, padding: '15px 18px', marginBottom: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ font: "700 10px 'Barlow Condensed'", letterSpacing: 1.5, opacity: 0.65 }}>SUGGÉRÉ AUJOURD'HUI</div>
                    <div style={{ fontFamily: c.bebas, fontSize: 26, letterSpacing: 0.5 }}>{suggestion.title}</div>
                    <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1, opacity: 0.7 }}>{suggestion.exercises.length} EXERCICES</div>
                  </div>
                  <span style={{ fontFamily: c.bebas, fontSize: 30 }}>▸</span>
                </div>
              )}

              {templates.length > 0 && (
                <>
                  <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint, margin: '6px 0 8px' }}>TON PROGRAMME</div>
                  {templates.map((t, i) => (
                    <div key={t.id} onClick={() => startTemplate(t)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid ' + c.hair, cursor: 'pointer' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: '#1f1f1f', border: '1px solid ' + c.hair9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 18, color: accent, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 0.3 }}>{t.title}</div>
                        <div style={{ font: "500 11px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>{t.focus} · {t.exercises.length} exos</div>
                      </div>
                      <span style={{ fontFamily: c.bebas, fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>▸</span>
                    </div>
                  ))}
                </>
              )}

              <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint, margin: '18px 0 8px' }}>SÉANCES EXPRESS</div>
              {EXPRESS.map((e) => (
                <div key={e.kind} onClick={() => startQuick(e.kind)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid ' + c.hair, cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 0.3 }}>{e.label}</div>
                    <div style={{ font: "500 11px 'Barlow Condensed'", letterSpacing: 0.5, color: c.faint }}>{e.desc}</div>
                  </div>
                  <span style={{ fontFamily: c.bebas, fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>▸</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ DÉTAIL EXERCICE ============ */}
        {overlay === 'detail' && sel && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 85, background: '#0A0A0A', overflowY: 'auto', animation: 'overlayIn .25s' }}>
            <div style={{ position: 'relative', height: 250, background: 'radial-gradient(circle at 50% 35%, #15170d 0%, #0d0d0d 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid ' + c.hair9 }}>
              <div onClick={closeOverlay} style={{ position: 'absolute', top: 54, left: 18, width: 42, height: 42, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
                <BackArrow />
              </div>
              <Schematic pattern={sel.pattern} accent={accent} />
              <div style={{ position: 'absolute', bottom: 14, left: 20, right: 20, textAlign: 'center', font: "700 10px 'Barlow Condensed'", letterSpacing: 2.5, color: 'rgba(255,255,255,0.4)' }}>SCHÉMA DU MOUVEMENT</div>
            </div>

            <div style={{ padding: '22px 20px 130px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div onClick={goPrev} style={{ width: 34, height: 34, borderRadius: '50%', background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 22, color: '#fff', cursor: 'pointer', opacity: selected > 0 ? 1 : 0.3 }}>‹</div>
                <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint }}>EXERCICE {selected + 1} / {total}</div>
                <div onClick={goNext} style={{ width: 34, height: 34, borderRadius: '50%', background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 22, color: '#fff', cursor: 'pointer', opacity: selected < total - 1 ? 1 : 0.3 }}>›</div>
              </div>
              <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: accent }}>{sel.group}</div>
              <div style={{ fontFamily: c.bebas, fontSize: 48, lineHeight: 0.86, letterSpacing: 0.5, marginTop: 4 }}>{sel.name}</div>

              <div onClick={() => ytSearch(sel.name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 16, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 30, padding: '13px', cursor: 'pointer' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#FF0000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="12" viewBox="0 0 11 12"><path d="M1 1l9 5-9 5z" fill="#fff" /></svg>
                </span>
                <span style={{ fontFamily: c.bebas, fontSize: 19, letterSpacing: 1 }}>VOIR LA DÉMO SUR YOUTUBE</span>
              </div>

              {sel.description && (
                <>
                  <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, margin: '24px 0 8px' }}>EXPLICATION</div>
                  <div style={{ font: "500 15px 'Barlow Condensed'", letterSpacing: 0.2, color: 'rgba(255,255,255,0.82)', lineHeight: 1.4 }}>{sel.description}</div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 20 }}>
                <KeyMetric value={String(sel.sets)} label="SÉRIES" />
                <KeyMetric value={sel.reps} label="RÉPS" />
                <KeyMetric value={sel.weight} label="CHARGE" />
                <KeyMetric value={sel.tempo} label="TEMPO" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '24px 0 8px' }}>
                <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 1 }}>JOURNAL DES SÉRIES</div>
                <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>NOTE TES CHARGES</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px 8px' }}>
                <div style={{ flex: 1, font: "700 9px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>SÉRIE</div>
                <div style={{ width: 74, textAlign: 'center', font: "700 9px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>RÉPS</div>
                <div style={{ width: 74, textAlign: 'center', font: "700 9px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>POIDS</div>
                <div style={{ width: 30 }} />
              </div>
              <div style={{ background: '#141414', borderRadius: 16, overflow: 'hidden' }}>
                {selSetLog.map((st, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ flex: 1, font: "700 14px 'Barlow Condensed'", letterSpacing: 1, color: st.done ? accent : 'rgba(255,255,255,0.55)' }}>SÉRIE {i + 1}</div>
                    <input value={st.reps ?? ''} onChange={(e) => setSetField(selected, i, 'reps', e.target.value, false)} onBlur={() => persistExercise(selected)} style={cellInput} />
                    <input value={st.weight ?? ''} onChange={(e) => setSetField(selected, i, 'weight', e.target.value, false)} onBlur={() => persistExercise(selected)} style={cellInput} />
                    <div onClick={() => setSetField(selected, i, 'done', !st.done, true)} style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: st.done ? accent : 'transparent', border: '1.5px solid ' + (st.done ? accent : 'rgba(255,255,255,0.2)') }}>
                      {st.done && <svg width="15" height="15" viewBox="0 0 18 18"><path d="M3 9.5l4 4 8-9" fill="none" stroke="#000" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <div onClick={() => removeSet(selected)} style={{ flex: 1, textAlign: 'center', background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '11px', fontFamily: c.bebas, fontSize: 17, letterSpacing: 1, color: selSetLog.length > 1 ? '#fff' : 'rgba(255,255,255,0.25)', cursor: selSetLog.length > 1 ? 'pointer' : 'default' }}>− SÉRIE</div>
                <div onClick={() => addSet(selected)} style={{ flex: 1, textAlign: 'center', background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '11px', fontFamily: c.bebas, fontSize: 17, letterSpacing: 1, color: accent, cursor: 'pointer' }}>+ SÉRIE (INTENSIFIER)</div>
              </div>

              <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, margin: '24px 0 10px' }}>CONSEILS D'EXÉCUTION</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {(sel.cues || []).map((cue, i) => (
                  <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ font: "500 15px 'Barlow Condensed'", letterSpacing: 0.3, color: 'rgba(255,255,255,0.8)', lineHeight: 1.25 }}>{cue}</div>
                  </div>
                ))}
              </div>
              <div onClick={() => removeExercise(selected)} style={{ marginTop: 26, textAlign: 'center', font: "700 12px 'Barlow Condensed'", letterSpacing: 1.5, color: '#FF5A3C', cursor: 'pointer' }}>RETIRER DE LA SÉANCE</div>
            </div>

            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px 26px', background: 'linear-gradient(transparent,#0A0A0A 28%)' }}>
              <div onClick={primaryCta} style={{ background: accent, color: '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 22, letterSpacing: 2, cursor: 'pointer' }}>{ctaLabel}</div>
              {curDone && <div onClick={() => toggle(selected)} style={{ marginTop: 8, textAlign: 'center', font: "700 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint, cursor: 'pointer' }}>DÉCOCHER CET EXERCICE</div>}
            </div>
          </div>
        )}

        {/* ============ MENU SÉANCE (⋯) ============ */}
        {overlay === 'sessionMenu' && (
          <div onClick={closeOverlay} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', animation: 'overlayIn .25s' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', background: '#161616', borderRadius: '26px 26px 0 0', padding: '24px 20px 40px', borderTop: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp .3s' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 14px' }} />
              <div style={{ fontFamily: c.bebas, fontSize: 28, letterSpacing: 0.5, marginBottom: 8 }}>{sessionTitle || 'SÉANCE'}</div>
              <MenuRow label="REMETTRE À ZÉRO" onClick={resetSession} accent={accent} />
              {sessionDayId && <MenuRow label="ENREGISTRER DANS LE PROGRAMME" onClick={saveSessionToProgram} accent={accent} />}
              <MenuRow label="CHANGER DE SÉANCE" onClick={() => setOverlay('start')} accent={accent} />
              <MenuRow label="SUPPRIMER LA SÉANCE" onClick={deleteSession} danger />
            </div>
          </div>
        )}

        {/* ============ SÉANCE TERMINÉE ============ */}
        {overlay === 'done' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 92, background: '#0A0A0A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', animation: 'overlayIn .25s' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, animation: 'popIn .4s' }}>
              <svg width="40" height="40" viewBox="0 0 18 18"><path d="M3 9.5l4 4 8-9" fill="none" stroke="#000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ fontFamily: c.bebas, fontSize: 52, lineHeight: 0.9, letterSpacing: 1 }}>SÉANCE<br />TERMINÉE</div>
            <div style={{ font: "600 13px 'Barlow Condensed'", letterSpacing: 1, color: c.faint, marginTop: 14 }}>{title}</div>
            <div style={{ display: 'flex', gap: 28, marginTop: 26 }}>
              <div><div style={{ fontFamily: c.bebas, fontSize: 40, color: accent }}>{doneCount}/{total}</div><div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>EXERCICES</div></div>
              <div><div style={{ fontFamily: c.bebas, fontSize: 40 }}>{(sessionVolume / 1000).toFixed(1)}<span style={{ fontSize: 20, color: c.faint45 }}> T</span></div><div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>VOLUME</div></div>
            </div>
            <div onClick={() => { setOverlay(null); setTab('home') }} style={{ marginTop: 36, background: accent, color: '#000', borderRadius: 30, padding: '15px 44px', fontFamily: c.bebas, fontSize: 22, letterSpacing: 2, cursor: 'pointer' }}>TERMINER ▸</div>
            <div onClick={() => { setOverlay(null); setTab('train') }} style={{ marginTop: 14, font: "700 12px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint, cursor: 'pointer' }}>REVOIR LA SÉANCE</div>
          </div>
        )}

        {/* ============ AJOUTER UN EXERCICE ============ */}
        {overlay === 'add' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 85, background: '#0A0A0A', overflowY: 'auto', animation: 'overlayIn .25s' }}>
            <div style={{ padding: '54px 20px 14px', position: 'sticky', top: 0, background: '#0A0A0A', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div onClick={closeOverlay} style={{ width: 40, height: 40, borderRadius: '50%', background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <BackArrow />
                </div>
                <div style={{ fontFamily: c.bebas, fontSize: 34, letterSpacing: 1 }}>AJOUTER UN EXERCICE</div>
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un exercice…" style={{ width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: '#fff', fontFamily: "'Barlow Condensed'", fontSize: 16, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 7, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
                {chips.map((ch, i) => (
                  <div key={i} onClick={() => setCat(ch.label)} style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 30, fontFamily: c.bebas, fontSize: 15, letterSpacing: 1, cursor: 'pointer', background: ch.bg, color: ch.color, border: '1px solid ' + ch.border }}>{ch.label}</div>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 20px 40px' }}>
              {library.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', font: "500 14px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>AUCUN EXERCICE TROUVÉ</div>
              )}
              {library.map((lib) => (
                <div key={lib.id} onClick={() => addFromCatalog(lib)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: '1px solid ' + c.hair7, cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 18px 'Barlow Condensed'", letterSpacing: 0.3, lineHeight: 1.05 }}>{lib.name}</div>
                    <div style={{ font: "500 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint, marginTop: 2 }}>{lib.muscle_group} · {lib.equipment}</div>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="#000" strokeWidth="2.4" strokeLinecap="round" /></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ PESÉE ============ */}
        {overlay === 'logweight' && (
          <div onClick={closeOverlay} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', animation: 'overlayIn .25s' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', background: '#161616', borderRadius: '26px 26px 0 0', padding: '24px 20px 40px', borderTop: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp .3s' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 20px' }} />
              <div style={{ fontFamily: c.bebas, fontSize: 30, letterSpacing: 1, marginBottom: 18 }}>AJOUTER UNE PESÉE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, background: '#0e0e0e', borderRadius: 16, padding: '18px 20px', marginBottom: 18 }}>
                <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: c.bebas, fontSize: 44, width: '100%' }} />
                <span style={{ fontFamily: c.bebas, fontSize: 26, color: c.faint }}>KG</span>
              </div>
              <div onClick={saveWeight} style={{ background: accent, color: '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 22, letterSpacing: 2, cursor: 'pointer' }}>ENREGISTRER</div>
            </div>
          </div>
        )}

        {/* ============ MENU COMPTE ============ */}
        {overlay === 'menu' && (
          <div onClick={closeOverlay} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', animation: 'overlayIn .25s' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', background: '#161616', borderRadius: '26px 26px 0 0', padding: '24px 20px 40px', borderTop: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp .3s' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />
              <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint }}>{session.user.email}</div>
              <div style={{ fontFamily: c.bebas, fontSize: 30, letterSpacing: 0.5, marginTop: 2, marginBottom: 18 }}>{programName || 'AUCUN PROGRAMME'}</div>
              {started && <MenuRow label="CHANGER DE SÉANCE" onClick={() => setOverlay('start')} accent={accent} />}
              <MenuRow label="MODIFIER LE PROGRAMME" onClick={() => { setOverlay(null); setShowEditor(true) }} accent={accent} />
              <MenuRow label="REGÉNÉRER AVEC LE COACH" onClick={() => { setOverlay(null); onReonboard() }} accent={accent} />
              <MenuRow label="INVITER UN AMI" onClick={() => setOverlay('invite')} accent={accent} />
              <MenuRow label="DÉCONNEXION" onClick={onSignOut} danger />
            </div>
          </div>
        )}

        {/* ============ INVITER UN AMI ============ */}
        {overlay === 'invite' && (
          <div onClick={closeOverlay} style={{ position: 'absolute', inset: 0, zIndex: 92, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', animation: 'overlayIn .25s' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', background: '#161616', borderRadius: '26px 26px 0 0', padding: '24px 20px 40px', borderTop: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp .3s' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />
              <div style={{ fontFamily: c.bebas, fontSize: 32, letterSpacing: 0.5 }}>INVITER UN AMI</div>
              <div style={{ font: "500 13px 'Barlow Condensed'", letterSpacing: 0.3, color: c.faint, marginTop: 4, marginBottom: 18 }}>Partage Pulse Gym et entraînez-vous ensemble.</div>

              <div onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', marginBottom: 16, cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0, font: "500 14px 'Barlow Condensed'", letterSpacing: 0.3, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteUrl.replace(/^https?:\/\//, '')}</div>
                <div style={{ flexShrink: 0, fontFamily: c.bebas, fontSize: 16, letterSpacing: 1, color: copied ? accent : 'rgba(255,255,255,0.6)' }}>{copied ? 'COPIÉ ✓' : 'COPIER'}</div>
              </div>

              <div onClick={shareWhatsApp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#25D366', color: '#000', borderRadius: 30, padding: 15, marginBottom: 10, cursor: 'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.6-5.9c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.6.1a6.6 6.6 0 0 1-1.9-1.2 7.3 7.3 0 0 1-1.4-1.7c-.1-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5-.6-1.4-.8-2-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3A2.8 2.8 0 0 0 6 8.4a4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c.6.3 1.1.4 1.5.5a3.6 3.6 0 0 0 1.6.1c.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3z" /></svg>
                <span style={{ fontFamily: c.bebas, fontSize: 20, letterSpacing: 1 }}>PARTAGER VIA WHATSAPP</span>
              </div>

              <div onClick={shareEmail} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 30, padding: 15, cursor: 'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                <span style={{ fontFamily: c.bebas, fontSize: 20, letterSpacing: 1 }}>PARTAGER PAR E-MAIL</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PhoneFrame>
  )
}

// ---- small components ----
function Stat({ value, label, color }) {
  return (
    <div style={{ background: '#141414', border: '1px solid ' + c.hair, borderRadius: 16, padding: '15px 14px' }}>
      <div style={{ fontFamily: c.bebas, fontSize: 34, lineHeight: 0.9, color: color || '#fff' }}>{value}</div>
      <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint45, marginTop: 5 }}>{label}</div>
    </div>
  )
}
function Metric({ value, label }) {
  return (
    <div>
      <div style={{ fontFamily: c.bebas, fontSize: 24, lineHeight: 0.9 }}>{value}</div>
      <div style={{ font: "600 9px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint, marginTop: 3 }}>{label}</div>
    </div>
  )
}
function KeyMetric({ value, label }) {
  return (
    <div style={{ background: '#141414', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontFamily: c.bebas, fontSize: 26, lineHeight: 0.9 }}>{value}</div>
      <div style={{ font: "600 9px 'Barlow Condensed'", letterSpacing: 1, color: c.faint, marginTop: 3 }}>{label}</div>
    </div>
  )
}
function Check({ completed, accent, size = 38, square, onClick }) {
  const dim = square ? 28 : size
  const radius = square ? 8 : '50%'
  if (completed) {
    return (
      <div onClick={onClick} style={{ flexShrink: 0, cursor: 'pointer' }}>
        <div style={{ width: dim, height: dim, borderRadius: radius, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={square ? 15 : 18} height={square ? 15 : 18} viewBox="0 0 18 18"><path d="M3 9.5l4 4 8-9" fill="none" stroke="#000" strokeWidth={square ? 2.8 : 2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    )
  }
  return (
    <div onClick={onClick} style={{ flexShrink: 0, cursor: 'pointer' }}>
      <div style={{ width: dim, height: dim, borderRadius: radius, border: '2px solid rgba(255,255,255,0.22)' }} />
    </div>
  )
}
function NavItem({ onClick, color, label, cap, children }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', color }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap={cap ? 'round' : undefined}>{children}</svg>
      <span style={{ font: "700 9px 'Barlow Condensed'", letterSpacing: 1.5, color: 'currentColor' }}>{label}</span>
    </div>
  )
}
function BackArrow() {
  return <svg width="11" height="18" viewBox="0 0 11 18"><path d="M9 2L2 9l7 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

// Original movement schematics, one per pattern. Abstract stick figure + motion arrow.
function Schematic({ pattern, accent }) {
  const w = 'rgba(255,255,255,0.55)'
  const S = { fill: 'none', stroke: w, strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const A = { fill: 'none', stroke: accent, strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const head = (cx, cy) => <circle cx={cx} cy={cy} r="9" fill={w} />
  const figs = {
    squat: (
      <g>
        {head(70, 26)}
        <path d="M70 35 L70 70" {...S} />
        <path d="M70 70 L52 88 L52 110 M70 70 L88 88 L88 110" {...S} />
        <path d="M70 48 L48 56 M70 48 L92 56" {...S} />
        <path d="M120 40 L120 104 M112 52 L120 40 L128 52 M112 92 L120 104 L128 92" {...A} />
      </g>
    ),
    hinge: (
      <g>
        {head(40, 40)}
        <path d="M48 44 L92 64" {...S} />
        <path d="M92 64 L92 112" {...S} />
        <path d="M62 53 L60 92 M74 58 L74 92" {...S} />
        <path d="M40 96 A56 56 0 0 1 116 70" {...A} />
        <path d="M108 64 L116 70 L114 80" {...A} />
      </g>
    ),
    push: (
      <g>
        {head(60, 60)}
        <path d="M60 69 L60 112" {...S} />
        <path d="M60 80 L40 96 M60 80 L40 64" {...S} />
        <path d="M118 36 L118 96 M110 48 L118 36 L126 48" {...A} />
        <path d="M70 76 L104 60" {...S} />
      </g>
    ),
    pull: (
      <g>
        {head(80, 36)}
        <path d="M80 45 L80 96 M80 60 L58 50 M80 60 L102 50" {...S} />
        <path d="M80 96 L66 118 M80 96 L94 118" {...S} />
        <path d="M30 30 L30 92 M22 80 L30 92 L38 80" {...A} />
        <path d="M130 30 L130 92 M122 80 L130 92 L138 80" {...A} />
      </g>
    ),
    lunge: (
      <g>
        {head(72, 26)}
        <path d="M72 35 L72 72" {...S} />
        <path d="M72 72 L44 92 L44 116 M72 72 L100 88 L100 116" {...S} />
        <path d="M72 50 L54 60 M72 50 L90 60" {...S} />
        <path d="M120 60 L120 108 M112 96 L120 108 L128 96" {...A} />
      </g>
    ),
    calf: (
      <g>
        <path d="M60 30 L60 96" {...S} />
        <path d="M60 96 L100 96 M60 96 L48 108" {...S} />
        <path d="M110 30 L110 86 M102 42 L110 30 L118 42" {...A} />
      </g>
    ),
    core: (
      <g>
        {head(80, 36)}
        <path d="M80 45 L80 96" {...S} />
        <path d="M80 60 L58 70 M80 60 L102 70" {...S} />
        <path d="M80 96 L62 116 M80 96 L98 116" {...S} />
        <path d="M48 70 A40 40 0 0 0 48 96" {...A} />
        <path d="M112 70 A40 40 0 0 1 112 96" {...A} />
      </g>
    ),
    conditioning: (
      <g>
        <path d="M86 20 L60 78 L84 78 L62 130" {...A} />
        {head(40, 44)}
        <path d="M40 53 L40 92 M40 66 L22 76 M40 92 L26 116 M40 92 L52 112" {...S} />
      </g>
    ),
  }
  const fig = figs[pattern] || (
    <g>
      <path d="M40 75 L120 75" {...S} />
      <circle cx="40" cy="75" r="13" {...S} /><circle cx="120" cy="75" r="13" {...S} />
    </g>
  )
  return (
    <svg width="190" height="170" viewBox="0 0 160 150" style={{ overflow: 'visible' }}>
      <line x1="20" y1="128" x2="140" y2="128" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeLinecap="round" />
      {fig}
    </svg>
  )
}
function MenuRow({ label, onClick, accent, danger }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 0', borderTop: '1px solid ' + c.hair, cursor: 'pointer' }}>
      <span style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 0.5, color: danger ? '#FF5A3C' : '#fff' }}>{label}</span>
      <span style={{ fontFamily: c.bebas, fontSize: 18, color: danger ? '#FF5A3C' : accent }}>›</span>
    </div>
  )
}
function PhotoSlot({ label }) {
  const [img, setImg] = useState(null)
  const onFile = (e) => { const f = e.target.files?.[0]; if (f) setImg(URL.createObjectURL(f)) }
  return (
    <label style={{ display: 'block', width: '100%', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: img ? 'transparent' : 'repeating-linear-gradient(45deg,#141414,#141414 8px,#181818 8px,#181818 16px)', border: '1px solid ' + c.hair9, position: 'relative' }}>
      {img
        ? <img src={img} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 18, letterSpacing: 1, color: 'rgba(255,255,255,0.3)' }}>{label}</span>}
      <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
    </label>
  )
}

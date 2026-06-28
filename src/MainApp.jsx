import { useState, useEffect, useCallback } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { c, ACCENT_DEFAULT, WEEKDAYS, todayWeekday, localDateStr, dateLabel } from './theme.js'
import ProgramEditor from './ProgramEditor.jsx'

const CAT_CHIPS = ['TOUS', 'POUSSÉE', 'TIRAGE', 'JAMBES', 'ABDOS', 'CARDIO']
const CAT_PATTERNS = {
  'POUSSÉE': ['push'], 'TIRAGE': ['pull'], 'JAMBES': ['squat', 'hinge', 'lunge', 'calf'], 'ABDOS': ['core'], 'CARDIO': ['conditioning'],
}
const ytSearch = (n) => window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(n + ' technique musculation'), '_blank', 'noopener')

// dates within the current Mon–Sun week
function weekRange(d = new Date()) {
  const wd = todayWeekday(d)
  const mon = new Date(d); mon.setDate(d.getDate() - wd); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { mon, sun }
}

function computeStreak(dateSet) {
  let streak = 0
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (!dateSet.has(localDateStr(d))) d.setDate(d.getDate() - 1) // allow "today not done yet"
  while (dateSet.has(localDateStr(d))) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

export default function MainApp({ session, profile, onProfileChange, onReonboard, onSignOut }) {
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
  const [todayDay, setTodayDay] = useState(null)
  const [exercises, setExercises] = useState([])
  const [workoutId, setWorkoutId] = useState(null)
  const [weightHistory, setWeightHistory] = useState([])
  const [catalog, setCatalog] = useState([])
  const [recentDates, setRecentDates] = useState([]) // performed_on strings, last 8 weeks

  const todayStr = localDateStr()
  const wd = todayWeekday()

  const mapWO = (r) => ({
    woExId: r.id, day_exercise_id: r.day_exercise_id, name: r.name, group: r.muscle_group,
    sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest, tempo: r.tempo, video: r.video,
    cues: r.cues || [], description: r.description || '', pattern: r.pattern || '', completed: r.completed,
  })
  const mapDE = (r) => ({
    woExId: null, day_exercise_id: r.id, name: r.name, group: r.muscle_group,
    sets: r.sets, reps: r.reps, weight: r.weight, rest: r.rest, tempo: r.tempo, video: r.video,
    cues: r.cues || [], description: r.description || '', pattern: r.pattern || '', completed: false,
  })

  // ---- load everything ----
  useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      const since = new Date(); since.setDate(since.getDate() - 56)
      const [progRes, wRes, catRes, recRes] = await Promise.all([
        supabase.from('programs').select('id,name').eq('user_id', uid).eq('is_active', true).maybeSingle(),
        supabase.from('weight_log').select('weight,logged_at').eq('user_id', uid).order('logged_at'),
        supabase.from('exercises').select('*'),
        supabase.from('workouts').select('performed_on').eq('user_id', uid).gte('performed_on', localDateStr(since)),
      ])
      if (!active) return
      const prog = progRes.data
      let days = [], today = null
      if (prog) {
        const { data: dayRows } = await supabase.from('program_days').select('*').eq('program_id', prog.id).order('weekday')
        days = dayRows || []
        today = days.find((d) => d.weekday === wd) || null
      }
      // today's workout (snapshot) or the plan template
      const { data: wo } = await supabase
        .from('workouts').select('id, workout_exercises(*)').eq('user_id', uid).eq('performed_on', todayStr).maybeSingle()
      let exs = [], wid = null
      if (wo) {
        wid = wo.id
        exs = (wo.workout_exercises || []).slice().sort((x, y) => x.position - y.position).map(mapWO)
      } else if (today && !today.is_rest) {
        const { data: de } = await supabase.from('day_exercises').select('*').eq('program_day_id', today.id).order('position')
        exs = (de || []).map(mapDE)
      }
      if (!active) return
      setProgramId(prog?.id || null)
      setProgramName(prog?.name || '')
      setProgramDays(days)
      setTodayDay(today)
      setExercises(exs)
      setWorkoutId(wid)
      setWeightHistory((wRes.data || []).map((r) => Number(r.weight)))
      setCatalog(catRes.data || [])
      setRecentDates((recRes.data || []).map((r) => r.performed_on))
      setLoading(false)
    })()
    return () => { active = false }
  }, [uid, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- create today's workout from the current list (snapshot) ----
  const createWorkout = useCallback(async (list) => {
    const { data: wo } = await supabase.from('workouts')
      .insert({ user_id: uid, program_day_id: todayDay?.id ?? null, title: todayDay?.title || 'TRAINING', performed_on: todayStr })
      .select('id').single()
    if (!wo) return null
    let created = []
    if (list.length) {
      const rows = list.map((e, i) => ({
        workout_id: wo.id, user_id: uid, day_exercise_id: e.day_exercise_id ?? null, position: i,
        name: e.name, muscle_group: e.group, pattern: e.pattern || '', description: e.description || '',
        sets: e.sets, reps: e.reps, weight: e.weight,
        rest: e.rest, tempo: e.tempo, video: e.video, cues: e.cues, completed: e.completed,
      }))
      const { data } = await supabase.from('workout_exercises').insert(rows).select()
      created = (data || []).slice().sort((x, y) => x.position - y.position)
    }
    setWorkoutId(wo.id)
    setExercises(list.map((e, i) => ({ ...e, woExId: created[i]?.id ?? null })))
    setRecentDates((d) => (d.includes(todayStr) ? d : [...d, todayStr]))
    return wo.id
  }, [uid, todayDay, todayStr])

  const toggle = async (i) => {
    const nextList = exercises.map((e, k) => (k === i ? { ...e, completed: !e.completed } : e))
    setExercises(nextList)
    if (!workoutId) { await createWorkout(nextList); return }
    const ex = nextList[i]
    if (ex.woExId) await supabase.from('workout_exercises').update({ completed: ex.completed }).eq('id', ex.woExId)
  }

  const addFromCatalog = async (ex) => {
    setOverlay(null); setAddedName(ex.name)
    setTimeout(() => setAddedName(null), 1800)
    const newEx = {
      woExId: null, day_exercise_id: null, name: ex.name, group: ex.muscle_group,
      pattern: ex.pattern || '', description: ex.description || '',
      sets: 3, reps: ex.default_reps, weight: ex.equipment === 'bodyweight' ? 'BW' : '—',
      rest: '1:30', tempo: '2-1-1', video: ex.name, cues: ex.cues || [], completed: false,
    }
    const nextList = [...exercises, newEx]
    setExercises(nextList)
    if (!workoutId) { await createWorkout(nextList); return }
    const { data } = await supabase.from('workout_exercises').insert({
      workout_id: workoutId, user_id: uid, position: nextList.length - 1, name: newEx.name, muscle_group: newEx.group,
      pattern: newEx.pattern, description: newEx.description,
      sets: newEx.sets, reps: newEx.reps, weight: newEx.weight, rest: newEx.rest, tempo: newEx.tempo, video: newEx.video, cues: newEx.cues, completed: false,
    }).select('id').single()
    setExercises((l) => l.map((e, idx) => (idx === l.length - 1 ? { ...e, woExId: data?.id ?? null } : e)))
  }

  const saveWeight = async () => {
    const w = parseFloat(weight)
    if (isNaN(w)) { setOverlay(null); return }
    setWeightHistory((h) => [...h, w])
    setOverlay(null)
    await supabase.from('weight_log').insert({ user_id: uid, weight: w })
  }

  const goTab = (t) => { setTab(t); setOverlay(null) }
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
        uid={uid} accent={accent} programId={programId} catalog={catalog}
        onClose={() => { setShowEditor(false); setReloadKey((k) => k + 1) }}
        onReonboard={onReonboard}
      />
    )
  }

  // ---- derived ----
  const isRest = !!todayDay?.is_rest
  const title = todayDay?.title || 'TRAINING'
  const focus = todayDay?.focus || ''
  const total = exercises.length
  const done = exercises.filter((e) => e.completed).length
  const pct = total ? done / total : 0
  const exs = exercises.map((ex, i) => ({
    ...ex, scheme: ex.sets + ' × ' + ex.reps, pending: !ex.completed,
    num: String(i + 1).padStart(2, '0'),
    numColor: ex.completed ? accent : 'rgba(255,255,255,0.22)',
    nameColor: ex.completed ? 'rgba(255,255,255,0.4)' : '#fff', i,
  }))
  const titleLines = title.split(' ')

  const ringCirc = 2 * Math.PI * 30
  const ringOffset = ringCirc * (1 - pct)

  // this-week completion
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
      stateLabel: st === 'today' ? 'AUJ.' : (st === 'done' ? 'FAIT' : (d.is_rest ? 'REPOS' : 'PRÉVU')),
    }
  })

  const sel = exercises[selected] || exercises[0] || null
  const sets = sel ? Array.from({ length: sel.sets }, (_, k) => ({ n: 'SÉRIE ' + (k + 1), reps: sel.reps, weight: sel.weight })) : []

  // body weight chart (guard small histories)
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

  // sessions / week bars (last 8 weeks)
  const bars = []
  for (let i = 7; i >= 0; i--) {
    const ref = new Date(); ref.setDate(ref.getDate() - i * 7)
    const { mon: m, sun: s } = weekRange(ref)
    const count = recentDates.filter((ds) => { const d = new Date(ds + 'T00:00:00'); return d >= m && d <= s }).length
    bars.push({ count, label: 'W' + (8 - i) })
  }
  const maxBar = Math.max(5, ...bars.map((b) => b.count))
  const barViews = bars.map((b, i) => ({
    h: Math.round((b.count / maxBar) * 100) + '%', label: b.label,
    barColor: i === bars.length - 1 ? accent : 'rgba(255,255,255,0.18)',
  }))

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

  const cc = { c, accent }

  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: '#0A0A0A', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}>
        <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

          {/* ============ HOME ============ */}
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
              <div onClick={() => goTab('train')} style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: '#101010', border: '1px solid ' + c.hair9, padding: 22, marginBottom: 20, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`, opacity: 0.12 }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: "700 12px 'Barlow Condensed'", letterSpacing: 2.5, color: accent }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />{isRest ? 'JOUR DE REPOS' : 'SÉANCE DU JOUR'}</div>
                    <span style={{ fontFamily: c.bebas, fontSize: 22, color: 'rgba(255,255,255,0.3)' }}>→</span>
                  </div>
                  <div style={{ fontFamily: c.bebas, fontSize: 60, lineHeight: 0.84, margin: '16px 0 8px' }}>{isRest ? 'RÉCUP' : title}</div>
                  <div style={{ font: "600 14px 'Barlow Condensed'", letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>
                    {isRest ? 'REPOS & RÉCUP · MOBILITÉ EN OPTION' : `${focus} · ${total} EXOS · ${sessionMin} MIN`}
                  </div>
                  {!isRest && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: progressPctStr, background: accent, borderRadius: 3, transition: 'width .4s' }} />
                        </div>
                        <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginTop: 7 }}>{done}/{total} TERMINÉS</div>
                      </div>
                      <div style={{ background: accent, color: '#000', fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, padding: '11px 24px', borderRadius: 30 }}>DÉMARRER ▸</div>
                    </div>
                  )}
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
              {week.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid ' + c.hair }}>
                  <div style={{ width: 40, fontFamily: c.bebas, fontSize: 21, color: d.dayColor }}>{d.day}</div>
                  <div style={{ flex: 1, font: "600 15px 'Barlow Condensed'", letterSpacing: 0.5, color: d.focusColor }}>{d.focus}</div>
                  <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 1.5, color: d.stateColor }}>{d.stateLabel}</div>
                </div>
              ))}
            </div>
          )}

          {/* ============ TRAIN ============ */}
          {tab === 'train' && (
            <div style={{ padding: '60px 0 130px', animation: 'fadeUp .4s' }}>
              <div style={{ padding: '0 20px' }}>
                <div style={{ font: "700 12px 'Barlow Condensed'", letterSpacing: 2.5, color: accent }}>{dateLabel()} · AUJOURD'HUI</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                  <div style={{ fontFamily: c.bebas, fontSize: 54, lineHeight: 0.82 }}>{isRest && total === 0 ? 'REPOS' : titleLines.map((l, k) => <span key={k}>{l}{k < titleLines.length - 1 && <br />}</span>)}</div>
                  <svg width="78" height="78" viewBox="0 0 78 78" style={{ flexShrink: 0 }}>
                    <circle cx="39" cy="39" r="30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
                    <circle cx="39" cy="39" r="30" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={ringCirc.toFixed(1)} strokeDashoffset={ringOffset.toFixed(1)} transform="rotate(-90 39 39)" style={{ transition: 'stroke-dashoffset .5s' }} />
                    <text x="39" y="38" textAnchor="middle" fill="#fff" fontFamily="Bebas Neue" fontSize="22">{done}</text>
                    <text x="39" y="52" textAnchor="middle" fill={c.faint} fontFamily="Barlow Condensed" fontSize="11" letterSpacing="1">/ {total}</text>
                  </svg>
                </div>
              </div>

              {total > 0 && (
                <div style={{ display: 'flex', gap: 5, background: '#141414', borderRadius: 30, padding: 5, margin: '20px 20px', border: '1px solid ' + c.hair }}>
                  {['focus', 'list'].map((v) => (
                    <div key={v} onClick={() => setVariant(v)} style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 24, fontFamily: c.bebas, fontSize: 18, letterSpacing: 1.5, cursor: 'pointer', background: variant === v ? accent : 'transparent', color: variant === v ? '#000' : 'rgba(255,255,255,0.5)', transition: 'all .2s' }}>{v === 'focus' ? 'DÉTAIL' : 'LISTE'}</div>
                  ))}
                </div>
              )}

              {total === 0 && (
                <div style={{ padding: '30px 20px 6px', textAlign: 'center', font: "500 14px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>
                  {isRest ? "Jour de repos prévu. Ajoute des exos pour t'entraîner quand même." : 'Aucun exercice. Ajoutes-en pour commencer.'}
                </div>
              )}

              {variant === 'focus' && total > 0 && (
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

              {variant === 'list' && total > 0 && (
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

              <div style={{ padding: '16px 20px 0' }}>
                <div onClick={openAdd} style={{ border: '1.5px dashed rgba(255,255,255,0.2)', borderRadius: 16, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 20, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>+ AJOUTER UN EXERCICE</div>
              </div>
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
                <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 1 }}>PHOTOS DE PROGRÈS</div>
                <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>TOUCHE POUR AJOUTER</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {['WK 1', 'WK 4', 'WK 8'].map((ph, i) => (<PhotoSlot key={i} label={ph} />))}
              </div>
            </div>
          )}
        </div>

        {/* ============ TOAST ============ */}
        {addedName && (
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 108, zIndex: 75, background: accent, color: '#000', borderRadius: 16, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'fadeUp .3s' }}>
            <span style={{ fontFamily: c.bebas, fontSize: 18, letterSpacing: 1 }}>AJOUTÉ À LA SÉANCE</span>
            <span style={{ font: "700 13px 'Barlow Condensed'", letterSpacing: 0.5 }}>{addedName}</span>
          </div>
        )}

        {/* ============ BOTTOM NAV ============ */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 70, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '13px 36px 30px', display: 'flex', justifyContent: 'space-between' }}>
          <NavItem onClick={() => goTab('home')} color={navColor('home')} label="ACCUEIL">
            <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </NavItem>
          <NavItem onClick={() => goTab('train')} color={navColor('train')} label="SÉANCE" cap>
            <line x1="4" y1="9" x2="4" y2="15" /><line x1="7" y1="6" x2="7" y2="18" /><line x1="17" y1="6" x2="17" y2="18" /><line x1="20" y1="9" x2="20" y2="15" /><line x1="7" y1="12" x2="17" y2="12" />
          </NavItem>
          <NavItem onClick={() => goTab('stats')} color={navColor('stats')} label="STATS" cap>
            <line x1="5" y1="20" x2="5" y2="13" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="19" y1="20" x2="19" y2="10" />
          </NavItem>
        </div>

        {/* ============ DETAIL OVERLAY ============ */}
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

              <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, margin: '24px 0 10px' }}>JOURNAL DES SÉRIES</div>
              <div style={{ background: '#141414', borderRadius: 16, overflow: 'hidden' }}>
                {sets.map((st, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ flex: 1, font: "700 13px 'Barlow Condensed'", letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)' }}>{st.n}</div>
                    <div style={{ width: 80, textAlign: 'center', fontFamily: c.bebas, fontSize: 20 }}>{st.reps}</div>
                    <div style={{ width: 80, textAlign: 'center', fontFamily: c.bebas, fontSize: 20 }}>{st.weight}</div>
                    <div style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.18)', flexShrink: 0 }} />
                  </div>
                ))}
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
            </div>

            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px 30px', background: 'linear-gradient(transparent,#0A0A0A 30%)' }}>
              <div onClick={() => toggle(selected)} style={{ background: sel.completed ? '#1c1c1c' : accent, color: sel.completed ? accent : '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 22, letterSpacing: 2, cursor: 'pointer' }}>{sel.completed ? '✓ TERMINÉ' : 'MARQUER COMME FAIT'}</div>
            </div>
          </div>
        )}

        {/* ============ ADD OVERLAY ============ */}
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

        {/* ============ LOG WEIGHT SHEET ============ */}
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

        {/* ============ ACCOUNT MENU ============ */}
        {overlay === 'menu' && (
          <div onClick={closeOverlay} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', animation: 'overlayIn .25s' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', background: '#161616', borderRadius: '26px 26px 0 0', padding: '24px 20px 40px', borderTop: '1px solid rgba(255,255,255,0.1)', animation: 'slideUp .3s' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />
              <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint }}>{session.user.email}</div>
              <div style={{ fontFamily: c.bebas, fontSize: 30, letterSpacing: 0.5, marginTop: 2, marginBottom: 18 }}>{programName || 'AUCUN PROGRAMME'}</div>
              <MenuRow label="MODIFIER LE PROGRAMME" onClick={() => { setOverlay(null); setShowEditor(true) }} accent={accent} />
              <MenuRow label="REGÉNÉRER AVEC LE COACH" onClick={() => { setOverlay(null); onReonboard() }} accent={accent} />
              <MenuRow label="DÉCONNEXION" onClick={onSignOut} danger />
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

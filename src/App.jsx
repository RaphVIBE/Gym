import { useState } from 'react'
import PhoneFrame from './PhoneFrame.jsx'

const ACCENT = '#D9FF00'
const ATHLETE = 'ALEX'
const DEFAULT_VIEW = 'focus'

const LIBRARY = [
  { name: 'Incline Bench Press', group: 'Upper Chest', sets: 4, reps: '8', weight: '50 kg', cat: 'Push' },
  { name: 'Overhead Press', group: 'Shoulders', sets: 4, reps: '8', weight: '40 kg', cat: 'Push' },
  { name: 'Dumbbell Fly', group: 'Chest', sets: 3, reps: '12', weight: '14 kg', cat: 'Push' },
  { name: 'Pull-Up', group: 'Back · Lats', sets: 4, reps: '8', weight: 'BW', cat: 'Pull' },
  { name: 'Barbell Row', group: 'Back', sets: 4, reps: '8', weight: '60 kg', cat: 'Pull' },
  { name: 'Lat Pulldown', group: 'Lats', sets: 3, reps: '12', weight: '55 kg', cat: 'Pull' },
  { name: 'Face Pull', group: 'Rear Delts', sets: 3, reps: '15', weight: '25 kg', cat: 'Pull' },
  { name: 'Hip Thrust', group: 'Glutes', sets: 3, reps: '10', weight: '90 kg', cat: 'Legs' },
  { name: 'Walking Lunge', group: 'Quads · Glutes', sets: 3, reps: '12 / leg', weight: '20 kg', cat: 'Legs' },
  { name: 'Goblet Squat', group: 'Quads', sets: 3, reps: '12', weight: '28 kg', cat: 'Legs' },
  { name: 'Plank', group: 'Core', sets: 3, reps: '60 s', weight: 'BW', cat: 'Core' },
  { name: 'Cable Crunch', group: 'Core', sets: 3, reps: '15', weight: '35 kg', cat: 'Core' },
]

const INITIAL_EXERCISES = [
  { name: 'Back Squat', group: 'QUADS · GLUTES', sets: 4, reps: '6', weight: '80 kg', rest: '2:30', tempo: '3-1-1', video: 'Barbell Back Squat', completed: true,
    cues: ['Brace your core hard before unracking', 'Knees track over your toes', 'Drive through the mid-foot', 'Break parallel — hips below the knee'] },
  { name: 'Romanian Deadlift', group: 'HAMSTRINGS', sets: 3, reps: '8', weight: '70 kg', rest: '2:00', tempo: '3-1-1', video: 'Romanian Deadlift', completed: true,
    cues: ['Soft knees, hinge from the hips', 'Keep the bar close to your legs', 'Feel the hamstring stretch', 'Squeeze glutes to lock out'] },
  { name: 'Bulgarian Split Squat', group: 'QUADS · GLUTES', sets: 3, reps: '10 / leg', weight: '22 kg', rest: '1:30', tempo: '2-1-1', video: 'Bulgarian Split Squat', completed: false,
    cues: ['Front foot flat on the floor', 'Torso leans slightly forward', 'Drop straight down', 'Control the descent'] },
  { name: 'Leg Press', group: 'QUADS', sets: 3, reps: '12', weight: '160 kg', rest: '1:30', tempo: '2-0-1', video: 'Leg Press', completed: false,
    cues: ['Feet shoulder-width on the plate', "Don't lock the knees hard", 'Lower until knees reach 90°', 'Push through your heels'] },
  { name: 'Standing Calf Raise', group: 'CALVES', sets: 4, reps: '15', weight: '45 kg', rest: '1:00', tempo: '2-2-1', video: 'Standing Calf Raise', completed: false,
    cues: ['Full stretch at the bottom', 'Pause hard at the top', 'Slow the eccentric down', 'Keep your knees straight'] },
  { name: 'Hanging Leg Raise', group: 'CORE', sets: 3, reps: '12', weight: 'BW', rest: '1:00', tempo: '2-1-2', video: 'Hanging Leg Raise', completed: false,
    cues: ['No swinging or momentum', 'Curl the pelvis up', 'Control the way down', 'Exhale at the top'] },
]

const WEEK = [
  { day: 'MON', focus: 'LOWER BODY', st: 'today' },
  { day: 'TUE', focus: 'PUSH', st: 'next' },
  { day: 'WED', focus: 'REST', st: 'rest' },
  { day: 'THU', focus: 'PULL', st: 'next' },
  { day: 'FRI', focus: 'LOWER BODY', st: 'next' },
  { day: 'SAT', focus: 'CONDITIONING', st: 'next' },
  { day: 'SUN', focus: 'REST', st: 'rest' },
]

const c = {
  faint: 'rgba(255,255,255,0.4)',
  faint45: 'rgba(255,255,255,0.45)',
  hair: 'rgba(255,255,255,0.06)',
  hair7: 'rgba(255,255,255,0.07)',
  hair9: 'rgba(255,255,255,0.09)',
  bebas: "'Bebas Neue', sans-serif",
}

export default function App() {
  const accent = ACCENT
  const name = ATHLETE.toUpperCase()

  const [tab, setTab] = useState('home')
  const [overlay, setOverlay] = useState(null)
  const [selected, setSelected] = useState(0)
  const [variant, setVariant] = useState(DEFAULT_VIEW)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('ALL')
  const [weight, setWeight] = useState('')
  const [addedName, setAddedName] = useState(null)
  const [bodyWeight, setBodyWeight] = useState(78.4)
  const [weightHistory, setWeightHistory] = useState([80.1, 79.6, 79.8, 79.2, 78.9, 78.7, 78.6, 78.4])
  const [exercises, setExercises] = useState(INITIAL_EXERCISES)

  const goTab = (t) => { setTab(t); setOverlay(null) }
  const openDetail = (i) => { setSelected(i); setOverlay('detail') }
  const openAdd = () => { setOverlay('add'); setSearch(''); setCat('ALL') }
  const openLog = () => { setOverlay('logweight'); setWeight(String(bodyWeight)) }
  const closeOverlay = () => setOverlay(null)

  const toggle = (i) => setExercises((ex) => ex.map((e, k) => (k === i ? { ...e, completed: !e.completed } : e)))

  const addExercise = (lib) => {
    setExercises((ex) => [...ex, {
      name: lib.name, group: lib.group.toUpperCase(), sets: lib.sets, reps: lib.reps, weight: lib.weight,
      rest: '1:30', tempo: '2-1-1', video: lib.name, completed: false,
      cues: ['Move with a controlled tempo', 'Use a full range of motion', 'Brace your core throughout', 'Breathe out on the effort'],
    }])
    setOverlay(null)
    setAddedName(lib.name)
    setTimeout(() => setAddedName(null), 1800)
  }

  const saveWeight = () => {
    const w = parseFloat(weight)
    if (isNaN(w)) { setOverlay(null); return }
    setBodyWeight(w)
    setWeightHistory((h) => [...h.slice(1), w])
    setOverlay(null)
  }

  // ---- derived ----
  const total = exercises.length
  const done = exercises.filter((e) => e.completed).length
  const pct = total ? done / total : 0
  const exs = exercises.map((ex, i) => ({
    ...ex,
    scheme: ex.sets + ' × ' + ex.reps,
    pending: !ex.completed,
    num: String(i + 1).padStart(2, '0'),
    numColor: ex.completed ? accent : 'rgba(255,255,255,0.22)',
    nameColor: ex.completed ? 'rgba(255,255,255,0.4)' : '#fff',
    i,
  }))

  const ringCirc = 2 * Math.PI * 30
  const ringOffset = ringCirc * (1 - pct)

  const week = WEEK.map((d) => ({
    day: d.day, focus: d.focus,
    dayColor: d.st === 'today' ? accent : (d.st === 'rest' ? 'rgba(255,255,255,0.3)' : '#fff'),
    focusColor: d.st === 'rest' ? 'rgba(255,255,255,0.3)' : (d.st === 'today' ? '#fff' : 'rgba(255,255,255,0.7)'),
    stateColor: d.st === 'today' ? accent : 'rgba(255,255,255,0.35)',
    stateLabel: d.st === 'today' ? 'TODAY' : (d.st === 'rest' ? 'REST' : 'PLANNED'),
  }))

  const sel = exercises[selected] || exercises[0]
  const sets = Array.from({ length: sel.sets }, (_, k) => ({ n: 'SET ' + (k + 1), reps: sel.reps, weight: sel.weight }))

  const hist = weightHistory
  const md = hist[hist.length - 1] - hist[0]
  const W = 300, H = 104
  const mn = Math.min(...hist) - 0.4, mx = Math.max(...hist) + 0.4
  const pts = hist.map((v, i) => [
    +((i / (hist.length - 1)) * W).toFixed(1),
    +(H - ((v - mn) / (mx - mn)) * H).toFixed(1),
  ])
  const linePoints = pts.map((p) => p.join(',')).join(' ')
  const areaPath = 'M0,' + H + ' ' + pts.map((p) => 'L' + p[0] + ',' + p[1]).join(' ') + ' L' + W + ',' + H + ' Z'

  const sess = [3, 4, 2, 5, 4, 5, 4, 4]
  const barLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']
  const bars = sess.map((v, i) => ({
    h: (v / 5 * 100) + '%', label: barLabels[i],
    barColor: i === sess.length - 1 ? accent : 'rgba(255,255,255,0.18)',
  }))

  const progressTiles = [
    { label: 'SQUAT 1RM', value: '120', unit: 'KG', delta: '5 kg' },
    { label: 'AVG SESSION', value: '52', unit: 'MIN', delta: '6 min' },
    { label: 'WEEKLY VOL', value: '18.2', unit: 'T', delta: '8%' },
  ]

  const q = search.toLowerCase()
  const library = LIBRARY
    .filter((l) => (cat === 'ALL' || l.cat.toUpperCase() === cat) && l.name.toLowerCase().includes(q))
    .map((l) => ({ name: l.name, group: l.group, scheme: l.sets + ' × ' + l.reps, lib: l }))
  const chips = ['ALL', 'PUSH', 'PULL', 'LEGS', 'CORE'].map((ch) => ({
    label: ch,
    bg: cat === ch ? accent : 'transparent',
    color: cat === ch ? '#000' : 'rgba(255,255,255,0.55)',
    border: cat === ch ? accent : 'rgba(255,255,255,0.14)',
  }))

  const navColor = (t) => (tab === t ? accent : 'rgba(255,255,255,0.4)')

  const monthDeltaStr = (md >= 0 ? '+' : '') + md.toFixed(1) + ' kg'
  const monthDeltaColor = md <= 0 ? accent : '#FF5A3C'

  const sessionMin = Math.round(total * 8.5)
  const progressPctStr = Math.round(pct * 100) + '%'

  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: '#0A0A0A', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}>

        <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

          {/* ============ HOME ============ */}
          {tab === 'home' && (
            <div style={{ padding: '60px 20px 130px', animation: 'fadeUp .4s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
                <div>
                  <div style={{ font: "600 13px 'Barlow Condensed'", letterSpacing: 3, color: 'rgba(255,255,255,0.45)' }}>MON 28 JUN</div>
                  <div style={{ fontFamily: c.bebas, fontSize: 46, lineHeight: 0.88, letterSpacing: 1, marginTop: 6 }}>READY TO<br />TRAIN, {name}</div>
                </div>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#171717', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 22, color: accent, flexShrink: 0 }}>{name.charAt(0)}</div>
              </div>

              {/* hero today card */}
              <div onClick={() => goTab('train')} style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: '#101010', border: '1px solid ' + c.hair9, padding: 22, marginBottom: 20, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`, opacity: 0.12 }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: "700 12px 'Barlow Condensed'", letterSpacing: 2.5, color: accent }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />TODAY'S SESSION</div>
                    <span style={{ fontFamily: c.bebas, fontSize: 22, color: 'rgba(255,255,255,0.3)' }}>→</span>
                  </div>
                  <div style={{ fontFamily: c.bebas, fontSize: 64, lineHeight: 0.84, margin: '16px 0 8px' }}>LOWER BODY</div>
                  <div style={{ font: "600 14px 'Barlow Condensed'", letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)' }}>STRENGTH · {total} EXERCISES · {sessionMin} MIN</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: progressPctStr, background: accent, borderRadius: 3, transition: 'width .4s' }} />
                      </div>
                      <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginTop: 7 }}>{done}/{total} COMPLETED</div>
                    </div>
                    <div style={{ background: accent, color: '#000', fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, padding: '11px 24px', borderRadius: 30 }}>START ▸</div>
                  </div>
                </div>
              </div>

              {/* quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 28 }}>
                <Stat value="4" label="SESSIONS / WK" />
                <Stat value="12" label="DAY STREAK" color={accent} />
                <Stat value={bodyWeight.toFixed(1)} label="BODY KG" />
              </div>

              {/* this week */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                <div style={{ fontFamily: c.bebas, fontSize: 26, letterSpacing: 1 }}>THIS WEEK</div>
                <div style={{ font: "600 12px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>7 DAY SPLIT</div>
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
                <div style={{ font: "700 12px 'Barlow Condensed'", letterSpacing: 2.5, color: accent }}>MON 28 JUN · TODAY</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                  <div style={{ fontFamily: c.bebas, fontSize: 54, lineHeight: 0.82 }}>LOWER<br />BODY</div>
                  <svg width="78" height="78" viewBox="0 0 78 78" style={{ flexShrink: 0 }}>
                    <circle cx="39" cy="39" r="30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
                    <circle cx="39" cy="39" r="30" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={ringCirc.toFixed(1)} strokeDashoffset={ringOffset.toFixed(1)} transform="rotate(-90 39 39)" style={{ transition: 'stroke-dashoffset .5s' }} />
                    <text x="39" y="38" textAnchor="middle" fill="#fff" fontFamily="Bebas Neue" fontSize="22">{done}</text>
                    <text x="39" y="52" textAnchor="middle" fill={c.faint} fontFamily="Barlow Condensed" fontSize="11" letterSpacing="1">/ {total}</text>
                  </svg>
                </div>
              </div>

              {/* variant toggle */}
              <div style={{ display: 'flex', gap: 5, background: '#141414', borderRadius: 30, padding: 5, margin: '20px 20px', border: '1px solid ' + c.hair }}>
                {['focus', 'list'].map((v) => (
                  <div key={v} onClick={() => setVariant(v)} style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 24, fontFamily: c.bebas, fontSize: 18, letterSpacing: 1.5, cursor: 'pointer', background: variant === v ? accent : 'transparent', color: variant === v ? '#000' : 'rgba(255,255,255,0.5)', transition: 'all .2s' }}>{v.toUpperCase()}</div>
                ))}
              </div>

              {/* FOCUS variant */}
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
                        <Metric value={ex.scheme} label="SETS × REPS" />
                        <Metric value={ex.weight} label="LOAD" />
                        <Metric value={ex.rest} label="REST" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* LIST variant */}
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

              <div style={{ padding: '16px 20px 0' }}>
                <div onClick={openAdd} style={{ border: '1.5px dashed rgba(255,255,255,0.2)', borderRadius: 16, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 20, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>+ ADD EXERCISE</div>
              </div>
            </div>
          )}

          {/* ============ STATS ============ */}
          {tab === 'stats' && (
            <div style={{ padding: '60px 20px 130px', animation: 'fadeUp .4s' }}>
              <div style={{ fontFamily: c.bebas, fontSize: 46, lineHeight: 0.86, letterSpacing: 1, marginBottom: 22 }}>PROGRESS</div>

              {/* body weight hero */}
              <div style={{ background: '#101010', border: '1px solid ' + c.hair9, borderRadius: 22, padding: 22, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint45 }}>BODY WEIGHT</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                      <span style={{ fontFamily: c.bebas, fontSize: 60, lineHeight: 0.8 }}>{bodyWeight.toFixed(1)}</span>
                      <span style={{ fontFamily: c.bebas, fontSize: 24, color: c.faint45 }}>KG</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: "700 14px 'Barlow Condensed'", letterSpacing: 1, color: monthDeltaColor }}>{monthDeltaStr}</div>
                    <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>8 WEEKS</div>
                  </div>
                </div>
                <svg viewBox="0 0 300 104" preserveAspectRatio="none" style={{ width: '100%', height: 104, marginTop: 14, overflow: 'visible' }}>
                  <path d={areaPath} fill={accent} fillOpacity="0.1" />
                  <polyline points={linePoints} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4.5" fill={accent} stroke="#101010" strokeWidth="2.5" />
                </svg>
                <div onClick={openLog} style={{ marginTop: 16, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 30, padding: 11, textAlign: 'center', fontFamily: c.bebas, fontSize: 18, letterSpacing: 1.5, cursor: 'pointer' }}>+ LOG WEIGHT</div>
              </div>

              {/* progress tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                {progressTiles.map((p, i) => (
                  <div key={i} style={{ background: '#141414', border: '1px solid ' + c.hair, borderRadius: 16, padding: '15px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontFamily: c.bebas, fontSize: 30, lineHeight: 0.9 }}>{p.value}</span>
                      <span style={{ font: "600 11px 'Barlow Condensed'", color: c.faint45 }}>{p.unit}</span>
                    </div>
                    <div style={{ font: "600 9px 'Barlow Condensed'", letterSpacing: 1, color: c.faint45, marginTop: 5 }}>{p.label}</div>
                    <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 0.5, color: accent, marginTop: 6 }}>▲ {p.delta}</div>
                  </div>
                ))}
              </div>

              {/* sessions per week */}
              <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 1, marginBottom: 12 }}>SESSIONS / WEEK</div>
              <div style={{ background: '#141414', border: '1px solid ' + c.hair, borderRadius: 18, padding: '18px 16px 12px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 7, height: 90 }}>
                  {bars.map((b, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: b.h, borderRadius: 5, background: b.barColor, transition: 'height .4s' }} />
                      <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 0.5, color: 'rgba(255,255,255,0.35)' }}>{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* progress photos */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 1 }}>PROGRESS PHOTOS</div>
                <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>DROP TO ADD</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[['WK 1', '10 MAY'], ['WK 4', '31 MAY'], ['WK 8', '28 JUN']].map(([ph, date], i) => (
                  <div key={i}>
                    <PhotoSlot label={ph} />
                    <div style={{ font: "600 10px 'Barlow Condensed'", letterSpacing: 1, color: c.faint, marginTop: 6, textAlign: 'center' }}>{date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ============ TOAST ============ */}
        {addedName && (
          <div style={{ position: 'absolute', left: 20, right: 20, bottom: 108, zIndex: 75, background: accent, color: '#000', borderRadius: 16, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'fadeUp .3s' }}>
            <span style={{ fontFamily: c.bebas, fontSize: 18, letterSpacing: 1 }}>ADDED TO SESSION</span>
            <span style={{ font: "700 13px 'Barlow Condensed'", letterSpacing: 0.5 }}>{addedName}</span>
          </div>
        )}

        {/* ============ BOTTOM NAV ============ */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 70, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '13px 36px 30px', display: 'flex', justifyContent: 'space-between' }}>
          <NavItem onClick={() => goTab('home')} color={navColor('home')} label="HOME">
            <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </NavItem>
          <NavItem onClick={() => goTab('train')} color={navColor('train')} label="TRAIN" cap>
            <line x1="4" y1="9" x2="4" y2="15" /><line x1="7" y1="6" x2="7" y2="18" /><line x1="17" y1="6" x2="17" y2="18" /><line x1="20" y1="9" x2="20" y2="15" /><line x1="7" y1="12" x2="17" y2="12" />
          </NavItem>
          <NavItem onClick={() => goTab('stats')} color={navColor('stats')} label="STATS" cap>
            <line x1="5" y1="20" x2="5" y2="13" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="19" y1="20" x2="19" y2="10" />
          </NavItem>
        </div>

        {/* ============ DETAIL OVERLAY ============ */}
        {overlay === 'detail' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 85, background: '#0A0A0A', overflowY: 'auto', animation: 'overlayIn .25s' }}>
            <div style={{ position: 'relative', height: 270, background: 'repeating-linear-gradient(135deg,#141414,#141414 11px,#191919 11px,#191919 22px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div onClick={closeOverlay} style={{ position: 'absolute', top: 54, left: 18, width: 42, height: 42, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <BackArrow />
              </div>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                <svg width="24" height="26" viewBox="0 0 24 26"><path d="M2 2l20 11L2 24z" fill="#000" /></svg>
              </div>
              <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: 'rgba(255,255,255,0.6)' }}>▶ FORM VIDEO</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: c.faint }}>{sel.video}</span>
              </div>
            </div>

            <div style={{ padding: '22px 20px 130px' }}>
              <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: accent }}>{sel.group}</div>
              <div style={{ fontFamily: c.bebas, fontSize: 48, lineHeight: 0.86, letterSpacing: 0.5, marginTop: 4 }}>{sel.name}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 18 }}>
                <KeyMetric value={String(sel.sets)} label="SETS" />
                <KeyMetric value={sel.reps} label="REPS" />
                <KeyMetric value={sel.weight} label="LOAD" />
                <KeyMetric value={sel.tempo} label="TEMPO" />
              </div>

              <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, margin: '24px 0 10px' }}>SET LOG</div>
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

              <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, margin: '24px 0 10px' }}>FORM CUES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {sel.cues.map((cue, i) => (
                  <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, marginTop: 6, flexShrink: 0 }} />
                    <div style={{ font: "500 15px 'Barlow Condensed'", letterSpacing: 0.3, color: 'rgba(255,255,255,0.8)', lineHeight: 1.25 }}>{cue}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 1, margin: '24px 0 10px' }}>MOVEMENT SCHEMA</div>
              <div style={{ height: 150, borderRadius: 16, background: 'repeating-linear-gradient(45deg,#121212,#121212 10px,#161616 10px,#161616 20px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid ' + c.hair }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15l5-5 4 4 4-6 5 5" /></svg>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>movement breakdown diagram</div>
              </div>
            </div>

            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px 30px', background: 'linear-gradient(transparent,#0A0A0A 30%)' }}>
              <div onClick={() => toggle(selected)} style={{ background: sel.completed ? '#1c1c1c' : accent, color: sel.completed ? accent : '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 22, letterSpacing: 2, cursor: 'pointer' }}>{sel.completed ? '✓ COMPLETED' : 'MARK COMPLETE'}</div>
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
                <div style={{ fontFamily: c.bebas, fontSize: 34, letterSpacing: 1 }}>ADD EXERCISE</div>
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises…" style={{ width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: '#fff', fontFamily: "'Barlow Condensed'", fontSize: 16, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 7, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
                {chips.map((ch, i) => (
                  <div key={i} onClick={() => setCat(ch.label)} style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 30, fontFamily: c.bebas, fontSize: 15, letterSpacing: 1, cursor: 'pointer', background: ch.bg, color: ch.color, border: '1px solid ' + ch.border }}>{ch.label}</div>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 20px 40px' }}>
              {library.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', font: "500 14px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>NO EXERCISES FOUND</div>
              )}
              {library.map((lib, i) => (
                <div key={i} onClick={() => addExercise(lib.lib)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: '1px solid ' + c.hair7, cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 18px 'Barlow Condensed'", letterSpacing: 0.3, lineHeight: 1.05 }}>{lib.name}</div>
                    <div style={{ font: "500 11px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint, marginTop: 2 }}>{lib.group} · {lib.scheme}</div>
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
              <div style={{ fontFamily: c.bebas, fontSize: 30, letterSpacing: 1, marginBottom: 18 }}>LOG BODY WEIGHT</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, background: '#0e0e0e', borderRadius: 16, padding: '18px 20px', marginBottom: 18 }}>
                <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: c.bebas, fontSize: 44, width: '100%' }} />
                <span style={{ fontFamily: c.bebas, fontSize: 26, color: c.faint }}>KG</span>
              </div>
              <div onClick={saveWeight} style={{ background: accent, color: '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 22, letterSpacing: 2, cursor: 'pointer' }}>SAVE ENTRY</div>
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

function PhotoSlot({ label }) {
  const [img, setImg] = useState(null)
  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (f) setImg(URL.createObjectURL(f))
  }
  return (
    <label style={{ display: 'block', width: '100%', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: img ? 'transparent' : 'repeating-linear-gradient(45deg,#141414,#141414 8px,#181818 8px,#181818 16px)', border: '1px solid ' + c.hair9, position: 'relative' }}>
      {img
        ? <img src={img} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 18, letterSpacing: 1, color: 'rgba(255,255,255,0.3)' }}>{label}</span>}
      <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
    </label>
  )
}

import { useState } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { c, ACCENT_DEFAULT } from './theme.js'
import { generateProgram, persistProgram } from './coach.js'

const accent = ACCENT_DEFAULT

const STEPS = [
  { key: 'display_name', kind: 'text', q: "COMMENT\nT'APPELLE-T-ON ?", placeholder: 'Ton prénom' },
  { key: 'age', kind: 'number', q: 'QUEL ÂGE\nAS-TU ?', unit: 'ANS', min: 14, max: 90 },
  { key: 'bodyweight', kind: 'number', q: 'TON POIDS\nDE CORPS ?', unit: 'KG', min: 35, max: 220, decimal: true },
  { key: 'goal', kind: 'single', q: 'QUEL EST TON\nOBJECTIF ?', options: [
    { v: 'strength', l: 'FORCE', d: 'Devenir plus fort, soulever lourd' },
    { v: 'hypertrophy', l: 'PRENDRE DU MUSCLE', d: 'Volume et définition' },
    { v: 'fat_loss', l: 'PERDRE DU GRAS', d: "S'affiner — plus de réps + cardio" },
    { v: 'conditioning', l: 'CARDIO / CONDITION', d: 'Souffle et capacité de travail' },
    { v: 'general', l: 'FORME GÉNÉRALE', d: 'Équilibré, se sentir bien' },
  ] },
  { key: 'experience', kind: 'single', q: 'TON\nNIVEAU ?', options: [
    { v: 'beginner', l: 'DÉBUTANT', d: 'Nouveau ou de retour' },
    { v: 'intermediate', l: 'INTERMÉDIAIRE', d: 'Un à deux ans de pratique' },
    { v: 'advanced', l: 'AVANCÉ', d: "Plusieurs années, à l'aise" },
  ] },
  { key: 'days_per_week', kind: 'chips', q: 'COMBIEN DE JOURS\nPAR SEMAINE ?', options: [2, 3, 4, 5, 6], suffix: '' },
  { key: 'session_minutes', kind: 'chips', q: 'TEMPS PAR\nSÉANCE ?', options: [30, 45, 60, 75], suffix: ' MIN' },
  { key: 'equipment', kind: 'single', q: 'AVEC QUEL\nMATÉRIEL ?', options: [
    { v: 'full_gym', l: 'SALLE COMPLÈTE', d: 'Barres, machines, poulies' },
    { v: 'dumbbells', l: 'HALTÈRES', d: 'Haltères réglables ou fixes' },
    { v: 'home', l: 'À LA MAISON', d: 'Haltères + poids du corps' },
    { v: 'bodyweight', l: 'POIDS DU CORPS', d: 'Aucun matériel' },
  ] },
  { key: 'avoid', kind: 'multi', q: 'QUELQUE CHOSE\nÀ MÉNAGER ?', options: [
    { v: 'none', l: 'RIEN — À FOND', names: [] },
    { v: 'back', l: 'BAS DU DOS SENSIBLE', names: ['soulevé de terre'] },
    { v: 'knees', l: 'GENOUX SENSIBLES', names: ['squat bulgare', 'fentes arrière', 'fentes marchées', 'montées sur banc', 'squat hack'] },
    { v: 'shoulders', l: 'ÉPAULES SENSIBLES', names: ['développé militaire', 'dips', 'développé épaules haltères'] },
  ] },
]

export default function Onboarding({ session, profile, onDone }) {
  const [step, setStep] = useState(0)
  const [building, setBuilding] = useState(false)
  const [err, setErr] = useState('')
  const [a, setA] = useState({
    display_name: profile.display_name || '',
    age: '', bodyweight: '', goal: '', experience: '',
    days_per_week: 4, session_minutes: 45, equipment: '', avoid: ['none'],
  })

  const s = STEPS[step]
  const set = (key, val) => setA((p) => ({ ...p, [key]: val }))

  const valid = () => {
    const v = a[s.key]
    if (s.kind === 'text') return String(v).trim().length > 0
    if (s.kind === 'number') return v !== '' && Number(v) >= s.min && Number(v) <= s.max
    if (s.kind === 'single') return !!v
    if (s.kind === 'chips') return v != null
    if (s.kind === 'multi') return v.length > 0
    return true
  }

  const toggleAvoid = (opt) => {
    setA((p) => {
      if (opt.v === 'none') return { ...p, avoid: ['none'] }
      const has = p.avoid.includes(opt.v)
      let next = has ? p.avoid.filter((x) => x !== opt.v) : [...p.avoid.filter((x) => x !== 'none'), opt.v]
      if (next.length === 0) next = ['none']
      return { ...p, avoid: next }
    })
  }

  const next = () => {
    if (!valid()) return
    if (step < STEPS.length - 1) setStep(step + 1)
    else build()
  }

  const build = async () => {
    setBuilding(true); setErr('')
    try {
      const avoidNames = a.avoid
        .map((v) => STEPS.find((x) => x.key === 'avoid').options.find((o) => o.v === v))
        .filter(Boolean).flatMap((o) => o.names)
      const profileInput = {
        age: Number(a.age), bodyweight: Number(a.bodyweight), goal: a.goal,
        experience: a.experience, days_per_week: Number(a.days_per_week),
        session_minutes: Number(a.session_minutes), equipment: a.equipment, avoid: avoidNames,
      }
      const { data: catalog, error: cErr } = await supabase.from('exercises').select('*')
      if (cErr) throw cErr
      const program = generateProgram(profileInput, catalog || [])
      await persistProgram(supabase, session.user.id, program)
      const { data: updated, error: uErr } = await supabase.from('profiles').update({
        display_name: a.display_name.trim(), age: profileInput.age, bodyweight: profileInput.bodyweight,
        goal: a.goal, experience: a.experience, days_per_week: profileInput.days_per_week,
        session_minutes: profileInput.session_minutes, equipment: a.equipment, avoid: avoidNames, onboarded: true,
      }).eq('id', session.user.id).select().single()
      if (uErr) throw uErr
      onDone(updated)
    } catch (e) {
      setErr(e.message || 'Impossible de créer ton programme.')
      setBuilding(false)
    }
  }

  if (building) {
    return (
      <PhoneFrame>
        <div style={{ height: '100%', background: '#0A0A0A', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 30, textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.15)', borderTopColor: accent, animation: 'spin .8s linear infinite' }} />
          <div style={{ fontFamily: c.bebas, fontSize: 38, lineHeight: 0.9, letterSpacing: 1 }}>CRÉATION DE TON<br />PROGRAMME</div>
          <div style={{ font: "600 12px 'Barlow Condensed'", letterSpacing: 1.5, color: c.faint }}>On adapte les exercices à ton profil…</div>
          {err && <div style={{ font: "600 13px 'Barlow Condensed'", color: '#FF5A3C' }}>{err}</div>}
        </div>
      </PhoneFrame>
    )
  }

  const pct = ((step + 1) / STEPS.length) * 100

  const optBox = (selected) => ({
    width: '100%', boxSizing: 'border-box', textAlign: 'left', borderRadius: 16, padding: '16px 18px', cursor: 'pointer',
    background: selected ? accent : '#141414', color: selected ? '#000' : '#fff',
    border: '1px solid ' + (selected ? accent : c.hair9), transition: 'all .15s',
  })

  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: '#0A0A0A', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Barlow Condensed', sans-serif", padding: '56px 24px 28px', boxSizing: 'border-box' }}>
        {/* progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
          {step > 0 && (
            <div onClick={() => setStep(step - 1)} style={{ cursor: 'pointer', fontFamily: c.bebas, fontSize: 22, color: c.faint }}>‹</div>
          )}
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: accent, borderRadius: 3, transition: 'width .3s' }} />
          </div>
          <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 1, color: c.faint }}>{step + 1}/{STEPS.length}</div>
        </div>

        <div style={{ fontFamily: c.bebas, fontSize: 44, lineHeight: 0.88, letterSpacing: 0.5, marginBottom: 24, whiteSpace: 'pre-line' }}>{s.q}</div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {s.kind === 'text' && (
            <input value={a[s.key]} onChange={(e) => set(s.key, e.target.value)} placeholder={s.placeholder} autoFocus
              onKeyDown={(e) => e.key === 'Enter' && next()}
              style={{ width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px 18px', color: '#fff', fontFamily: c.bebas, fontSize: 30, letterSpacing: 1, outline: 'none' }} />
          )}

          {s.kind === 'number' && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px 20px' }}>
              <input type="number" inputMode="decimal" value={a[s.key]} onChange={(e) => set(s.key, e.target.value)} autoFocus placeholder="—"
                onKeyDown={(e) => e.key === 'Enter' && next()}
                style={{ flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: c.bebas, fontSize: 52 }} />
              <span style={{ fontFamily: c.bebas, fontSize: 26, color: c.faint }}>{s.unit}</span>
            </div>
          )}

          {s.kind === 'single' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.options.map((o) => {
                const sel = a[s.key] === o.v
                return (
                  <div key={o.v} onClick={() => set(s.key, o.v)} style={optBox(sel)}>
                    <div style={{ fontFamily: c.bebas, fontSize: 24, letterSpacing: 0.5 }}>{o.l}</div>
                    <div style={{ font: "500 12px 'Barlow Condensed'", letterSpacing: 0.3, color: sel ? 'rgba(0,0,0,0.6)' : c.faint, marginTop: 2 }}>{o.d}</div>
                  </div>
                )
              })}
            </div>
          )}

          {s.kind === 'chips' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {s.options.map((o) => {
                const sel = a[s.key] === o
                return (
                  <div key={o} onClick={() => set(s.key, o)} style={{ minWidth: 72, textAlign: 'center', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', background: sel ? accent : '#141414', color: sel ? '#000' : '#fff', border: '1px solid ' + (sel ? accent : c.hair9), fontFamily: c.bebas, fontSize: 28 }}>
                    {o}{s.suffix}
                  </div>
                )
              })}
            </div>
          )}

          {s.kind === 'multi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.options.map((o) => {
                const sel = a.avoid.includes(o.v)
                return (
                  <div key={o.v} onClick={() => toggleAvoid(o)} style={optBox(sel)}>
                    <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 0.5 }}>{o.l}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div onClick={next} style={{ marginTop: 18, background: valid() ? accent : '#1c1c1c', color: valid() ? '#000' : c.faint, borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 24, letterSpacing: 2, cursor: valid() ? 'pointer' : 'default' }}>
          {step < STEPS.length - 1 ? 'SUIVANT ▸' : 'CRÉER MON PROGRAMME ▸'}
        </div>
      </div>
    </PhoneFrame>
  )
}

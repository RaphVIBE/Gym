import { useState, useEffect } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { c, WEEKDAYS } from './theme.js'

const CAT_CHIPS = ['TOUS', 'POUSSÉE', 'TIRAGE', 'JAMBES', 'ABDOS', 'CARDIO']
const CAT_PATTERNS = { 'POUSSÉE': ['push'], 'TIRAGE': ['pull'], 'JAMBES': ['squat', 'hinge', 'lunge', 'calf'], 'ABDOS': ['core'], 'CARDIO': ['conditioning'] }

export default function ProgramEditor({ uid, accent, programId, catalog, onClose, onReonboard }) {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [days, setDays] = useState([])
  const [picker, setPicker] = useState(null) // { dayId }
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('TOUS')

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!programId) { setLoading(false); return }
      const { data: prog } = await supabase.from('programs').select('name').eq('id', programId).maybeSingle()
      const { data: dayRows } = await supabase.from('program_days').select('*').eq('program_id', programId).order('weekday')
      const ids = (dayRows || []).map((d) => d.id)
      let exByDay = {}
      if (ids.length) {
        const { data: exRows } = await supabase.from('day_exercises').select('*').in('program_day_id', ids).order('position')
        for (const e of exRows || []) (exByDay[e.program_day_id] ||= []).push(e)
      }
      if (!active) return
      setName(prog?.name || '')
      setDays((dayRows || []).map((d) => ({ ...d, exercises: exByDay[d.id] || [] })))
      setLoading(false)
    })()
    return () => { active = false }
  }, [programId])

  const saveName = () => { if (programId) supabase.from('programs').update({ name }).eq('id', programId).then(() => {}) }
  const saveTitle = (dayId, title) => supabase.from('program_days').update({ title }).eq('id', dayId).then(() => {})
  const setDayTitle = (dayId, title) => setDays((ds) => ds.map((d) => (d.id === dayId ? { ...d, title } : d)))

  const toggleRest = (day) => {
    const next = !day.is_rest
    setDays((ds) => ds.map((d) => (d.id === day.id ? { ...d, is_rest: next } : d)))
    supabase.from('program_days').update({ is_rest: next }).eq('id', day.id).then(() => {})
  }

  const removeExercise = (dayId, exId) => {
    setDays((ds) => ds.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d)))
    supabase.from('day_exercises').delete().eq('id', exId).then(() => {})
  }

  const addExercise = async (dayId, ex) => {
    const day = days.find((d) => d.id === dayId)
    const position = day ? day.exercises.length : 0
    const row = {
      program_day_id: dayId, user_id: uid, position, exercise_id: ex.id, name: ex.name,
      muscle_group: ex.muscle_group, pattern: ex.pattern || '', description: ex.description || '',
      sets: 3, reps: ex.default_reps,
      weight: ex.equipment === 'bodyweight' ? 'BW' : '—', rest: '1:30', tempo: '2-1-1', video: ex.name, cues: ex.cues || [],
    }
    const { data } = await supabase.from('day_exercises').insert(row).select().single()
    setDays((ds) => ds.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, data || { ...row, id: Math.random() }] } : d)))
    setPicker(null)
  }

  if (loading) {
    return (
      <PhoneFrame>
        <div style={{ height: '100%', background: '#0A0A0A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: accent, animation: 'spin .8s linear infinite' }} />
        </div>
      </PhoneFrame>
    )
  }

  const q = search.toLowerCase()
  const wantPatterns = CAT_PATTERNS[cat]
  const library = catalog.filter((l) => (!wantPatterns || wantPatterns.includes(l.pattern)) && l.name.toLowerCase().includes(q)).slice(0, 60)

  return (
    <PhoneFrame>
      <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: '#0A0A0A', color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}>
        <div style={{ height: '100%', overflowY: 'auto' }}>
          <div style={{ padding: '54px 20px 130px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="11" height="18" viewBox="0 0 11 18"><path d="M9 2L2 9l7 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div style={{ fontFamily: c.bebas, fontSize: 34, letterSpacing: 1 }}>MODIFIER LE PROGRAMME</div>
            </div>

            {!programId ? (
              <div style={{ marginTop: 30, textAlign: 'center' }}>
                <div style={{ font: "500 14px 'Barlow Condensed'", color: c.faint, marginBottom: 20 }}>Aucun programme actif.</div>
                <div onClick={onReonboard} style={{ background: accent, color: '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 22, letterSpacing: 2, cursor: 'pointer' }}>EN CRÉER UN AVEC LE COACH ▸</div>
              </div>
            ) : (
              <>
                <div style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: 2, color: c.faint, marginBottom: 6 }}>NOM DU PROGRAMME</div>
                <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: '#fff', fontFamily: c.bebas, fontSize: 24, letterSpacing: 0.5, outline: 'none', marginBottom: 22 }} />

                {days.map((day) => (
                  <div key={day.id} style={{ marginBottom: 16, background: '#101010', border: '1px solid ' + c.hair9, borderRadius: 18, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: day.is_rest ? 0 : 12 }}>
                      <div style={{ width: 38, fontFamily: c.bebas, fontSize: 22, color: accent }}>{WEEKDAYS[day.weekday]}</div>
                      <input value={day.is_rest ? 'REPOS' : day.title} disabled={day.is_rest}
                        onChange={(e) => setDayTitle(day.id, e.target.value.toUpperCase())} onBlur={(e) => saveTitle(day.id, e.target.value.toUpperCase())}
                        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: day.is_rest ? c.faint : '#fff', fontFamily: c.bebas, fontSize: 22, letterSpacing: 0.5 }} />
                      <div onClick={() => toggleRest(day)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontFamily: c.bebas, fontSize: 14, letterSpacing: 1, cursor: 'pointer', background: day.is_rest ? accent : 'transparent', color: day.is_rest ? '#000' : c.faint, border: '1px solid ' + (day.is_rest ? accent : 'rgba(255,255,255,0.14)') }}>REPOS</div>
                    </div>

                    {!day.is_rest && (
                      <>
                        {day.exercises.map((ex) => (
                          <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid ' + c.hair }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ font: "600 15px 'Barlow Condensed'", letterSpacing: 0.3 }}>{ex.name}</div>
                              <div style={{ font: "500 10px 'Barlow Condensed'", letterSpacing: 1, color: c.faint, marginTop: 1 }}>{ex.sets} × {ex.reps} · {ex.weight}</div>
                            </div>
                            <div onClick={() => removeExercise(day.id, ex.id)} style={{ width: 26, height: 26, borderRadius: '50%', background: '#1c1c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="#FF5A3C" strokeWidth="2.2" strokeLinecap="round" /></svg>
                            </div>
                          </div>
                        ))}
                        <div onClick={() => { setPicker({ dayId: day.id }); setSearch(''); setCat('TOUS') }} style={{ marginTop: 10, border: '1.5px dashed rgba(255,255,255,0.18)', borderRadius: 12, padding: 10, textAlign: 'center', fontFamily: c.bebas, fontSize: 16, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>+ AJOUTER</div>
                      </>
                    )}
                  </div>
                ))}

                <div onClick={onReonboard} style={{ marginTop: 8, background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', color: accent, borderRadius: 30, padding: 15, textAlign: 'center', fontFamily: c.bebas, fontSize: 20, letterSpacing: 1.5, cursor: 'pointer' }}>↻ REGÉNÉRER AVEC LE COACH</div>
              </>
            )}
          </div>
        </div>

        {/* exercise picker */}
        {picker && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: '#0A0A0A', overflowY: 'auto', animation: 'overlayIn .2s' }}>
            <div style={{ padding: '54px 20px 14px', position: 'sticky', top: 0, background: '#0A0A0A', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div onClick={() => setPicker(null)} style={{ width: 40, height: 40, borderRadius: '50%', background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="11" height="18" viewBox="0 0 11 18"><path d="M9 2L2 9l7 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ fontFamily: c.bebas, fontSize: 30, letterSpacing: 1 }}>AJOUTER À {WEEKDAYS[days.find((d) => d.id === picker.dayId)?.weekday] || ''}</div>
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un exercice…" style={{ width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 16px', color: '#fff', fontFamily: "'Barlow Condensed'", fontSize: 16, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 7, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
                {CAT_CHIPS.map((ch) => (
                  <div key={ch} onClick={() => setCat(ch)} style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 30, fontFamily: c.bebas, fontSize: 15, letterSpacing: 1, cursor: 'pointer', background: cat === ch ? accent : 'transparent', color: cat === ch ? '#000' : 'rgba(255,255,255,0.55)', border: '1px solid ' + (cat === ch ? accent : 'rgba(255,255,255,0.14)') }}>{ch}</div>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 20px 40px' }}>
              {library.map((lib) => (
                <div key={lib.id} onClick={() => addExercise(picker.dayId, lib)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: '1px solid ' + c.hair7, cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 18px 'Barlow Condensed'", letterSpacing: 0.3 }}>{lib.name}</div>
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
      </div>
    </PhoneFrame>
  )
}

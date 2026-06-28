import { useState, useEffect } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { c } from './theme.js'

const CAT_CHIPS = ['TOUS', 'POUSSÉE', 'TIRAGE', 'JAMBES', 'ABDOS', 'CARDIO']
const CAT_PATTERNS = { 'POUSSÉE': ['push'], 'TIRAGE': ['pull'], 'JAMBES': ['squat', 'hinge', 'lunge', 'calf'], 'ABDOS': ['core'], 'CARDIO': ['conditioning'] }

// A program is just a set of sessions (A, B, C…), each an ordered list of exercises.
export default function ProgramEditor({ uid, accent, programId, catalog, onClose, onReonboard }) {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [sessions, setSessions] = useState([])
  const [picker, setPicker] = useState(null) // { sessionId }
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('TOUS')

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!programId) { setLoading(false); return }
      const { data: prog } = await supabase.from('programs').select('name').eq('id', programId).maybeSingle()
      const { data: dayRows } = await supabase.from('program_days').select('*').eq('program_id', programId).order('position')
      const ids = (dayRows || []).map((d) => d.id)
      let exByDay = {}
      if (ids.length) {
        const { data: exRows } = await supabase.from('day_exercises').select('*').in('program_day_id', ids).order('position')
        for (const e of exRows || []) (exByDay[e.program_day_id] ||= []).push(e)
      }
      if (!active) return
      setName(prog?.name || '')
      setSessions((dayRows || []).map((d) => ({ ...d, exercises: exByDay[d.id] || [] })))
      setLoading(false)
    })()
    return () => { active = false }
  }, [programId])

  const saveName = () => { if (programId) supabase.from('programs').update({ name }).eq('id', programId).then(() => {}) }
  const setTitle = (sid, title) => setSessions((ss) => ss.map((s) => (s.id === sid ? { ...s, title } : s)))
  const saveTitle = (sid, title) => supabase.from('program_days').update({ title }).eq('id', sid).then(() => {})

  const addSession = async () => {
    const pos = sessions.length
    const { data } = await supabase.from('program_days')
      .insert({ program_id: programId, user_id: uid, position: pos, weekday: pos, title: 'NOUVELLE SÉANCE', focus: '', is_rest: false })
      .select().single()
    if (data) setSessions((ss) => [...ss, { ...data, exercises: [] }])
  }
  const deleteSession = async (sid) => {
    if (typeof window !== 'undefined' && !window.confirm('Supprimer cette séance ?')) return
    setSessions((ss) => ss.filter((s) => s.id !== sid))
    await supabase.from('program_days').delete().eq('id', sid)
  }

  const addExercise = async (sid, ex) => {
    const s = sessions.find((x) => x.id === sid)
    const position = s ? s.exercises.length : 0
    const row = {
      program_day_id: sid, user_id: uid, position, exercise_id: ex.id, name: ex.name,
      muscle_group: ex.muscle_group, pattern: ex.pattern || '', description: ex.description || '',
      sets: 3, reps: ex.default_reps, weight: ex.equipment === 'bodyweight' ? 'BW' : '—', rest: '1:30', tempo: '2-1-1', video: ex.name, cues: ex.cues || [],
    }
    const { data } = await supabase.from('day_exercises').insert(row).select().single()
    setSessions((ss) => ss.map((s) => (s.id === sid ? { ...s, exercises: [...s.exercises, data || { ...row, id: Math.random() }] } : s)))
    setPicker(null)
  }
  const removeExercise = (sid, exId) => {
    setSessions((ss) => ss.map((s) => (s.id === sid ? { ...s, exercises: s.exercises.filter((e) => e.id !== exId) } : s)))
    supabase.from('day_exercises').delete().eq('id', exId).then(() => {})
  }
  const replaceExercise = async (sid, ex) => {
    const alts = catalog.filter((cx) => cx.pattern === ex.pattern && cx.name !== ex.name)
    if (!alts.length) return
    const pick = alts[Math.floor(Math.random() * alts.length)]
    const patch = {
      exercise_id: pick.id, name: pick.name, muscle_group: pick.muscle_group, pattern: pick.pattern,
      description: pick.description, reps: pick.default_reps, cues: pick.cues, video: pick.name,
      weight: pick.equipment === 'bodyweight' ? 'BW' : ex.weight,
    }
    await supabase.from('day_exercises').update(patch).eq('id', ex.id)
    setSessions((ss) => ss.map((s) => (s.id === sid ? { ...s, exercises: s.exercises.map((e) => (e.id === ex.id ? { ...e, ...patch } : e)) } : s)))
  }
  const moveExercise = async (sid, idx, dir) => {
    const s = sessions.find((x) => x.id === sid); if (!s) return
    const j = idx + dir
    if (j < 0 || j >= s.exercises.length) return
    const arr = s.exercises.slice()
    const a = arr[idx], b = arr[j]
    arr[idx] = b; arr[j] = a
    setSessions((ss) => ss.map((x) => (x.id === sid ? { ...x, exercises: arr } : x)))
    await Promise.all([
      supabase.from('day_exercises').update({ position: idx }).eq('id', b.id),
      supabase.from('day_exercises').update({ position: j }).eq('id', a.id),
    ])
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
  const iconBtn = { width: 26, height: 26, borderRadius: '50%', background: '#1c1c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }

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

                {sessions.map((s, si) => (
                  <div key={s.id} style={{ marginBottom: 16, background: '#101010', border: '1px solid ' + c.hair9, borderRadius: 18, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: '#1f1f1f', border: '1px solid ' + c.hair9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: c.bebas, fontSize: 18, color: accent, flexShrink: 0 }}>{String.fromCharCode(65 + si)}</div>
                      <input value={s.title} onChange={(e) => setTitle(s.id, e.target.value.toUpperCase())} onBlur={(e) => saveTitle(s.id, e.target.value.toUpperCase())}
                        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: c.bebas, fontSize: 22, letterSpacing: 0.5 }} />
                      <div onClick={() => deleteSession(s.id)} style={iconBtn} title="Supprimer la séance">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF5A3C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                      </div>
                    </div>

                    {s.exercises.map((ex, idx) => (
                      <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderTop: '1px solid ' + c.hair }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: "600 15px 'Barlow Condensed'", letterSpacing: 0.3 }}>{ex.name}</div>
                          <div style={{ font: "500 10px 'Barlow Condensed'", letterSpacing: 1, color: c.faint, marginTop: 1 }}>{ex.sets} × {ex.reps} · {ex.weight}</div>
                        </div>
                        <div onClick={() => moveExercise(s.id, idx, -1)} style={{ ...iconBtn, opacity: idx > 0 ? 1 : 0.3 }} title="Monter">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l6-6 6 6" /></svg>
                        </div>
                        <div onClick={() => moveExercise(s.id, idx, 1)} style={{ ...iconBtn, opacity: idx < s.exercises.length - 1 ? 1 : 0.3 }} title="Descendre">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10l6 6 6-6" /></svg>
                        </div>
                        <div onClick={() => replaceExercise(s.id, ex)} style={{ ...iconBtn, color: accent }} title="Remplacer (coach)">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></svg>
                        </div>
                        <div onClick={() => removeExercise(s.id, ex.id)} style={iconBtn} title="Retirer">
                          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="#FF5A3C" strokeWidth="2.2" strokeLinecap="round" /></svg>
                        </div>
                      </div>
                    ))}
                    <div onClick={() => { setPicker({ sessionId: s.id }); setSearch(''); setCat('TOUS') }} style={{ marginTop: 10, border: '1.5px dashed rgba(255,255,255,0.18)', borderRadius: 12, padding: 10, textAlign: 'center', fontFamily: c.bebas, fontSize: 16, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>+ AJOUTER UN EXERCICE</div>
                  </div>
                ))}

                <div onClick={addSession} style={{ border: '1.5px dashed rgba(255,255,255,0.25)', borderRadius: 16, padding: 14, textAlign: 'center', fontFamily: c.bebas, fontSize: 18, letterSpacing: 1.5, color: accent, cursor: 'pointer', marginBottom: 14 }}>+ AJOUTER UNE SÉANCE</div>

                <div onClick={onReonboard} style={{ background: '#1c1c1c', border: '1px solid rgba(255,255,255,0.12)', color: accent, borderRadius: 30, padding: 15, textAlign: 'center', fontFamily: c.bebas, fontSize: 20, letterSpacing: 1.5, cursor: 'pointer' }}>↻ REGÉNÉRER AVEC LE COACH</div>
              </>
            )}
          </div>
        </div>

        {/* picker */}
        {picker && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 90, background: '#0A0A0A', overflowY: 'auto', animation: 'overlayIn .2s' }}>
            <div style={{ padding: '54px 20px 14px', position: 'sticky', top: 0, background: '#0A0A0A', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div onClick={() => setPicker(null)} style={{ width: 40, height: 40, borderRadius: '50%', background: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="11" height="18" viewBox="0 0 11 18"><path d="M9 2L2 9l7 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ fontFamily: c.bebas, fontSize: 30, letterSpacing: 1 }}>AJOUTER UN EXERCICE</div>
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
                <div key={lib.id} onClick={() => addExercise(picker.sessionId, lib)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: '1px solid ' + c.hair7, cursor: 'pointer' }}>
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

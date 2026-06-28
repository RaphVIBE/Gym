import { useState } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase, KEEP_KEY } from './supabase.js'
import { c, ACCENT_DEFAULT } from './theme.js'

const accent = ACCENT_DEFAULT

export default function AuthScreen() {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keep, setKeep] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async () => {
    setError(''); setNotice('')
    try { if (typeof window !== 'undefined') window.localStorage.setItem(KEEP_KEY, keep ? '1' : '0') } catch { /* storage unavailable */ }
    if (!email || !password) { setError('Saisis ton e-mail et ton mot de passe.'); return }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) setNotice('Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.')
        // if confirmation is off, onAuthStateChange signs the user straight in
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setError(e.message || 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  const field = {
    width: '100%', boxSizing: 'border-box', background: '#161616', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '15px 16px', color: '#fff', fontFamily: "'Barlow Condensed'", fontSize: 17, outline: 'none',
  }

  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: '#0A0A0A', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px', fontFamily: "'Barlow Condensed', sans-serif" }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`, opacity: 0.13 }} />

        <div style={{ fontFamily: c.bebas, fontSize: 22, letterSpacing: 4, color: accent }}>PULSE GYM</div>
        <div style={{ fontFamily: c.bebas, fontSize: 56, lineHeight: 0.86, letterSpacing: 1, marginTop: 8, marginBottom: 30 }}>
          {mode === 'login' ? <>BON<br />RETOUR</> : <>CRÉE TON<br />PROGRAMME</>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" style={field} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" onKeyDown={(e) => e.key === 'Enter' && submit()} style={field} />
        </div>

        <div onClick={() => setKeep((k) => !k)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: 'pointer' }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: keep ? accent : 'transparent', border: '1.5px solid ' + (keep ? accent : 'rgba(255,255,255,0.25)') }}>
            {keep && <svg width="14" height="14" viewBox="0 0 18 18"><path d="M3 9.5l4 4 8-9" fill="none" stroke="#000" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ font: "600 14px 'Barlow Condensed'", letterSpacing: 0.3, color: 'rgba(255,255,255,0.8)' }}>Rester connecté</span>
        </div>

        {error && <div style={{ font: "600 13px 'Barlow Condensed'", color: '#FF5A3C', marginTop: 14 }}>{error}</div>}
        {notice && <div style={{ font: "600 13px 'Barlow Condensed'", color: accent, marginTop: 14 }}>{notice}</div>}

        <div onClick={busy ? undefined : submit} style={{ marginTop: 22, background: accent, color: '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 24, letterSpacing: 2, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'PATIENTE…' : (mode === 'login' ? 'SE CONNECTER ▸' : 'CRÉER UN COMPTE ▸')}
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, font: "600 13px 'Barlow Condensed'", letterSpacing: 0.5, color: c.faint }}>
          {mode === 'login' ? 'Nouveau ici ? ' : 'Déjà un compte ? '}
          <span onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }} style={{ color: accent, cursor: 'pointer', fontWeight: 700 }}>
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </span>
        </div>
      </div>
    </PhoneFrame>
  )
}

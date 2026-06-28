import { useState } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { c, ACCENT_DEFAULT } from './theme.js'

const accent = ACCENT_DEFAULT

export default function AuthScreen() {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async () => {
    setError(''); setNotice('')
    if (!email || !password) { setError('Enter your email and password.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) setNotice('Account created. Check your email to confirm, then sign in.')
        // if confirmation is off, onAuthStateChange signs the user straight in
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setError(e.message || 'Something went wrong.')
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
          {mode === 'login' ? <>WELCOME<br />BACK</> : <>BUILD YOUR<br />PROGRAM</>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={field} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" onKeyDown={(e) => e.key === 'Enter' && submit()} style={field} />
        </div>

        {error && <div style={{ font: "600 13px 'Barlow Condensed'", color: '#FF5A3C', marginTop: 14 }}>{error}</div>}
        {notice && <div style={{ font: "600 13px 'Barlow Condensed'", color: accent, marginTop: 14 }}>{notice}</div>}

        <div onClick={busy ? undefined : submit} style={{ marginTop: 22, background: accent, color: '#000', borderRadius: 30, padding: 16, textAlign: 'center', fontFamily: c.bebas, fontSize: 24, letterSpacing: 2, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'PLEASE WAIT…' : (mode === 'login' ? 'SIGN IN ▸' : 'CREATE ACCOUNT ▸')}
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, font: "600 13px 'Barlow Condensed'", letterSpacing: 0.5, color: c.faint }}>
          {mode === 'login' ? "New here? " : 'Already have an account? '}
          <span onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }} style={{ color: accent, cursor: 'pointer', fontWeight: 700 }}>
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </span>
        </div>
      </div>
    </PhoneFrame>
  )
}

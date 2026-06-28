import { useState, useEffect } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { c, ACCENT_DEFAULT } from './theme.js'
import AuthScreen from './AuthScreen.jsx'
import Onboarding from './Onboarding.jsx'
import MainApp from './MainApp.jsx'

function Splash({ text = 'LOADING' }) {
  return (
    <PhoneFrame>
      <div style={{ height: '100%', background: '#0A0A0A', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontFamily: c.bebas, fontSize: 40, letterSpacing: 2, color: ACCENT_DEFAULT }}>PULSE</div>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: ACCENT_DEFAULT, animation: 'spin .8s linear infinite' }} />
        <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 2, color: 'rgba(255,255,255,0.4)' }}>{text}</div>
      </div>
    </PhoneFrame>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // ---- auth session ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // ---- profile (create-if-missing fallback in case the trigger lagged) ----
  useEffect(() => {
    if (!session) { setProfile(null); return }
    let active = true
    setProfileLoading(true)
    ;(async () => {
      const uid = session.user.id
      let { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (!data) {
        const prefix = (session.user.email || 'ATHLETE').split('@')[0]
        const ins = await supabase.from('profiles').insert({ id: uid, display_name: prefix }).select().single()
        data = ins.data
      }
      if (active) { setProfile(data); setProfileLoading(false) }
    })()
    return () => { active = false }
  }, [session])

  if (session === undefined) return <Splash />
  if (!session) return <AuthScreen />
  if (profileLoading || !profile) return <Splash />
  if (!profile.onboarded) {
    return <Onboarding session={session} profile={profile} onDone={(p) => setProfile(p)} />
  }
  return (
    <MainApp
      session={session}
      profile={profile}
      onProfileChange={setProfile}
      onReonboard={() => setProfile({ ...profile, onboarded: false })}
      onSignOut={() => supabase.auth.signOut()}
    />
  )
}

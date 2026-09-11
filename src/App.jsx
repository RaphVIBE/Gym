import { useState, useEffect } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import { supabase } from './supabase.js'
import { ACCENT_DEFAULT } from './theme.js'
import PulseLoader from './PulseLoader.jsx'
import AuthScreen from './AuthScreen.jsx'
import Onboarding from './Onboarding.jsx'
import MainApp from './MainApp.jsx'

function Splash({ text = 'CHARGEMENT' }) {
  return (
    <PhoneFrame>
      <PulseLoader accent={ACCENT_DEFAULT} label={text} />
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

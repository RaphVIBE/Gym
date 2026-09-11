// The Pulse mark as a loading indicator.
//
// PULSE_PATH is the simplified logo — the ECG line from public/icon-512.png,
// stripped of its glow and redrawn on a 120×56 grid (baseline y = 28).
// The beat comes from two layers: a dim full-length "track" so the mark stays
// readable at all times, and a bright trace that sweeps along it like a heart
// monitor. The whole mark thumps up on the R-wave and dips on the trough, so
// the sweep and the scale read as one heartbeat instead of two animations.
//
// All motion lives in index.css (.pulse-mark*), which the pre-React boot
// splash in index.html mirrors inline — keep the two in sync.
import { useState, useEffect, useRef } from 'react'
import { c, ACCENT_DEFAULT } from './theme.js'

export const PULSE_PATH = 'M4 28H38L48 9L59 48L69 20L75 28H116'

const RATIO = 56 / 120

// ---- how long the beat gets to breathe --------------------------------

// One full cycle of the animation (must match index.css).
export const BEAT_MS = 1400
// Minimum time the mark stays on screen once it appears: one complete stroke,
// i.e. the point where the sweep reaches the end of the line (60 % of the
// cycle). Long enough to feel the beat, short enough not to read as a wait.
export const BREATH_MS = 840
// A load under this reads as instant — no loader at all, rather than a beat
// nobody has time to see. Past it, the mark appears and owes a full stroke.
const FLASH_MS = 200

// Gates a loading state so it never flashes: nothing at all for very short
// loads, and once the mark is up, a full stroke before it leaves.
// Returns whether the loader should be on screen — which outlives `loading`.
export function useBreath(loading, { delay = FLASH_MS } = {}) {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (loading) {
      if (visible) return undefined
      const t = setTimeout(() => {
        // Inside the first breath of the page's life, the boot splash has had
        // the mark on screen since first paint — continue that beat instead of
        // stacking a second one on top of it.
        const sinceLoad = performance.now()
        shownAt.current = Date.now() - (sinceLoad < BREATH_MS ? sinceLoad : 0)
        setVisible(true)
      }, delay)
      return () => clearTimeout(t)
    }
    if (!visible) return undefined
    const left = shownAt.current + BREATH_MS - Date.now()
    if (left <= 0) { setVisible(false); return undefined }
    const t = setTimeout(() => setVisible(false), left)
    return () => clearTimeout(t)
  }, [loading, visible, delay])

  return visible
}

// The simplified logo. `beating={false}` gives the static mark.
export function PulseMark({ size = 120, accent = ACCENT_DEFAULT, beating = true }) {
  const height = Math.round(size * RATIO)
  return (
    <div
      className={'pulse-mark' + (beating ? ' pulse-mark--beating' : '')}
      style={{ width: size, height, '--pulse-accent': accent, '--pulse-glow': Math.max(2, Math.round(size * 0.045)) + 'px' }}
    >
      <svg viewBox="0 0 120 56" width={size} height={height} fill="none" aria-hidden="true">
        <path className="pulse-mark__track" d={PULSE_PATH} pathLength="100" />
        {beating && <path className="pulse-mark__trace" d={PULSE_PATH} pathLength="100" />}
      </svg>
    </div>
  )
}

// Full-screen loading state: drop it inside a <PhoneFrame>.
export default function PulseLoader({ accent = ACCENT_DEFAULT, label = 'CHARGEMENT', size = 132, children }) {
  return (
    <div
      role="status"
      aria-label={label || 'Chargement'}
      style={{
        height: '100%', background: '#0A0A0A', color: '#fff', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 18, padding: 30, textAlign: 'center',
      }}
    >
      <PulseMark size={size} accent={accent} />
      {children}
      {label && (
        <div style={{ font: "600 11px 'Barlow Condensed'", letterSpacing: 2.5, color: c.faint }}>{label}</div>
      )}
    </div>
  )
}

// Loading state for a single heavy block — an exercise image, a video poster,
// a chart. Absolutely fills its (positioned) parent behind a soft scrim.
export function PulseOverlay({ accent = ACCENT_DEFAULT, size = 56, radius = 14 }) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,10,0.72)', borderRadius: radius, pointerEvents: 'none',
      }}
    >
      <PulseMark size={size} accent={accent} />
    </div>
  )
}

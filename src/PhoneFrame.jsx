// iOS-style device frame — wraps the app screen at 402 × 874 (logical),
// scaled to fit smaller viewports.
export default function PhoneFrame({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, boxSizing: 'border-box', background: '#1a1a1a' }}>
      <div style={{
        position: 'relative',
        width: 402,
        height: 874,
        maxHeight: 'calc(100vh - 60px)',
        aspectRatio: '402 / 874',
        borderRadius: 56,
        padding: 12,
        background: 'linear-gradient(145deg,#2a2a2a,#0d0d0d)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.04)',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}>
        {/* screen */}
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 44, overflow: 'hidden', background: '#0A0A0A' }}>
          {/* dynamic island */}
          <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 110, height: 32, borderRadius: 18, background: '#000', zIndex: 200 }} />
          {children}
        </div>
      </div>
    </div>
  )
}

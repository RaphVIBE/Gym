// Full-screen app shell. Fills the viewport edge-to-edge on mobile; on wide
// screens it centers a phone-width column (no device frame).
export default function PhoneFrame({ children }) {
  return (
    <div style={{ width: '100%', height: '100dvh', background: '#0A0A0A', display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100dvh', background: '#0A0A0A', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Hand the beat over from the inline boot splash (index.html) to React's own.
// Both draw the same mark, so a short crossfade after the first paint hides the
// fact that the two animations are out of phase.
//
// rAF is the right signal (it fires once React has painted) but it never runs
// in a background tab, so a timer races it — otherwise the splash would sit on
// top of a mounted app until the tab is focused.
const boot = document.getElementById('boot')
if (boot) {
  let started = false
  const dismiss = () => {
    if (started) return
    started = true
    boot.classList.add('boot--done')
    const drop = () => boot.remove()
    boot.addEventListener('transitionend', drop, { once: true })
    setTimeout(drop, 600)
  }
  requestAnimationFrame(() => requestAnimationFrame(dismiss))
  setTimeout(dismiss, 250)
}

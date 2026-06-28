# Pulse Gym

A Nike-inspired workout tracker, built from the `Pulse Gym.dc.html` design comp as a Vite + React app.

## Features

- **Home** — today's session hero, weekly split, quick stats (sessions/week, streak, body weight).
- **Train** — Focus and List views of the current session, tap a checkbox to mark sets complete, progress ring, and an add-exercise flow with search + category filters.
- **Exercise detail** — form video placeholder, key metrics, per-set log, form cues, and a mark-complete button.
- **Stats** — body-weight trend chart, log-weight bottom sheet, PR tiles, sessions/week bars, and drop-in progress photos.

All state is in-memory (React `useState`), faithful to the original comp logic.

## Run

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

Then open the printed local URL (default http://localhost:5173).

## Structure

```
index.html            # Vite entry, loads Google Fonts (Bebas Neue, Barlow Condensed)
src/
  main.jsx            # React root
  App.jsx             # full app: state, views, overlays
  PhoneFrame.jsx      # iOS device frame wrapper
  index.css           # global styles + keyframes
```

## Customize

Brand accent, athlete name, and default Train view are constants at the top of `src/App.jsx`:

```js
const ACCENT = '#D9FF00'   // try '#FF5A3C', '#3D7BFF', '#FFFFFF'
const ATHLETE = 'ALEX'
const DEFAULT_VIEW = 'focus' // or 'list'
```

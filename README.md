# Pulse Gym

A Nike-inspired workout tracker, built from the `Pulse Gym.dc.html` design comp as a Vite + React app.

## Features

- **Home** — today's session hero, weekly split, quick stats (sessions/week, streak, body weight).
- **Train** — Focus and List views of the current session, tap a checkbox to mark sets complete, progress ring, and an add-exercise flow with search + category filters.
- **Exercise detail** — form video placeholder, key metrics, per-set log, form cues, and a mark-complete button.
- **Stats** — body-weight trend chart, log-weight bottom sheet, PR tiles, sessions/week bars, and drop-in progress photos.

Workout completion and body-weight history persist to **Supabase** (single shared dataset, no login).

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
netlify.toml          # Netlify build + SPA redirect config
.env                  # Supabase URL + publishable key (gitignored)
.env.example          # template for the above
src/
  main.jsx            # React root
  App.jsx             # full app: state, views, overlays, Supabase load/save
  PhoneFrame.jsx      # iOS device frame wrapper
  supabase.js         # Supabase client
  index.css           # global styles + keyframes
```

## Backend (Supabase)

Two tables, both with row-level security:

- `session_exercises` — the current workout (name, scheme, load, completion, form cues).
- `weight_log` — body-weight entries over time.

The publishable (anon) key is safe to ship in the browser; access is governed by RLS.
Config lives in `.env` locally, with committed fallbacks in `src/supabase.js` so the
app builds anywhere. Override per-environment with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`.

> The single-dataset setup uses permissive `anon` policies by design. Add Supabase
> Auth + per-user RLS if you later want private, per-account data.

## Deploy (Netlify)

`netlify.toml` is preconfigured (`npm run build` → publish `dist/`, SPA fallback).
Connect the GitHub repo in Netlify and it deploys on every push — no env vars
required thanks to the committed publishable-key fallback.

## Customize

Brand accent, athlete name, and default Train view are constants at the top of `src/App.jsx`:

```js
const ACCENT = '#D9FF00'   // try '#FF5A3C', '#3D7BFF', '#FFFFFF'
const ATHLETE = 'ALEX'
const DEFAULT_VIEW = 'focus' // or 'list'
```

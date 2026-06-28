# Pulse Gym

A Nike-inspired workout tracker built from the `Pulse Gym.dc.html` design comp as a Vite + React app, backed by Supabase with per-user accounts and a rule-based program generator ("Coach").

## Features

- **Accounts** — email + password sign-up/login (Supabase Auth). Every user's data is private, enforced by row-level security.
- **Coach onboarding** — a short questionnaire (age, bodyweight, goal, experience, days/week, session length, equipment, things to avoid) generates a tailored weekly program: the split, rep/rest schemes, exercise selection, and conservative starting loads are all derived from your answers.
- **Home** — today's session hero, your real weekly split, and live stats (sessions this week, day streak, body weight).
- **Train** — Focus and List views, tap to complete (persisted as a dated workout), progress ring, and an add-exercise flow drawing from the tagged exercise catalog.
- **Exercise detail** — metrics, per-set log, and form cues.
- **Stats** — body-weight trend, log-weight sheet, real sessions-per-week bars, and drop-in progress photos.
- **Program editor** — rename your program, set each weekday's title or mark it rest, add/remove exercises per day, or rebuild from scratch with Coach.

## Run

```bash
npm install
npm run dev      # dev server (default http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Architecture

```
index.html            # Vite entry, Google Fonts
netlify.toml          # Netlify build + SPA redirect
.env / .env.example   # Supabase URL + publishable key
src/
  main.jsx            # React root
  App.jsx             # gate: auth → onboarding → main app
  AuthScreen.jsx      # email/password login + signup
  Onboarding.jsx      # Coach questionnaire → generated program
  MainApp.jsx         # Home / Train / Stats, overlays, account menu
  ProgramEditor.jsx   # edit days + exercises, rebuild
  coach.js            # rule-based program generator (pure, AI-ready)
  supabase.js         # Supabase client
  PhoneFrame.jsx      # iOS device frame
  theme.js            # shared tokens + date helpers
  index.css           # global styles + keyframes
```

### How Coach works

`coach.js` is a pure function of `(profile, catalog)`. It maps training frequency to a split (3→full body, 4→upper/lower, 5→PPL+UL, 6→PPL×2), the goal to a set/rep/rest scheme (strength = heavy/low-rep/long-rest, hypertrophy = moderate, fat loss/conditioning = higher-rep/short-rest + a finisher), and age/experience to volume and conservative bodyweight-scaled load estimates. Exercises are pulled from the tagged `exercises` catalog filtered by equipment and your "avoid" list, balanced across movement patterns with no repeats inside a day. To swap in an AI engine later, replace `generateProgram`'s body with a call that returns the same `{ name, goal, days[] }` shape — `persistProgram` is unchanged.

## Backend (Supabase)

Tables (all user-scoped via RLS except the shared read-only catalog):

- `profiles` — questionnaire answers + accent.
- `exercises` — tagged movement catalog (pattern, muscle, equipment, difficulty, cues). Shared, read-only.
- `programs` → `program_days` → `day_exercises` — the plan template.
- `workouts` → `workout_exercises` — actual dated sessions and completion state.
- `weight_log` — body-weight entries.

A trigger creates a `profile` on signup. The publishable key ships in the browser safely — access is governed by RLS.

> **Auth setup:** for instant signups (small, known group), disable email confirmation in the Supabase dashboard under Authentication → Sign In / Providers → Email → "Confirm email" off. With it on, new users must click a confirmation link before their first sign-in.

## Deploy (Netlify)

`netlify.toml` is preconfigured (`npm run build` → publish `dist/`, SPA fallback). Connect the GitHub repo in Netlify and it deploys on every push. No env vars required thanks to the committed publishable-key fallback in `supabase.js`.

# Nutrition Tracker — Claude Context

## What this app is

Personal single-user nutrition tracker. Logs daily totals for six macros: calories, protein, carbs, fat, added sugar, and fiber. Runs entirely in the browser — no server, no accounts, no sync. Data lives in `localStorage`. One person uses this; no multi-user or sharing features are needed.

## Tech stack

| Concern | Choice |
|---|---|
| Languages | Vanilla HTML + CSS + JavaScript — no framework |
| Charts | Chart.js v4 via CDN |
| Excel export | SheetJS (xlsx) v0.18.5 via CDN |
| Storage | `localStorage` (`nt_logs` array, `nt_goals` object) |
| Fonts | Plus Jakarta Sans via Google Fonts |
| Build step | None — open `index.html` directly in Chrome to test |
| Hosting | Vercel (auto-deploys from GitHub `main` branch) |

No Node.js, no npm, no bundler. All dependencies are CDN `<script>` tags in `index.html`.

## Files

```
Nutrition Tracker/
├── index.html   — single HTML file, all views as sections
├── style.css    — all styles, CSS custom properties for theming
└── app.js       — all logic: storage, rendering, charts, export
```

Three files only. Do not create additional JS/CSS files or folders.

## Design system

**Dark theme.** Key CSS variables (all defined in `:root` in `style.css`):

```css
--bg-base:     #090E1A   /* page background */
--bg-surface:  #111827   /* cards */
--bg-elevated: #1A2236   /* hover state, chart bg */
--bg-border:   #1F2D45   /* card borders */

--accent-start: #FF6B35  /* orange gradient start */
--accent-end:   #FFAD5C  /* orange gradient end */
--accent-solid: #FF7A40  /* single-color accent */
--accent-glow:  rgba(255, 107, 53, 0.22)

--text-primary:   #F1F5F9
--text-secondary: #8BA0BE
--text-dim:       #3D5278

--ok:   #4ADE80   /* green */
--warn: #FBBF24   /* amber */
--over: #F87171   /* red */

--radius-sm: 8px  --radius-md: 16px  --radius-lg: 24px  --radius-full: 9999px
```

**Active nav / primary buttons:** `linear-gradient(120deg, var(--accent-start), var(--accent-end))`  
**Cards:** `--bg-surface` background, `1px solid --bg-border`, `--radius-md` corners  
**Decorative orb:** fixed radial-gradient blur element at top of page, z-index 0  
**Header:** sticky, frosted glass (`backdrop-filter: blur(16px)`)

## Navigation & views

Single-page app. Views are `<section id="view-*" class="view">` toggled with `.active`. Nav buttons use `data-view` attributes; the generic listener in `app.js` wires them up.

Current tabs in order: **Dashboard → Log Today → Weekly → Monthly → History → Goals**

Dashboard is the default landing view (`showView('dashboard')` at init).

## The six macros

`NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber']`

Stored per-day as `{ date, calories, protein, carbs, fat, sugar, fiber }`.  
Units: calories = kcal, all others = g.

## Dashboard color-coding thresholds

Defined as `THRESHOLDS` and `NUTRIENT_TYPE` constants at the top of `app.js` — easy to find and adjust.

| Nutrient | Type | Green | Amber | Red |
|---|---|---|---|---|
| Calories, Protein, Carbs | `maximize` | ≥ 95% of goal | 75–95% | < 75% |
| Fat, Added Sugar | `minimize` | ≤ 90% of goal | 90–100% | > 100% |
| Fiber | `goldilocks` | 85–115% of goal | 70–85% or 115–130% | < 70% or > 130% |

The `thresholdClass(nutrient, pct)` helper in `app.js` returns `'green'`, `'amber'`, or `'red'`.  
The older `colorClass(value, goal)` helper is still used in Log/History views (simpler: green ≤ 100%, amber 100–120%, red > 120%).

## Key decisions — do not revisit without asking

- **Firebase was fully implemented then removed.** Do not reintroduce any cloud sync, authentication, or backend without the user explicitly requesting it.
- **No npm / no build tools.** The user has no Node.js installed. Everything must work by opening `index.html` in a browser.
- **localStorage only.** Cross-device sync is a known limitation the user has accepted.
- **Progress view was removed.** There was a dedicated "Today's Progress" view — it was deleted. Do not recreate it.

## Deployment workflow

```
edit files → git add/commit → git push → Vercel auto-deploys
```

Remote is `https://github.com/jainxsahil/nutrition-tracker.git`, branch `main`.  
Live URL: `https://nutrition-tracker-eight-zeta.vercel.app/`  
No build command — Vercel serves static files directly.

## Code conventions

- **No comments** except where the why is non-obvious. No docstrings.
- **Constants at top of `app.js`:** `NUTRIENTS`, `LABELS`, `UNITS`, `COLORS`, `DEFAULT_GOALS`, `THRESHOLDS`, `NUTRIENT_TYPE`, `SHORT_LABELS`.
- **Render functions** named `render*()` — called from `showView()`. Each is idempotent (safe to call multiple times).
- **Chart instances** stored as module-level vars (`weeklyChartInst`, `monthlyChartInst`); destroyed before recreating.
- **Toast notifications** via `showToast(msg)` — never use `alert()`.
- **Date strings** are always `YYYY-MM-DD` format. `todayStr()` produces them; `formatDate(dateStr)` converts to human-readable.
- **CSS class naming:** BEM-lite — block prefix per component (`.dash-*`, `.history-*`, `.hero-*`, `.toggle-*`, etc.).
- **Animations:** count-up via `countUp(el, target, duration, decimals)`, bar fills via CSS transition triggered by JS `setTimeout` with staggered delays.

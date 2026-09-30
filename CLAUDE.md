# Illuminate — Project Instructions for Claude Code

Illuminate is a **pure client-side JavaScript Progressive Web App (PWA)** — Chinese metaphysics (BaZi,
Zi Wei Dou Shu, Qi Men Dun Jia, Feng Shui, I Ching, Numerology, Bone Weight) + Western astrology, plus
Singapore Pools 4D/TOTO lottery number prediction. There is no backend framework: `serve_illuminate.py`
(or `start_illuminate.bat` on Windows) is just a tiny static file server so the PWA can load its own
files over `http://` instead of `file://` (service workers and some browser APIs need that).

## Standing project instructions (always follow these)

1. **Test using the test cases in `test data.xlsx`** (repo root) — this is the reference dataset for
   verifying calculations across all systems (BaZi, Zi Wei Dou Shu, QMDJ, Western astrology, etc.).
2. **After any bug fix or enhancement, run the full regression suite** (`bash tests/run_all_tests.sh` —
   see `tests/README.md`) to confirm nothing else broke, before considering the work done.
3. **Every content update must be reflected in the PDF export.** This app has a live/screenshot PDF
   export pipeline (`html2canvas`/`jsPDF`-based) built from the same tabbed section registry every chart
   view renders from (`chartTabRegistry` in `app.js`) — so a new reading only needs to be wired into one
   of the 4 tab groups (`core`/`timing`/`environment`/`more`) to automatically appear in both the live
   view and the PDF. There is also a dormant native PDF pipeline (`buildNativePdfDocument`, gated behind
   `USE_NATIVE_PDF_EXPORT = false`) — leave it alone unless specifically asked to revisit it.
4. **Always update `UPDATE_NOTES_AND_INSTRUCTIONS.md` after every fix or enhancement** — it is the
   authoritative, dated running changelog for this project (see below). Add a new dated entry at the top
   describing what was requested, what was found, what was built, and how it was verified; do not delete
   or rewrite older entries.
5. **Nothing half-baked — everything must be factual and defensible.** This project has a hard-won
   history of catching (and then banning) fabricated/hardcoded/half-computed results. Any new
   calculation must trace back to a real, disclosed, sourced convention (cite it in a code comment the
   way the rest of the codebase already does) — never invented numerology, never a plausible-looking
   value that isn't actually computed from the inputs. When two established conventions genuinely
   conflict (e.g. Placidus vs Equal House systems, Mean vs True lunar node), name which one is used and
   why, rather than picking silently.
6. **Deliver a complete, tested file set when work is done.** Historically this meant packaging every
   changed file for manual download; in this repo, a normal commit is the equivalent — commit the
   changed files together with the matching `UPDATE_NOTES_AND_INSTRUCTIONS.md` entry.

## Repository layout

```
index.html                       Entry point / shell
app.js                           UI rendering, profile forms, chart/report assembly, PDF export (~1MB+)
engine-core.js                   Calendars, base tables (stems/branches, country/timezone/lat-lon data)
engine-metaphysics.js            Core metaphysics math (BaZi, Zi Wei Dou Shu, QMDJ, Western astrology,
                                  synastry, houses/Ascendant, compatibility scoring engines)
engine-predictions.js            4D/TOTO lottery prediction + number-compatibility auditing
auth.js                          Local auth/session wiring
styles.css                       All styling
serve_illuminate.py              Local static file server (python3 serve_illuminate.py)
start_illuminate.bat             Windows convenience launcher (calls the same server)
test data.xlsx                   Reference test-case dataset (see standing instruction #1)
UPDATE_NOTES_AND_INSTRUCTIONS.md Full dated changelog/history — READ THIS FIRST for project context
package.json                     devDependency (jsdom) + `npm test` wiring for the regression suite
tests/                           Regression test suite (106 files, ~1950 checks) — see tests/README.md
CLAUDE.md                        This file
SESSION_HISTORY_SUMMARY.md       Condensed narrative summary of the engagement to date
```

## Running the app locally

```bash
python3 serve_illuminate.py     # then open the URL it prints (typically http://localhost:8000 or similar)
```

or on Windows, double-click `start_illuminate.bat`.

## Running the regression suite

```bash
npm install        # installs jsdom (the only hard dependency; playwright is optional, see tests/README.md)
npm test           # or: bash tests/run_all_tests.sh
```

Expected baseline at the time of this migration: **1950 checks, 0 failed** across 106 test files (2 of
them — the Playwright/Chromium browser probes — report 0/0 unless `playwright` and a running local
server are set up; see `tests/README.md`).

## Load order (must never change without updating every test that relies on it)

`index.html` loads, in this exact order: `engine-core.js` → `engine-metaphysics.js` →
`engine-predictions.js` → `auth.js` → `app.js`. Several functions in `engine-metaphysics.js` (e.g.
`SIGN_PROFILE_TABLE`, `HOUSE_LIFE_AREAS`) were historically bitten by calling `app.js`'s `bt(en, zh)`
bilingual helper at module-load time, before `app.js` (and `bt`) had loaded — hence the `EZ(en, zh)`
load-order-safe `{en, zh}` pair-builder pattern used throughout `engine-metaphysics.js` for any
top-level table. Keep using it for new top-level tables in that file.

## Known project-specific gotchas (learned the hard way — see UPDATE_NOTES_AND_INSTRUCTIONS.md for the
full incident write-ups)

- **Bilingual pair-object bug class:** `bt(en, zh)` resolves to a plain STRING for whichever language is
  currently active — it is NOT an `{en, zh}` object. Storing `const note = bt(...)` and later reading
  `note.en`/`note.zh` silently produces `undefined` in the output (this exact bug was caught and fixed in
  `describeMonthlyHighlightMeaning` — search `UPDATE_NOTES_AND_INSTRUCTIONS.md` for "the literal word
  \"undefined\""). When you need a value in both languages for later use, build a real `{en, zh}` object
  and resolve it with a single `bt()` call at the point of final output, not before.
- **`str_replace`/edit duplication pattern:** when replacing a whole section, verify old content beneath
  the replaced header is fully removed — a recurring mistake was replacing only the header line and
  leaving the old body dangling below it.
- **Object-shape regressions:** when changing a function's expected input shape (e.g. from a `.bazi`
  sub-object convention to a flat profile object), every call site must be updated in the same change —
  partial migrations have caused real regressions before.
- **Test harness pattern (see any `tests/test_*.js`):** tests load the 5 app files into a shared Node
  `vm` sandbox (via `jsdom`) in the real script load order, then call functions via `vm.runInContext`.
  Two recurring gotchas: (1) assigning a result in the *Node* scope (`x = run('someFn()')`) does NOT make
  `x` visible to a *later* `run('...')` call — you must assign it inside the sandbox too
  (`run('var x = someFn(); x')`); (2) `generateDeepAnalysisData(type, p, extraData, rawOnly)` returns an
  HTML string unless the 4th arg `rawOnly` is `true`, in which case it returns a plain object — always
  `JSON.stringify()` a rawOnly result before running regex checks against it, or `.test()` silently
  coerces the object to `"[object Object]"`.
- **This app performs no geocoding** on free-text addresses by design — address-based readings use
  digit/elemental analysis (plus Ba Zhai/Flying Star when a facing direction is on file), not distance or
  location lookups.

## Where to look for context before starting new work

Read `UPDATE_NOTES_AND_INSTRUCTIONS.md` top-to-bottom (newest entry first) before making changes — it is
long, but it is the single source of truth for what has already been tried, fixed, confirmed working, or
deliberately left unimplemented (with the reason why), across the whole life of this project. Also read
`SESSION_HISTORY_SUMMARY.md` for a condensed narrative of the most recent working sessions.

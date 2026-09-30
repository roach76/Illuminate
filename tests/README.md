# Illuminate — Regression Test Suite

106 test files (`test_*.js`), ~1950 individual checks as of this migration. Each file is self-contained
and follows the same pattern (see `CLAUDE.md` at the repo root for the two recurring gotchas to know
about when writing new ones).

## Setup

```bash
cd ..                 # repo root
npm install            # installs jsdom (the only hard dependency)
```

`playwright` is listed as an `optionalDependency` — it's only used by 2 files
(`test_toc_grouping_probe.js` and `test_main_deep_analysis_registry_leak_fix.js`), both of which drive
the real app in headless Chromium against a locally running server because `jsdom` cannot execute
`html2canvas`/`jsPDF`'s real text layout. If `playwright` isn't installed, these 2 files simply report
`0 passed, 0 failed` rather than erroring — this is expected and matches how they've always behaved in
environments without Playwright/Chromium available. To actually run them: `npm install playwright && npx
playwright install chromium`, start `python3 ../serve_illuminate.py` in another terminal first, and make
sure `pdftotext` (from `poppler-utils`) is on your `PATH`.

## Running

```bash
npm test                       # from repo root
# or
bash run_all_tests.sh          # from this folder
# or run one file directly
node test_astro_synastry_score.js
```

Each file prints its own `N passed, M failed` line and exits non-zero on any failure; `run_all_tests.sh`
sums every file's counts into one grand total and prints any failing file's full output at the end.

## How these tests work

Every file loads the 5 real app files into a shared Node `vm` sandbox (via `jsdom`, so `document`/`window`
exist) **in the app's real script load order** — `engine-core.js` → `engine-metaphysics.js` →
`engine-predictions.js` → `auth.js` → `app.js` — then calls the app's own real functions through
`vm.runInContext(...)`, exactly as the browser would call them. This means these tests exercise the
actual production code, not a reimplementation or a mock — a passing test is a real guarantee about the
real app's behavior, not just about a test double.

A small local helper pattern repeats across nearly every file:

```js
function run(code) { return vm.runInContext(code, sandbox); }
```

Two gotchas worth knowing before adding new tests (both cost real debugging time historically — see
`CLAUDE.md` at the repo root and `UPDATE_NOTES_AND_INSTRUCTIONS.md` for the incidents that taught these):

1. `x = run('someFn()')` only assigns `x` in *this Node test script's* scope — a *later* `run('...')`
   call cannot see it, because it runs in the separate `vm` sandbox. If a later call needs that value,
   assign it inside the sandbox too: `run('var x = someFn(); x')`.
2. `generateDeepAnalysisData(type, profile, extraData, rawOnly)` returns an HTML string by default, or a
   plain `{title, chars, exp, traits, hl, pos, neg, cau, opts}` object when the 4th argument (`rawOnly`)
   is `true`. Always wrap a `rawOnly` result in `JSON.stringify(...)` before running a regex `.test()`
   against it — testing a plain object directly silently coerces it to the string `"[object Object]"`,
   which makes every check either a false pass or a false fail without ever throwing an error.

## Portability note

These files were originally written and run inside a specific cloud sandbox container, where the project
lived at a fixed absolute path. As part of migrating this project to a normal git repo, every file was
rewritten to resolve the project root relative to its own location
(`const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');`) instead of a hardcoded absolute
path — verified to still produce the identical **1950 passed, 0 failed** result from a completely
different clone location. If you ever see a bare string like `/home/claude/project` reappear in a new
test file (e.g. pasted from an old session transcript), replace it with `__PROJECT_ROOT__` the same way.

# Moving Illuminate to VS Code + Claude Code

This package is a complete, self-contained snapshot of the Illuminate project, ready to become a normal
local git repository. Everything below assumes you're starting from an empty folder on your own machine.

## 1. Unpack

Put every file from this delivery into one folder together (they must all sit at the same level, e.g.
`~/projects/illuminate/`), matching this layout:

```
illuminate/
├── index.html
├── app.js
├── engine-core.js
├── engine-metaphysics.js
├── engine-predictions.js
├── auth.js
├── styles.css
├── serve_illuminate.py
├── start_illuminate.bat
├── test data.xlsx
├── package.json
├── .gitignore
├── CLAUDE.md
├── SESSION_HISTORY_SUMMARY.md
├── MIGRATION_README.md            (this file)
├── UPDATE_NOTES_AND_INSTRUCTIONS.md
└── tests/
    ├── README.md
    ├── run_all_tests.sh
    └── test_*.js                  (106 files)
```

## 2. Turn it into a git repository

```bash
cd illuminate
git init
git add .
git commit -m "Initial import: Illuminate project migrated from Claude.ai Project workspace"
```

If you already have a remote (e.g. an existing `github.com/roach76/Illuminate` repo referenced in this
project's own memory notes), add it and push instead of a bare `git init`:

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

If that remote already has history you want to keep, pull/rebase first rather than force-pushing over it.

## 3. Open in VS Code

```bash
code .
```

Recommended extensions: none are required — this is plain HTML/CSS/JS with no build step. If you use
ESLint/Prettier locally, `app.js` and `engine-metaphysics.js` are large (1MB+ and 300KB+) hand-written
files with extensive inline comments explaining *why* — please don't run an auto-formatter across them
wholesale, since it would produce a noisy diff against every future change.

## 4. Run the app locally

```bash
python3 serve_illuminate.py
```

(or double-click `start_illuminate.bat` on Windows). Open the URL it prints in your browser. This is a
plain static file server — there's no build/bundle step, no `npm start`; the app is loaded directly.

## 5. Install test dependencies and run the regression suite

```bash
npm install
npm test
```

This should print `TOTAL: 1950 passed, 0 failed` (2 of the 106 test files — the Playwright/Chromium
browser probes — will show `0 passed, 0 failed` unless you additionally install `playwright` and have
the local server running; see `tests/README.md` for exactly when that matters).

## 6. Continue with Claude Code

From the project folder:

```bash
claude
```

Claude Code automatically reads **`CLAUDE.md`** at the repo root for project-specific instructions —
it captures the standing rules this project has followed throughout its history (always run the full
regression suite after a change, always update `UPDATE_NOTES_AND_INSTRUCTIONS.md`, nothing half-baked).
Point Claude Code at **`SESSION_HISTORY_SUMMARY.md`** for a condensed narrative of everything built so
far, and at **`UPDATE_NOTES_AND_INSTRUCTIONS.md`** for the full dated changelog if it needs the detail
behind any specific past decision.

A reasonable first message to a fresh Claude Code session in this repo:

> Read CLAUDE.md and SESSION_HISTORY_SUMMARY.md to get oriented on this project, then [describe what you
> want done next].

## What's identical vs. what changed in this migration

- `app.js`, `index.html`, `engine-core.js`, `engine-metaphysics.js`, `engine-predictions.js`, `auth.js`,
  `styles.css`, `test data.xlsx`, and `UPDATE_NOTES_AND_INSTRUCTIONS.md` are **byte-for-byte identical**
  to what was last delivered and verified in the hosted session — no application code changed.
- `tests/` is **new to this delivery**: the 106-file regression suite existed only in an ephemeral,
  session-scoped scratchpad during the hosted engagement and was never previously part of a delivered
  file set. It has been recovered, made portable (no more hardcoded absolute container paths — see
  `tests/README.md`'s "Portability note"), and re-verified to produce the identical 1950-check result
  from a fresh location.
- `CLAUDE.md`, `SESSION_HISTORY_SUMMARY.md`, `MIGRATION_README.md`, `package.json`, and `.gitignore` are
  **new**, written specifically to carry this project's standing conventions and history forward into a
  plain git/VS Code/Claude Code workflow.

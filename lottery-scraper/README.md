# Illuminate — Live Lottery Results & Historical Correlation

This folder adds two things to the 4D/TOTO section:
1. A genuine "fetch the latest real draw results" capability.
2. A **growing historical repository** (not just the latest draw), which the
   app uses to run an honest, real-data correlation check between each draw
   date's BaZi element and that draw's actual winning digits.

## What's in this folder

- `scraper.js` — Node script that (a) backfills 4D history from check4d.co's
  past-results table (~30-35 draws immediately), (b) fetches the live page
  each run for the current 4D + TOTO draw with full prize breakdown, and
  (c) merges everything into a growing, deduplicated `history.json`.
- `refresh-lottery.yml` — GitHub Action that runs the scraper on a schedule
  and commits `history.json` back to your repo automatically. The repository
  grows over time; nothing is ever overwritten, only appended/merged.
- `history.json` — **not included** — generated on first run. Don't
  hand-create it.

## History file structure

```json
{
  "lastUpdated": "...",
  "source": "https://check4d.co/sgpools/",
  "fourD": [ { "isoDate": "2026-09-02", "date": "Wed 2 Sep 2026", "drawNo": "5530/26", "winning": [...3 or 23 numbers], "full": true|false }, ... newest first ],
  "toto":  [ { "isoDate": "2026-09-03", "date": "Thu 3 Sep 2026", "drawNo": "4214", "winning": [6 numbers], "additional": N }, ... newest first ]
}
```

`full: false` on a 4D entry means it only has 1st/2nd/3rd prizes (from the
backfill table), not the complete 23-number breakdown - this happens for
older dates before the scraper started running regularly. Entries get
upgraded to `full: true` automatically once the live-page fetch catches that
date's complete breakdown (in practice, this means the CURRENT/most recent
draw is always full; older ones fill in the Special/Consolation numbers only
as the app happens to run on that exact draw day - see "Limitations" below).

**The repository never drops data.** Every scraper run only adds or upgrades
entries - nothing already stored is ever removed or truncated, per the
requirement that this keep growing indefinitely. There is no maximum size cap.

TOTO has no discovered backfill source, so its history only grows one draw
per scheduled run (roughly 2 draws/week) - expect a few months before there's
a large enough sample for the correlation check to mean much of anything
(though as explained below, "meaning much" isn't really the point).

## Browsing past draws by year and date

Once a live history is connected, the 4D and TOTO sections each show a
"Browse Past Draws" picker: choose a year, then a specific date within that
year, then "View This Draw" to see the full result for that day (with your
favourite numbers highlighted the same way as everywhere else). With only
the 3-draw static snapshot, this section shows an explanatory note instead of
an empty/broken picker.

## Favourite numbers

Each of the 4D and TOTO sections has an input for up to 8 favourite numbers
(saved to your profile). Matches against ANY real draw shown in the app -
the "Most Recent 3 Draws" list and the past-draws browser - are highlighted:

- **4D**: Purple = exact same 4-digit sequence as a winning number. Blue =
  same 4 digits in a different order (a permutation) but not an exact match.
- **TOTO**: numbers are single values with no "sequence" to permute, so this
  is adapted rather than literal - Purple = matches one of the 6 main
  winning numbers. Blue = matches only the Additional number.

## Reaching 1000+ draws

1000 draws is 4D's target floor. A single year's backfill only gets ~35
entries, so `scraper.js` also makes best-effort attempts at a few plausible
prior-year archive URLs (`/sgpools/past/2025/`, `/sgpools/past/?year=2025`,
etc.) on each run. **These are speculative** - no documented multi-year
archive was confirmed on check4d.co during development, so they may simply
fail every time, which the scraper handles gracefully (logs it, moves on,
doesn't error out). If none of them work for your setup, the realistic,
honest timeline to 1000 draws is organic accumulation: 4D draws ~3x/week
(~156/year, so ~6-7 years to reach 1000 from a ~35-draw backfill), TOTO draws
2x/week (~104/year, ~10 years to reach 1000 from zero). Since nothing is ever
dropped, the count only ever goes up from here.

## One-time setup

1. Create a public GitHub repo (or use an existing one) and add this whole
   `lottery-scraper` folder to it, keeping the folder name.
2. Move `refresh-lottery.yml` into `.github/workflows/refresh-lottery.yml`.
3. Push to GitHub (branch: `main`). Trigger the first run immediately from
   the repo's **Actions** tab → "Refresh Lottery History" → "Run workflow"
   (don't wait for the schedule) so the 4D backfill happens right away.
4. After the first successful run, your history will be readable at:
   ```
   https://raw.githubusercontent.com/<your-username>/<your-repo>/main/lottery-scraper/history.json
   ```
5. Open `engine-predictions.js` in the main app and set `LOTTERY_JSON_URL`
   (near the top of the file) to that exact URL.

## Running the scraper locally (optional, to test before relying on the Action)

```
cd lottery-scraper
node scraper.js
cat history.json
```

Requires Node 18+ (for built-in `fetch`). Re-running locally is safe - it
merges into whatever `history.json` already exists rather than overwriting.

## About the "Historical Correlation Check"

Once `history.json` has real draws in it, the app computes: for each past
draw date, what element does that date's BaZi Day Master belong to, and did
winning-number digits matching that same element show up more or less often
than you'd expect by pure chance (~20% baseline, since each of the 5 elements
covers 2 of the 10 digits)? This now runs against the **full accumulated
repository**, not just the 3 most recent draws, so it gets more statistically
meaningful as the history grows toward and past the 1000-draw floor.

The suggested numbers for the next 3 draws also now use **per-digit-position
frequency** computed from the full repository (e.g. what actually shows up
most often specifically in the 1st digit of a 4D number, across every stored
draw), rather than a single flat frequency list built from only 3 draws -
directly incorporating the growing historical record into the prediction as
requested.

**Be clear-eyed about what this can and can't show.** Singapore Pools draws
are certified random processes - there is no real causal or statistical link
between a calendar date's traditional Chinese element and which physical
balls or slips get drawn. Running this check on real data will, correctly,
show a result close to the 20% baseline - and it should. A result far from
baseline on a modest sample (dozens to low-hundreds of draws) is far more
likely to be statistical noise/overfitting than a real "edge," and the app
does not claim otherwise. This feature exists to let a curious user see that
for themselves using real data, and to satisfy the request that predictions
draw on genuine historical results rather than a purely synthetic frequency
list - it contributes only a small nudge to the suggested numbers, not a
confident forecast.

## Limitations (being upfront)

- **4D backfill depth**: only what check4d.co's past-results page shows for
  the current year (~30-35 draws) - a full historical archive would need a
  different/deeper source, which wasn't identified during development.
- **4D backfill detail**: only 1st/2nd/3rd for backfilled dates, not the full
  23-number breakdown, since the past-results table doesn't expose that.
- **TOTO backfill**: none found - history accumulates one draw per run only.
- **Scraper fragility**: same caveat as before - if check4d.co changes its
  page layout, `scraper.js` will need updating. Check the Action's run logs
  under the **Actions** tab if `history.json` stops updating.
- **Not run against the live site** from this development environment (no
  network access to check4d.co here) - all parsing logic was verified against
  captured real page text and a synthetic 30-draw dataset, but the actual
  first live run is the real test. Spot-check `history.json` manually the
  first time.

## Fixed bug: history.json never appeared even on a successful run

If you set this up before and saw the workflow complete with no errors, yet
`history.json` never showed up in the repo, this was a real bug (now fixed)
in `refresh-lottery.yml`'s commit step: it used `git diff --quiet -- <path>`
to decide whether to commit, but that command only compares **tracked**
files against the index - it doesn't detect a brand-new file that git has
never seen before. On the very first run (and only the first run),
`history.json` would be silently treated as "no change - nothing to commit"
and the commit/push would never happen, even though the scraper itself ran
perfectly. The fix stages the file first (`git add`) and then checks
`git diff --cached --quiet`, which correctly detects new files as a real
difference. If you already have the old version of this file, replace it
with the updated one in this delivery.

The updated workflow also adds a "Verify scraper output" step that prints
the resulting draw counts (or a clear warning if the file wasn't created)
directly in every run's log, so any future issue is visible without needing
to guess.

## Still not appearing after the git-diff fix? Check this repo setting

If `history.json` is still not showing up even after updating to the fixed
`refresh-lottery.yml`, the next most common cause is a **repository setting
that lives outside this YAML file entirely** and can silently override it:

**GitHub repo → Settings → Actions → General → "Workflow permissions"**

If this is set to **"Read repository contents permission"** (this has been
GitHub's default for new repos since around 2023), the automatic token this
workflow uses gets **no write access at all**, no matter what this file's
`permissions: contents: write` line says. `git push` then fails with a
permission error.

**Fix**: on that same settings page, select **"Read and write permissions"**
and save. This is a one-time, per-repo setting done on GitHub's website - it
cannot be set from inside the workflow file, which is exactly why it's easy
to overlook.

The updated `refresh-lottery.yml` in this delivery adds explicit diagnostic
steps (a git remote/branch check, a direct test of whether the run's token
can even authenticate to the GitHub API, and clear `::error::` messages if
the push itself fails) so if this - or anything else - is the cause, it will
show up plainly in that run's log instead of failing silently. **Please
share that log output** (the "Diagnose git/permissions state" and "Commit
history.json if changed" steps specifically) if it still doesn't work after
checking the setting above - that will let this be diagnosed from evidence
rather than another guess.

## Update: real log evidence found a different cause (gitignore / silent-add)

A real workflow run's log was reviewed directly (permissions were already
correctly set to read/write, ruling that out). The scraper ran successfully
and wrote `history.json` with fresh data every time, but the commit step
still reported "No change in history.json - nothing to commit" - which
shouldn't happen for a freshly-written file with a new timestamp, and was
verified locally to be genuinely unexpected behaviour for a plain `git add`.

The most likely explanation: a `.gitignore` rule matching `history.json` (or
a broader pattern like `*.json`) causes `git add <path>` to silently fail
(it exits with a warning, not a loud error) - leaving nothing staged, so the
subsequent diff check trivially reports "no change" even though the
working-tree file is genuinely new. This was confirmed as plausible via a
local reproduction.

**Fixed** by changing the commit step to use `git add -f` (force-add),
which stages the file regardless of any `.gitignore` rule - appropriate
here since this file is always meant to be tracked. The step also now
prints whether the file is gitignored, what HEAD's current version's
timestamp is (if any), and this run's freshly-written timestamp, so if this
still doesn't resolve it, the next run's log will show the exact byte-level
comparison rather than a bare "no change."

**Also fixed while reviewing that log**: the "prior-year backfill" (trying
`?year=2025`, `?year=2024`, etc.) was reporting a false success for every
year 2018-2025, each claiming to find the same 37 entries - because
check4d.co silently ignores the year parameter and just serves the current
year's page regardless. This was harmless in practice (results were deduped
by date, so no bad data got stored) but wasted 8 extra fetches per run and
produced misleading log output. The scraper now checks that returned dates
actually fall within the requested year before counting it as a real
success, and gives up immediately once one year fails rather than trying
seven more that are equally certain to fail the same way.

## Two more fixes: browsing partial 4D results, and TOTO browsing not appearing

**4D past draws showing "partial data"**: this is a real, honest data
limitation from check4d.co's past-results table, which only ever exposes
1st/2nd/3rd for historical dates (not the full 23-number breakdown). The
scraper now makes a best-effort attempt to upgrade older dates to full
detail by fetching each date's own page
(`https://check4d.co/sgpools/past/YYYY-MM-DD/`) - **this URL pattern has not
been confirmed to exist** (same caveat as the multi-year archive attempts
elsewhere in this scraper), so it may simply not work. If it doesn't, dates
correctly continue to show "partial data" rather than anything being
fabricated. To keep each run's duration and request volume reasonable, only
10 partial entries are attempted per run - with 3 scheduled runs a day, the
existing backfill should fully attempt upgrading within a few days, and any
genuinely unavailable dates will simply stay partial indefinitely, honestly.

**TOTO's "Browse Past Draws" not appearing/working**: this was a real bug.
The browser previously required at least 4 accumulated draws before showing
anything at all - but TOTO has no backfill source (see "Reaching 1000+
draws" above) and only gains one draw per scheduled run, so a freshly-set-up
TOTO repository could sit at 1 draw for weeks, always showing a "not enough
data" message instead of a working date picker. Fixed to show a functional
(if minimal) browser as soon as there's at least 1 draw.

## Why this needs a repo + Action, and can't just be a "Refresh" button

A button in the app runs JavaScript **in your browser**. Two separate walls
block a browser from fetching Singapore Pools (or most mirrors) directly:

- **No official API.** Singapore Pools doesn't publish one.
- **CORS.** Even fetching a mirror site directly from browser JS is normally
  blocked unless *that* site's server explicitly allows cross-origin requests
  — most ordinary websites don't. `raw.githubusercontent.com` does allow this,
  which is exactly why the results are relayed through your own GitHub repo
  rather than fetched from check4d.co directly in the browser.

The scraper itself has to run somewhere with a real script runtime (Node),
which a static HTML/JS app doesn't have — hence the GitHub Action, which is a
free, no-maintenance-server way to run a script on a schedule.


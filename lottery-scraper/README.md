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


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
- `import-historical-4d.js` — **optional, run manually** - a one-time (or
  occasional) importer that pulls a community-compiled dataset covering
  every 4D draw back to 1986, dramatically deepening your history beyond
  what `scraper.js` alone can backfill. See "Deep historical 4D import"
  below.
- `refresh-lottery.yml` — GitHub Action that runs the scraper on a schedule
  and commits `history.json` back to your repo automatically. The repository
  grows over time; nothing is ever overwritten, only appended/merged.
- `history.json` — **not included** — generated on first run. Don't
  hand-create it.

## Deep historical 4D import (1986 onward) — optional, run manually

`scraper.js`'s own backfill only reaches back to the current year (~35
draws) because that's all check4d.co's past-results table exposes. For much
deeper history, `import-historical-4d.js` pulls a community-compiled dataset
([Singapore-Pools-Dataset on GitHub](https://github.com/foooooooooooooooooooooooooootw/Singapore-Pools-Dataset))
covering every 4D draw from 31 May 1986 onward - confirmed (by actually
running this import) to bring in **5,508 real, dated draws**, instantly
clearing the 1000-draw target this project has been working toward.

**Run it once:**
```
cd lottery-scraper
node import-historical-4d.js
```
This merges into your existing `history.json` (creating one if it doesn't
exist yet) using the same "prefer the fuller record" merge logic as
`scraper.js`, so it's safe to run alongside your existing scheduled Action
and won't downgrade any data `scraper.js` has already collected. It's also
safe to re-run later if the source dataset gets updated.

**Important limitations, stated plainly:**
- **TOTO is not covered.** The source dataset's TOTO file has every single
  date recorded as `0001/01/01` - a data-entry error the source repo's own
  README acknowledges. Since this app's history is keyed by real dates, that
  file cannot be used at all. TOTO continues to rely solely on `scraper.js`'s
  slower, real-dated accumulation.
- **This is a snapshot, not a live feed.** As of when this was built, the
  dataset's most recent entry was 12 July 2026 - keep running `scraper.js`
  on its normal schedule to fill in everything from that date to today, and
  going forward.
- **Not every historical draw has the full 23-number breakdown** - some
  older entries in the source data have fewer numbers than a complete draw.
  This import honestly reflects that (marking `full: true` only when a
  genuine 23-number set was found for that specific draw) rather than
  assuming completeness.
- This is a **third-party compiled dataset**, not something scraped by this
  project from Singapore Pools directly - see the note below on why that
  distinction matters.

**A related fix**: the app's own live-data loader used to reject
`history.json` entirely if *either* game's array was empty. That was too
strict - if you run this import before ever running `scraper.js`, TOTO
legitimately starts at 0 entries, and the whole file (including your rich
4D data) would have been thrown away. Fixed so the app accepts the file as
long as at least one game has real data.

## Why this project does not scrape singaporepools.com.sg directly

It was suggested that live 4D/TOTO updates come directly from the official
Singapore Pools results page instead of the check4d.co mirror this project
currently uses. Before building that, Singapore Pools' own **Website & Mobile
App Terms and Conditions** (dated 6 December 2025, current as of this
writing) were checked directly. Section 2.2.3 states you may **not** use
their website:

> "as part of any systematic or automated data collection activities,
> including but not limited to data mining, data harvesting and **scraping**"

This is an explicit, unambiguous prohibition from the rights-holder's own
current terms - not a grey area, and not comparable to using the check4d.co
mirror (a third party, whose own terms were never confirmed either way).
Because of this, this project does not include, and will not add, a scraper
targeting singaporepools.com.sg directly. If you want an alternative to
check4d.co for ongoing live updates, a properly licensed third-party data
API would be the appropriate route to investigate - none has been evaluated
or integrated here.

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

**For 4D, this is now solved directly** - run `import-historical-4d.js` once
(see "Deep historical 4D import" above) and you'll have 5,508+ real draws
immediately, no waiting required.

**For TOTO, no equivalent source was found.** 1000 draws is TOTO's target
floor. TOTO draws 2x/week (~104/year), and with no backfill or import source
identified, reaching 1000 from zero would take roughly 10 years of organic,
real-dated accumulation via `scraper.js`'s scheduled runs. Since nothing is
ever dropped, the count only ever goes up from here - but the honest
expectation is that TOTO's repository will stay comparatively small for a
long time unless a better source is found later.

`scraper.js` also makes best-effort attempts at a few plausible prior-year
archive URLs on check4d.co (`/sgpools/past/2025/`, `/sgpools/past/?year=2025`,
etc.) on each run, for whatever residual gap-filling that might offer, though
in practice these have been confirmed to just return the current year's page
regardless of the year requested (see the scraper's own logs, which now
detect and report this rather than logging it as a false success).

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

## Fixed: "git push rejected" from overlapping runs, and a misleading error message

A real run hit `! [rejected] main -> main (fetch first)` on push - this
happens when two runs of this workflow overlap (e.g. a manual "Run workflow"
click while a scheduled run is still in progress) and both try to push at
roughly the same time; whichever pushes second gets rejected because the
first one already moved the branch forward underneath it. **This is not a
permissions problem** - but the previous version of this file's error
message said it almost always was, which would have sent you to double-check
a setting that was never the issue. Reproduced this exact failure locally
(two clones racing to push to the same repo) to confirm both the diagnosis
and the fix before shipping it.

Two changes:

1. **`concurrency:` added to the workflow** - this tells GitHub to queue
   overlapping runs of this specific workflow one after another instead of
   letting them run in parallel, which prevents the race from happening in
   the first place.
2. **Retry logic added as a backstop**, in case a race still slips through
   (e.g. a run already in flight before this fix was deployed). On a
   rejected push, the script re-fetches the latest remote state, resets onto
   it, re-applies the *same* freshly-scraped data on top (rather than a git
   rebase, which would likely conflict since both commits touch the exact
   same file), and retries - up to 3 attempts. A genuine non-rejection
   failure (real permissions/branch-protection problem) still fails
   immediately with an accurate error message, rather than retrying
   pointlessly or being misdiagnosed as the same thing every time.

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


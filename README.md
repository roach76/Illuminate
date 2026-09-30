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
  what `scraper.js` alone can backfill. See "Deep historical import" below.
- `import-historical-toto.js` — **optional, run manually** - the TOTO
  equivalent, importing a user-supplied CSV covering every TOTO draw from
  2008 onward. See "Deep historical import" below.
- `refresh-lottery.yml` — GitHub Action that runs the scraper on a schedule
  and commits `history.json` back to your repo automatically. The repository
  grows over time; nothing is ever overwritten, only appended/merged.
- `history.json` — **not included** — generated on first run. Don't
  hand-create it.

## Deep historical import (4D + TOTO) — optional, run manually

`scraper.js`'s own backfill only reaches back to the current year (~35
draws for 4D, ~1/run for TOTO) because that's all check4d.co exposes. Two
separate import scripts close that gap with genuinely deep, verified
historical data - after running both, `scraper.js` only needs to keep
capturing the *latest* draw going forward; everything else is covered.

### 4D: `import-historical-4d.js`

Pulls a community-compiled dataset
([Singapore-Pools-Dataset on GitHub](https://github.com/foooooooooooooooooooooooooootw/Singapore-Pools-Dataset))
covering every 4D draw from 31 May 1986 onward - confirmed (by actually
running this import) to bring in **5,508 real, dated draws**.

```
cd lottery-scraper
node import-historical-4d.js
```

### TOTO: `import-historical-toto.js`

Imports a user-supplied historical TOTO CSV. Unlike the 4D dataset above,
this one was directly validated end-to-end before writing any code against
it - every one of its 1,810 rows was checked for valid dates, valid number
ranges, no duplicates, and no missing values, and it came back completely
clean. Confirmed (by actually running this import) to bring in **1,810
real, dated TOTO draws spanning 3 July 2008 to 2 February 2026** - the
first time this project has had a meaningful TOTO history at all.

```
cd lottery-scraper
node import-historical-toto.js          # expects ToTo.csv in this folder
node import-historical-toto.js path/to/your-file.csv   # or pass a path explicitly
```

Place your TOTO CSV in the `lottery-scraper/` folder (named `ToTo.csv`, or
pass its path as an argument) before running. Expected columns: `Draw,
Date, Winning Number 1, 2, 3, 4, 5, 6, Additional Number, ...` (any further
columns, such as prize division data, are read but intentionally ignored -
only the draw number, date, and numbers are needed).

Both scripts merge into your existing `history.json` (creating one if it
doesn't exist yet), so it's safe to run one, the other, or both, in any
order, and safe to re-run either later if you obtain updated source data.
Together, both games now clear the 1000-draw target this project has been
working toward - 4D at 5,508 and TOTO at 1,810.

**Important limitations, stated plainly:**
- **Both are snapshots, not live feeds.** As of when these were built, the
  4D dataset's most recent entry was 12 July 2026 and the TOTO dataset's was
  2 February 2026 - keep running `scraper.js` on its normal schedule to fill
  in everything from those dates to today, and going forward. The TOTO gap
  in particular (~7 months as of writing) will only close gradually, since
  TOTO draws just 2x/week and `scraper.js` has no TOTO backfill source of
  its own - only the ongoing live-page fetch.
- **Not every historical 4D draw has the full 23-number breakdown, and this
  has been directly investigated, not just assumed.** Three distinct data
  quality issues exist in the source archive, each verified against the raw
  CSV directly (not inferred):
  1. **Too few numbers** - 165 draws, 152 of which are clustered in the
     earliest years (1986-1991) and consistently short by exactly 2 numbers
     (21 instead of 23). This looks like a systematic gap in the source
     archive for the game's earliest era, not random noise.
  2. **Too many numbers** - 45 draws have a literal duplicate row in the
     source CSV (confirmed directly: draw 425 on 1990-06-23 has the number
     0104 listed twice at lines 9551 and 9557 of the raw file). A naive
     "more numbers = more complete" check would have wrongly treated these
     as *better* than a clean 23-number entry - fixed so `full` requires
     exactly 23 numbers that are all distinct, not just "23 or more".
  3. **Exactly 23, but with an internal duplicate** - 122 draws (including
     a 2026 draw, so this isn't purely a historical-era issue) have exactly
     23 numbers where one value is repeated, meaning one genuine prize
     number is silently unknown. This is the subtlest case, and the one a
     simple length check would never have caught at all.

  **Update: these draws are now removed entirely rather than kept with a
  warning.** `import-historical-4d.js` only keeps a draw if it has exactly
  23 distinct numbers - anything short, over, or containing an internal
  duplicate is excluded from the import, and any already-imported entries
  matching the old, less strict logic are cleaned up (removed) the next
  time this script runs too. On the real dataset, this means the 4D
  repository holds **5,176 draws** (down from 5,508 total in the source;
  332 were excluded), every single one genuinely complete. TOTO draws don't
  have any of these issues - every validated row has the complete 6+1
  numbers.

  One interaction worth knowing: `scraper.js`'s own ongoing backfill can
  still add a genuinely partial entry for a very recent date (it only gets
  1st/2nd/3rd from check4d.co, then tries to upgrade it to full detail on
  later scheduled runs) - the past-draw viewer's "partial data" warning
  message (for exactly this kind of in-progress entry) is still in place
  for that case. If you run `import-historical-4d.js` while such an entry
  exists, its cleanup step will remove it too, since it doesn't yet meet
  the "exactly 23 distinct" bar - `scraper.js` will simply re-add it on its
  next scheduled run (as long as that date is still within check4d.co's
  rolling past-results window), so this is a minor, temporary effect, not
  permanent data loss.
- Both are **user-supplied or third-party compiled datasets**, not scraped
  by this project from Singapore Pools directly - see the note below on why
  that distinction matters.

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

**Both games now clear this target directly.** Run `import-historical-4d.js`
and `import-historical-toto.js` once each (see "Deep historical import"
above) and you'll have 5,508 4D draws and 1,810 TOTO draws immediately, no
waiting required.

`scraper.js` also makes best-effort attempts at a few plausible prior-year
archive URLs on check4d.co (`/sgpools/past/2025/`, `/sgpools/past/?year=2025`,
etc.) on each run, for whatever residual gap-filling that might offer, though
in practice these have been confirmed to just return the current year's page
regardless of the year requested (see the scraper's own logs, which now
detect and report this rather than logging it as a false success). With the
historical imports above in place, this no longer matters much either way -
it was the only lever available before real historical datasets were found.

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

## Retroactive 50-draw prediction backtest ("Historical Accuracy")

Once real historical data is available (via the imports above or the
ongoing scraper), the app automatically runs a one-time backtest the first
time it loads each session: it retroactively generates predictions for the
last 50 draws of each game and checks them against the real outcomes,
populating the "📊 Historical Accuracy" display immediately instead of
requiring weeks or years of live accumulation.

**The critical design constraint: "without referencing the results."** Each
retroactive prediction is built using *only* draws that occurred strictly
*before* that specific draw's own date - the draw being predicted, and any
later draw, is never part of the frequency model or correlation signal used
to generate its own prediction. This was verified directly, not just
assumed: a test plants a distinctive, impossible-to-guess-by-chance number
in a "future" draw and confirms the model built for an earlier draw
genuinely excludes it, and that the resulting prediction never contains it.
Re-running the backtest is always safe - it only fills in gaps, and never
regenerates or alters an existing prediction (the same permanent,
immutable-once-made rule that applies to live forward-looking predictions).

The accuracy display shows a breakdown of how many checked draws were
retroactively backtested versus genuinely live-tracked (predicted in
advance of that draw actually happening), so the basis of any accuracy
figure is never ambiguous.

**Moving forward**: every time the app fetches live data (which happens
automatically), any existing prediction - whether from this backtest or a
normal forward-looking one - is checked against newly-available real
results and marked resolved. This means the Historical Accuracy figures
keep updating automatically as new draws happen, with no further action
needed.

### Granular per-tier accuracy breakdown

Beyond the overall accuracy summary, the Historical Accuracy display now
also breaks down results by specific prize tier:

- **4D**: percentage that struck the exact number (direct), percentage that
  struck a permutation-form match (box, non-exact), and separately, the
  percentage that struck the 1st, 2nd, 3rd, Starter, or Consolation prize
  specifically (an exact match to that specific prize position/block).
- **TOTO**: percentage for each of the 7 real, official Singapore Pools
  prize Groups - Group 1 (Jackpot, all 6 matched) down to Group 7 (3
  matched), each shown with its real requirement and prize description
  (e.g. "Group 2 - Match 5 winning numbers + additional number - Shares 8%
  of the prize pool"). This replaced an earlier, self-invented "3/3+1/4/..."
  labeling scheme that didn't correspond to the actual prize structure.

**Highlighting on suggested numbers now follows the same real prize rules.**
Previously, an individual predicted number was highlighted whenever it
happened to coincide with any winning or additional number - even if the
rest of that same set matched almost nothing, which didn't reflect whether
the set had actually won anything. Numbers are now only highlighted when
the **set as a whole** is genuinely prize-eligible (Group 7 or better - at
least 3 main-number matches), matching how a real TOTO ticket would
actually be evaluated.

**Backward compatibility**: predictions checked before this breakdown
existed get their analysis upgraded in place the next time the app loads -
using the exact same already-stored prediction and already-known real
result (neither is ever altered), just recomputing the derived analysis
with the improved, more granular formula.

## TOTO predictions are System 7 entries, not plain 6-number picks

Singapore Pools allows buying up to 12 numbers per TOTO line (a "System"
entry), which automatically covers every possible 6-number combination
within the chosen numbers. Predicted TOTO sets use **System 7** (7
numbers, covering the 7 possible 6-number combinations within them) - this
was changed from an initial System 12 implementation, per explicit request.

This still allows a specific real outcome: with a plain 6-number entry,
matching all 6 winning numbers structurally leaves no room in those same 6
slots for the separately-drawn additional number too. With a System 7
entry, if the 7th number (beyond the 6 winning numbers) happens to be the
additional number, one 6-number sub-combination (the 6 winners) wins Group
1, while a *different* sub-combination (5 of those winners + the additional
number) independently wins Group 2 on the same ticket - not possible with a
plain 6-number entry. Verified directly: a constructed 7-number set of
exactly the 6 winning numbers plus the additional number correctly reports
Group 1 *and* `anyAdditionalMatch: true` simultaneously; a 7-number set
with the 6 winners plus an unrelated 7th number correctly reports Group 1
*without* the additional match (no false positive).

The prize-Group classification logic itself required no changes to support
either system size - it already worked by counting how many of a set's
numbers are winning numbers and checking whether the additional number is
present, which naturally scales to any set size. Only the set-generation
size (`TOTO_SYSTEM_SIZE` in `engine-predictions.js`) and the display
labeling changed.

One consequence worth knowing: with 7 numbers instead of 6, the overall
prize-eligible rate in the Historical Accuracy display rises somewhat
(observed roughly 10% -> 16% on the real dataset used during testing,
versus 60% under the earlier System 12 version) - this is the expected,
honest mathematical effect of System 7 covering 7 possible 6-number
combinations instead of just 1 (or 924, under System 12), not a bug or an
inflated number.

## Removed the "Additional number hit" summary stat

The TOTO accuracy summary previously included a standalone "Additional
number hit: N draws" figure alongside the average-best-match line. This was
removed - it's now fully and more precisely captured within the official
Group 1-7 breakdown (Groups 2, 4, and 6 specifically represent "+additional"
outcomes at the 5, 4, and 3 main-number match levels respectively), so a
separate blanket stat that didn't distinguish how many main numbers were
also matched was redundant and could be read as its own vague "+additional"
category outside the real prize structure. "Average best match" and "3+
matches" remain, since those weren't specifically about the additional
number.

## Favourite-number historical accuracy (both games)

Beyond checking how the algorithm's own suggestions have performed, the
lottery section now also shows how the user's own saved favourite numbers
would have performed against every available historical draw - using the
exact same classification functions (`compute4DHitSummary` /
`computeTotoHitSummary`) as the algorithm's accuracy tracking, so the two
are directly comparable on identical methodology.

- **4D**: the same exact/permutation/1st/2nd/3rd/Starter/Consolation
  breakdown, computed against the user's saved favourite numbers instead of
  algorithmic predictions.
- **TOTO**: the user's entire favourite-numbers list (up to 15 numbers) is
  treated as one system entry, exactly like a prediction set, and classified
  into the same official Group 1-7 structure.

This is a separate, on-demand computation, not stored in the prediction
log - favourites are a single, currently-live list rather than a per-draw
prediction, so re-checking them against all available history each time
they're viewed is the correct behaviour (there's no point-in-time /
look-ahead concern here, since the user's own current numbers are simply
being checked against already-known results, not used to derive a
forward-looking claim). If no favourites are saved yet, or fewer than 10
historical draws are available, a clear explanatory message is shown
instead of blank or misleading numbers.

## Detailed breakdowns now live behind pop-up buttons

Both the algorithm's and the favourites' detailed per-tier breakdowns
(which had grown into a fairly long always-visible grid) now collapse
behind a "View Details" button, reusing the exact same pop-up/modal system
already used elsewhere in the app for Deep Analysis content - clicking it
opens the same shared modal overlay already defined in `index.html`, so no
new UI mechanism was introduced. Only a short one-line headline summary
stays visible inline; the full per-tier grid renders inside the pop-up.
This keeps the lottery section's page length down considerably compared to
always rendering four full detail grids (4D algorithm, 4D favourites, TOTO
algorithm, TOTO favourites) inline.

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


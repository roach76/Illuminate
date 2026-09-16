# Roy Wong — Job Search Scraper & Dashboard (unhosted, local)

Runs entirely on your own computer (or, optionally, on GitHub's free
infrastructure — see Section 5). No cloud hosting, no ongoing cost beyond
free API tiers. Three parts, used in sequence:

1. **`scraper.py`** — pulls new job postings daily from legitimate APIs
   (Adzuna, Jooble, Careerjet, and any company career-page feeds you add)
   and saves them to a dated CSV. Tracks what it's already reported so
   re-runs never duplicate a posting.
2. **`match_report.py`** — takes that CSV and scores each posting against
   Roy's resume profile, producing a **detailed HTML report** (the primary
   output) plus an Excel version of the same data.
3. **`dashboard.html`** — open this in any browser to browse scored results,
   generate a tailored Word resume + cover letter for any job with one
   click, export the current view to Excel, and track application status
   (applied / interview / offer / rejected) with notes — all saved locally
   in your browser, no server involved. Can **automatically fetch the
   latest report from GitHub on load** — see Section 2.2 — so you never
   have to manually download or upload a file.

**Important — what this does NOT do:** it does not scrape LinkedIn,
Glassdoor, Indeed, or JobStreet directly. This was re-checked as of
2026-09-15 (see `UPDATE_NOTES_AND_INSTRUCTIONS.md`) and the situation is
unchanged or worse: LinkedIn's Jobs API has been retired since 2018 and
they actively sue scrapers; Indeed shut down its public Publisher API in
2023 with no self-serve replacement; Glassdoor restricted its API to
enterprise-only sales deals in 2024; JobStreet/SEEK's real developer API
is entirely employer-side (job posting, not job search) and requires
SEEK's approval. All four also explicitly prohibit scraping in their own
terms. Instead, this uses:
- Official aggregator APIs (Adzuna, Jooble, Careerjet) that legally
  re-publish listings from many boards, often including ones also posted
  on the big four sites
- Direct public APIs that companies themselves expose for their careers
  pages (Greenhouse, Lever, Workday, Eightfold) — this is the employer's
  own data, freely published, no ToS issue at all

**See `UPDATE_NOTES_AND_INSTRUCTIONS.md`** for a running log of what's
changed, what's been tested, and any bugs found and fixed along the way.

---

## 1. One-time setup

### Install Python dependencies
```bash
cd job-scraper
pip install -r requirements.txt
```
(Requires Python 3.9+. Check with `python3 --version`.)

### Get free API keys

**Adzuna** (recommended — best Singapore coverage of the three aggregators):
1. Sign up at https://developer.adzuna.com/
2. Create an app — you'll get an `App ID` and `App Key`
3. Open `config.py` and paste them into `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`

**Jooble** (optional, adds a second source):
1. Sign up at https://jooble.org/api/about
2. You'll get one API key
3. Paste into `JOOBLE_API_KEY` in `config.py`

**Careerjet** (optional, adds a third source, includes full job
descriptions and salary data):
1. Sign up at https://www.careerjet.com/partners/register/as-publisher
2. You'll get an affiliate ID (API key)
3. Paste into `CAREERJET_AFFILIATE_ID` in `config.py`
4. **Verify the locale code**: `config.py` ships with
   `CAREERJET_LOCALE_CODE = "en_SG"` as a best inference from Careerjet's
   documented `[language]_[COUNTRY]` format — this was not confirmed
   against a live API key. Run the scraper once after setting this up
   and check `output/run_log.txt`; if you see "Unsupported locale code,"
   check Careerjet's documentation or contact their support for the
   exact code for Singapore, and update `CAREERJET_LOCALE_CODE`
   accordingly.

All three are free for personal-use volumes like this.

### (Optional) Add specific companies' career feeds
Beyond the three aggregators, the scraper can pull directly from four kinds of
company career-site backends, all with genuinely public, unauthenticated
APIs — no key needed for any of these, since it's the same data any site
visitor's browser already loads. Which one a company uses varies, and has
to be confirmed per company (see below) — don't guess a slug.

**Greenhouse** — careers URL looks like `boards.greenhouse.io/companyname`
or `job-boards.greenhouse.io/companyname` → the slug is `companyname`.
**Important:** the slug is sometimes different from the company's common
name (e.g. Addepar's real slug is `addepar1`, not `addepar`) — always
confirm by finding an actual job link on their live careers page and
reading the slug out of that URL, then verify with:
```
https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
```
A working slug returns real JSON with a `jobs` array; a wrong one returns
`{"status":404,"error":"Job not found"}`. Add confirmed slugs to
`GREENHOUSE_COMPANY_SLUGS` in `config.py`.

**Lever** — careers URL looks like `jobs.lever.co/companyname` → the slug
is `companyname`. Verify with:
```
https://api.lever.co/v0/postings/{slug}?mode=json
```
Add confirmed slugs to `LEVER_COMPANY_SLUGS`.

**Workday** — a large share of big enterprises use this (confirmed for
Visa and Malvern Panalytical in this project). The careers URL looks like
`{tenant}.wd{N}.myworkdayjobs.com/{site}`, e.g.
`visa.wd5.myworkdayjobs.com/Visa` → tenant is `visa`, wd_host is `wd5`,
site is `Visa`. The numeric host varies per company (`wd1`, `wd3`, `wd5`,
...) — copy it exactly from the real URL. Verify with a POST request:
```
curl -X POST "https://{tenant}.{wd_host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs" \
  -H "Content-Type: application/json" \
  -d '{"appliedFacets":{},"limit":20,"offset":0,"searchText":"Singapore"}'
```
A working combination returns JSON with a `jobPostings` array. Add
confirmed entries to `WORKDAY_COMPANIES` in `config.py` as
`{"tenant": ..., "wd_host": ..., "site": ...}` dicts.

**Eightfold AI career hubs** — some companies white-label this onto a
branded subdomain (confirmed for Qlik's `careerhub.qlik.com`). Find the
`domain` parameter by opening the company's career hub page, opening
browser dev tools → Network tab, and looking for a call to
`/api/pcsx/search?domain=...`. Verify with:
```
https://{careerhub_host}/api/pcsx/search?domain={domain}&query=Singapore&location=Singapore&start=0
```
A working combination returns JSON with a `data.positions` array. Add
confirmed entries to `EIGHTFOLD_COMPANIES` in `config.py`.

**Companies with no public API found:** Vertiv (Oracle Fusion Cloud HCM),
ORBCOMM (ADP Workforce Now), SATS (SAP SuccessFactors), Razer (custom
self-hosted portal), GovTech Singapore (custom Next.js app on Careers@Gov
— untested). **Thermo Fisher** (Phenom People) was investigated in detail
2026-09-15: the real search backend is a same-origin, company-specific
`POST /widgets` endpoint with an undocumented internal payload scheme —
unlike Greenhouse/Lever/Workday/Eightfold, there's no stable,
generalizable URL pattern across companies, so it was deliberately left
unintegrated rather than shipped as a fragile, reverse-engineered
integration (see `UPDATE_NOTES_AND_INSTRUCTIONS.md` for the full
investigation). For all of these, rely on the aggregator APIs or check
their careers pages manually.

**A note on description text:** Greenhouse and Lever both return the full
job description in their API response. Workday and Eightfold's list/search
endpoints do not — only title, location, and a link. Rows from these two
sources will always be flagged "LOW confidence" in the scored report,
since there's no JD text to score against; open the link and read the
real posting before trusting any match percentage for these rows.

---

## 2. Running it manually (test first)

```bash
python3 scraper.py
```
This creates `output/jobs_YYYY-MM-DD.csv` with any new postings, and logs
progress to `output/run_log.txt`.

Then generate the scored report:
```bash
python3 match_report.py output/jobs_2026-09-07.csv
```
This creates two files:
- `output/match_report_2026-09-07.html` — the **detailed report** (open
  this one first)
- `output/match_report_2026-09-07.xlsx` — the same data as an Excel file

Open the `.html` file in any browser. It shows every posting sorted by
match % descending, with rows at 75%+ highlighted green. **Read the
"Confidence" column.** Any row marked `LOW (thin JD text)` was scored on
a short snippet, not a full job description — treat that score as a lead
to investigate, not a verified match. Open the URL, read the real JD, and
re-run scoring with the full text if you want a trustworthy number for
that specific role.

---

## 2.1 Using the dashboard (resume/cover letter generation, Excel export, application tracking)

**Recommended: run it through the included local server, not by
double-clicking the file.** Opening `dashboard.html` directly
(double-clicking it) loads it as a `file://` page, and browsers treat
data storage on `file://` pages as officially undefined behavior — per
the browser standard itself, not a bug in this project. In practice,
this can mean manually-added jobs and tracked application statuses
silently fail to survive a page reload, even though the exact same code
works completely reliably when the page is served normally. If you've
hit "my saved job disappeared after reloading," this is why.

The fix: run this once per session —
```bash
cd job-scraper
python3 serve_dashboard.py
```
It prints a `http://localhost:8765/dashboard.html` link and opens it in
your browser automatically. Leave that terminal window open while you
use the dashboard (press Ctrl+C when you're done — closing the terminal
also stops it). Opened this way, `localStorage` behaves normally and
reliably, and manually-added jobs and tracked statuses will genuinely
persist across reloads.

You can still open `dashboard.html` by double-clicking it if you just
want to browse a report without needing anything to persist — the
review/scoring/document-generation features all still work fine that
way. It's specifically *persistence across a reload* (manually-added
jobs, saved application statuses) that needs the server.

Open **`dashboard.html`** through the server (or double-click it, or drag
it into an open browser window, if you don't need persistence for this
session). This is separate from the `.html` report above — the report is
a static snapshot; the dashboard is the interactive tool.

1. Click **Choose File** and load that day's `match_report_*.html` file
   (preferred — it carries full job descriptions, which produce better
   tailoring) or the `.xlsx`/`.csv` if that's what you have.
2. The **main table** shows every not-yet-applied job that meets your
   compatibility threshold (see next point), with its match %, status,
   and a notes field.
3. **Set the compatibility threshold**: the number field above the table
   (defaults to 75) is the single control for "how good a match counts."
   Jobs below this % are filtered out of the main table entirely, and
   every job shown is highlighted green. Raise it to see only your
   strongest matches; lower it to see more borderline roles. Applied
   jobs (see point 5) always stay visible in their own list regardless
   of this threshold, since you may have applied before raising your bar.
4. **Generate Resume + Cover Letter**: click this button on any row. Your
   browser downloads two `.docx` files — a resume with the real content
   from `resume_data.py` reordered to emphasize what's most relevant to
   that specific job, plus one new, genuinely job-specific opening
   sentence naming the target role/company and, in plain English, the
   real skills from Roy's actual resume that the job posting also asks
   for (e.g. "meeting service commitments" rather than "SLA"). The cover
   letter uses the same approach and shares the resume's visual style —
   same colors, font, and layout — so the two read as a matched set. No
   content is invented and no jargon is introduced: everything named is
   something both the job posting and the real resume already state;
   only the order/emphasis of existing bullets and that one new sentence
   change per job.
   
   **If you only see the resume download and not the cover letter**,
   your browser likely blocked the second automatic download (a common
   default in Chrome and other browsers for a single click triggering
   multiple downloads). Check for a download-blocked notice, usually near
   the address bar, choose "Allow" or "Download anyway", then click the
   button again.
5. **Track applications**: use the Status dropdown (Not applied / Applied /
   Interview / Offer / Rejected) and the Notes field on each row. The
   moment you change a job's status away from "Not applied", it
   **automatically moves out of the main table and into the separate
   "Applied Jobs" section below** — so your main list always shows only
   what you haven't acted on yet, and your applied jobs live together
   where you can track their progress. Change status again anytime
   (e.g. Applied → Interview → Offer) — no need to re-add anything, the
   job just updates in place. Set it back to "Not applied" and it moves
   back to the main table. All of this is saved in your browser's local
   storage — it persists across page reloads in this browser, but does
   not sync to another device or browser, and is lost if you clear
   browser data. Use the Excel export (next point) as a periodic backup
   if that matters to you.
6. **Export all jobs to Excel**: click this to download an `.xlsx`
   containing everything currently loaded — both the main table and the
   Applied Jobs table — including your tracked status and notes for each
   row. This always exports everything, regardless of what your current
   filters are showing.
7. Use **Hide low-confidence rows** to further narrow the main table to
   only postings scored from a full job description, not a thin snippet.
   This and the compatibility threshold only affect the main table — the
   Applied Jobs table always shows everything you've marked, unfiltered.

If you ever update Roy's CV, edit `resume_data.py` to match, then run
`python3 export_resume_js.py` to regenerate `resume_data.js` — the
dashboard reads the `.js` file, not the `.py` file directly.

---

## 2.1.1 Adding a job manually (not from the scraper)

Click **+ Add a job manually** for a role you found yourself — on
LinkedIn, through a referral, browsing a company's careers page directly
— rather than one the scraper picked up. A form asks for:

- **Job title** and **Company** (required)
- **Location** (optional, but recommended — used by the Singapore filter
  logic elsewhere in this package, though the dashboard itself doesn't
  filter manually-added jobs by location)
- **Job posting URL** (optional — used as the key for tracking status; if
  you leave it blank, the job is still tracked correctly, just keyed by
  title + company instead)
- **Job description** (optional, but strongly recommended — paste the
  full posting text here for an accurate match score; a short or blank
  description will be scored but flagged "LOW confidence", the same as
  any thin scraped posting)

Click **Add job** and it's scored immediately using the same matching
logic as every other row, appears in the main table (or the Applied Jobs
table, if you set its status there first), and works identically with
**Review**, **Resume + Cover Letter** generation, status tracking, and
Excel export — nothing downstream treats a manually-added job any
differently from one the scraper found.

**Manually-added jobs are permanent — when the dashboard is opened
through `serve_dashboard.py` (see the note at the top of this section).**
They're saved to browser storage the moment you add them, and are
automatically restored every time the dashboard loads — whether that's a
page refresh, a fresh GitHub fetch, or loading a completely different
report file. Loading a new report never removes a manually-added job;
it's always merged in alongside whatever the report contains. The only
way to remove one is the explicit **Remove** button that appears on that
row (only manually-added rows have this button — scraped rows don't),
which asks you to confirm first. "Clear all tracking data" only clears
application statuses and notes; it does not touch manually-added jobs at
all.

**If `dashboard.html` is opened by double-clicking it instead**, this
persistence is unreliable — not because of a bug in this project, but
because browsers treat data storage on `file://` pages as officially
undefined behavior (see the note at the top of this section for the
full explanation and the fix).

If you edit a manually-added job's description later via **Review** and
click "Re-score", that edit is saved too — the description you last
entered is what comes back on the next page load, not the original text.

If a save ever fails (browser storage full or restricted, common in
private/incognito browsing, or opening the file directly instead of
through the server), you'll get a clear warning saying so — the job
still shows up in your list for that session, but you'll know it isn't
safely stored and could be lost on reload, rather than the dashboard
silently pretending everything worked.

If you re-import a `.xlsx` file you previously exported and it contains
a manually-added job, the dashboard recognizes it's the same job (by
title, company, and URL) and won't create a duplicate row alongside the
one already saved.

If you paste in a URL that's already in the table, the dashboard blocks
the add and tells you to use "Review" on the existing row instead — this
prevents two different rows from accidentally sharing one tracked status,
since tracking is keyed by URL.

---

## 2.2 Fully automated loading — no manual file upload (optional)

By default, you load a report into the dashboard by clicking **Choose
File** each time. If you're running the daily scraper via GitHub Actions
(Section 5), you can skip that manual step entirely: the dashboard will
automatically fetch the newest report straight from your private repo
the moment you open it.

**One-time setup:**
1. Go to https://github.com/settings/tokens?type=beta and generate a
   **fine-grained personal access token**:
   - Repository access → "Only select repositories" → choose your repo
     (e.g. `job-search-tracker`) — do NOT grant access to all repos
   - Permissions → Repository permissions → **Contents: Read-only** —
     leave every other permission as "No access"
   - Set an expiration (90 days is reasonable) and generate
   - Copy the token immediately — GitHub only shows it once
2. In your local `job-scraper` folder, copy `gh_config.example.js` to a
   new file named `gh_config.js`
3. Open `gh_config.js` and fill in your GitHub username, repo name, and
   the token you just copied
4. Save. `gh_config.js` is already listed in `.gitignore`, so it will
   never be committed or pushed — it stays local to your machine only

From now on, opening `dashboard.html` automatically checks GitHub for the
newest `match_report_*.html` in `output/` and loads it — no click
required. A **Refresh from GitHub** button is also available if you want
to manually re-check without reloading the whole page (useful right after
a scheduled Action run finishes).

**Security notes, read before setting this up:**
- The token can only **read** files from the one repository you selected
  — it cannot write, delete, or see any other repository or account
  setting. If it's ever exposed, the worst case is someone reading your
  job-search data, not modifying your account.
- Still, treat `gh_config.js` like a password file. Don't email it,
  don't paste it into chat, don't put it anywhere synced to a public
  location. If you ever suspect it's been exposed, revoke it immediately
  at https://github.com/settings/tokens?type=beta and generate a new one.
- If `gh_config.js` doesn't exist yet, or still has the placeholder
  values from the example file, the dashboard simply falls back to
  manual file loading — nothing breaks, you just don't get the
  automatic fetch until you set it up.
- The token will expire on whatever date you chose. When it does,
  automatic fetching will start failing with a clear "GitHub fetch
  failed: GitHub API 401" message in the status bar — generate a new
  token and update `gh_config.js` when that happens.

---

## 3. Automating the daily run

### macOS / Linux (cron)
```bash
crontab -e
```
Add a line to run every morning at 8am:
```
0 8 * * * cd /full/path/to/job-scraper && /usr/bin/python3 scraper.py >> output/cron.log 2>&1
```

### Windows (Task Scheduler)
1. Open Task Scheduler → Create Basic Task
2. Trigger: Daily, pick a time (e.g. 8:00 AM)
3. Action: Start a program
   - Program: `python`
   - Arguments: `scraper.py`
   - Start in: the full path to your `job-scraper` folder
4. Finish

The match report is a separate manual step (`python3 match_report.py ...`)
since it's more useful to run it on-demand after reviewing what came in,
rather than blindly regenerating an Excel file daily.

---

## 4. Tuning your search

Edit `config.py`:
- `SEARCH_TITLES` — add/remove title strings searched against Adzuna/Jooble/Careerjet
- `SENIORITY_KEYWORDS` — a posting's title must contain one of these to
  survive filtering (keeps out manager/IC-level noise)
- `EXCLUDE_TITLE_KEYWORDS` — drop postings with these words in the title
- `LOCATION_FILTER_KEYWORDS` / `RESTRICT_TO_SINGAPORE` — controls the
  Singapore-only filter applied to every source after fetching (see box
  below for why this exists and how it works)

**Why a location filter is needed at all:** Adzuna, Jooble, and Careerjet
accept a location parameter directly in their search request, but Greenhouse,
Lever, Workday, and Eightfold do not — those APIs return every open role
at a company worldwide. Without a filter, one company with a large global
board (Addepar has roughly 100 open roles at last check) would flood the
scored report with postings in India, Poland, the US, and everywhere else
the company hires — making it hard to find the handful actually based in
Singapore. `LOCATION_FILTER_KEYWORDS` (currently `"singapore"` and
`"sg -"`, to also catch formats like Visa's `"SG - Singapore"`) is checked
against every posting's location field, from every source, after
fetching. Set `RESTRICT_TO_SINGAPORE = False` in `config.py` to disable
this and see all locations again, e.g. if you ever want to search more
broadly across ASEAN.

One deliberate tradeoff: a posting with an ambiguous multi-location string
like `"3 Locations"` (seen from Malvern Panalytical's Workday feed, when
one posting is open at several offices at once) is **excluded** rather
than guessed as a match, since the filter has no way to confirm Singapore
is actually one of the listed locations without an extra API call per
job. If you notice roles you know are Singapore-based being missed this
way, check the company's careers page directly for that specific posting.

Edit `match_report.py`:
- `RESUME_PROFILE` — the keyword categories used for ATS-style scoring.
  Update if Roy's target roles or skill emphasis shifts.
- `MATCH_THRESHOLD` — currently 75, per your requirement
- `LOW_CONFIDENCE_DESC_LENGTH` — character threshold below which a
  description is flagged unreliable (default 200)

Edit `resume_data.py` (then run `python3 export_resume_js.py`):
- Update this if Roy's actual CV changes — every fact here should match
  `Roy_Wong_CV_190826.docx` exactly. This feeds both the HTML/Excel
  report scoring context and the dashboard's Word document generation.
  Re-run the export script after any change so `resume_data.js` (used by
  `dashboard.html`) stays in sync — the dashboard does not read the
  `.py` file directly.

---

## 5. Running automatically via GitHub (no local machine needed, no hosting)

This is an alternative to section 3's cron/Task Scheduler approach: instead
of your own computer running the daily job, a **private GitHub repo** runs
it for you on GitHub's free infrastructure, and commits results back into
the repo where only you can see them.

**What this is NOT:** a public website. GitHub Pages requires a paid plan
to publish from a private repository, and even then the published site
itself isn't genuinely access-controlled without an Enterprise org. So
this setup keeps everything private by simply not publishing anything —
you view results as files inside the repo, using the included
`dashboard.html` as a local, no-server results viewer and workspace.

### 5.1 Create the private repo
1. On GitHub: **New repository** → name it (e.g. `job-search-tracker`) →
   set **Private** → Create.
2. Push this whole `job-scraper` folder to it:
   ```bash
   cd job-scraper
   git init
   git add .
   git commit -m "Initial commit: job scraper"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/job-search-tracker.git
   git push -u origin main
   ```

### 5.2 Add your API keys as encrypted Secrets
Repo Secrets are encrypted and never appear in code, logs, or the repo
itself — this is the correct way to store credentials for Actions.

1. In the repo: **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**, add each of:
   - `ADZUNA_APP_ID`
   - `ADZUNA_APP_KEY`
   - `JOOBLE_API_KEY` (optional)

The workflow file (`.github/workflows/daily-scrape.yml`) references these
by name automatically — you don't edit the workflow to add them.

### 5.3 Enable and test the workflow
1. Go to the **Actions** tab in your repo. If prompted, click
   "I understand my workflows, go ahead and enable them."
2. You'll see "Daily Job Scrape" listed. Click it, then **Run workflow**
   (the manual trigger) to test it immediately rather than waiting for
   the schedule.
3. Check the run's logs. On success, `git pull` locally (or browse the
   `output/` folder on github.com) to see the new CSV and Excel report.

By default it runs once daily at 00:00 UTC (08:00 Singapore time). Edit
the `cron:` line in the workflow file to change this — cron times are
always UTC.

### 5.4 Viewing results
Two ways, both fully private:
- **On github.com**: open the private repo → `output/` folder → click
  a `.html`, `.csv`, or `.xlsx` file → GitHub renders a preview in-browser
  (you must be logged in with repo access). The `.html` report opens as a
  fully-formatted page.
- **Locally with the dashboard**: `git pull` to get the latest files, then
  open `dashboard.html` (just double-click it) and use the file picker to
  load the day's `.html` report (or `.xlsx`/`.csv`). This reads the file
  entirely in your browser — nothing is uploaded anywhere — and also gives
  you the resume/cover letter generation, Excel export, and application
  tracker described in Section 2.1. It needs an internet connection the
  first time you use "Generate Resume + Cover Letter" or "Export to
  Excel" (to load the `docx`/`xlsx` libraries from their CDNs); after
  that, those libraries are typically cached by your browser.

### 5.5 Cost and limits
- Private repos: free, unlimited, on a personal GitHub account
- Actions minutes: 2,000/month free for private repos — this job uses
  roughly 1 minute/run, so ~30/month, well within the free tier
- No Pages, no server, no recurring cost

## 6. Known limitations (be aware of these)

- **Aggregators don't have 100% coverage.** Adzuna/Jooble/Careerjet re-publish a
  large but incomplete slice of what's on LinkedIn/Indeed/JobStreet.
  Checking those sites manually once a week alongside this tool is still
  worthwhile.
- **Match % is a keyword-coverage heuristic, not a guarantee.** It's built
  to approximate how an ATS keyword scan behaves, weighted toward Roy's
  core strengths (service delivery governance, SLA/KPI, escalation,
  renewal, regional leadership). It cannot replace reading the actual JD
  before applying.
- **Description quality varies by source.** Greenhouse/Lever postings
  usually include the full JD. Adzuna/Jooble/Careerjet aggregator results sometimes
  only include a short snippet. Workday and Eightfold's list/search
  endpoints never include the full JD (title/location/link only) — hence
  the confidence flag on every row from those two sources.
- **The Singapore-only location filter is text-based, not geocoded.** It
  checks each posting's location string for keywords like "singapore" —
  it doesn't know the actual company office location beyond what the ATS
  reports as text. Ambiguous multi-location postings (e.g. "3 Locations")
  are excluded rather than guessed as matches — see Section 4 for detail.
- **The application tracker is browser-local only.** Status and notes
  entered in `dashboard.html` are saved via your browser's local storage,
  keyed to that specific browser on that specific computer. There is no
  server and no sync — switching browsers or computers means starting a
  fresh tracker there. Use "Export all jobs to Excel" periodically if
  you want a durable, portable backup of your tracked statuses.
- **Resume/cover letter tailoring reorders real content; it doesn't
  rewrite it.** The generated documents always use Roy's actual, true
  bullet points and competency descriptions — tailoring changes which
  ones are emphasized first based on the job description's language, but
  never invents new claims or exaggerates existing ones. This is
  intentional, but means the documents won't "speak to" a requirement
  that has no genuine match anywhere in the underlying resume data.
- **Document generation needs internet access** (at least the first time
  per browser session) to load the `docx` and Excel-writing libraries
  from their CDNs. If your network blocks those CDN domains, the
  "Generate Resume + Cover Letter" and "Export to Excel" buttons in
  `dashboard.html` will fail, though the job table itself will still work.
- **Automatic GitHub fetch (Section 2.2) needs a token you manage
  yourself.** Fine-grained personal access tokens are still a GitHub
  public-preview feature per their own documentation — functional and
  fine for this use, but not guaranteed as stable as their long-standing
  "classic" tokens. The token also has an expiration date you chose; when
  it lapses, auto-fetch stops working (with a clear error message) until
  you generate a replacement. This is optional — everything else in this
  package works fully without ever setting it up.

# Setup Guide — Job Search Scraper (Private GitHub, No Hosting)

This walks through everything from a completely fresh start: installing
tools, getting API keys, creating the private repo, wiring up secrets, and
confirming it actually runs. Follow the sections in order the first time.

**Total time:** roughly 30–45 minutes, one-time.

---

## Before you start — what you'll end up with

- A **private** GitHub repository only you can see
- A scheduled job that runs automatically every day on GitHub's servers
  (not your computer) and searches for Director+ roles matching your CV
- Results (CSV + detailed HTML report + Excel) saved back into that
  private repo
- A local `dashboard.html` file you open in your browser to browse
  results, generate a tailored Word resume + cover letter for any job
  with one click, export results to Excel, and track which jobs you've
  applied to — no server required

No cost, no server to maintain, no public website.

---

## Part 1 — Install the tools you need locally

You need two things on your computer even though the scraper *runs* on
GitHub: **Git** (to push the code up once) and a way to edit a text file
(any editor works, even Notepad).

### 1.1 Check if Git is already installed
Open a terminal:
- **Windows:** press `Win`, type `cmd`, press Enter (Command Prompt), or use PowerShell
- **Mac:** press `Cmd+Space`, type `terminal`, press Enter

Type:
```bash
git --version
```
If you see something like `git version 2.43.0`, skip to Part 2.

### 1.2 Install Git (if needed)
- **Windows:** download and run the installer from https://git-scm.com/download/win — accept all defaults
- **Mac:** run `git --version` in Terminal; if not installed, macOS will prompt you to install Xcode Command Line Tools — click Install

Verify again with `git --version`.

### 1.3 Create a free GitHub account (if you don't have one)
Go to https://github.com/signup and create an account. Remember your
username — you'll need it later.

### 1.4 Configure Git with your identity (one-time)
```bash
git config --global user.name "Roy Wong"
git config --global user.email "your-github-account-email@example.com"
```
Use the same email as your GitHub account.

---

## Part 2 — Get your free API keys

The scraper pulls listings from two free job-search APIs. You need at
least Adzuna; Jooble is optional but recommended for wider coverage.

### 2.1 Adzuna (required)
1. Go to https://developer.adzuna.com/
2. Click **Register** (top right), create a free account
3. Once logged in, go to your **Dashboard** / **My Applications**
4. Click **Create App** (or similar) — name it anything, e.g. "job-tracker"
5. You'll be shown an **App ID** and **App Key** — copy both somewhere
   temporary (a notes app). You'll paste these into GitHub in Part 4.

### 2.2 Jooble (optional but recommended)
1. Go to https://jooble.org/api/about
2. Fill in the short form (name, email, intended use — "personal job
   search" is fine)
3. You'll receive one **API key** by email or on-screen — save it with
   the Adzuna keys.

---

## Part 3 — Download the scraper files and create the repo

### 3.1 Get the files onto your computer
Take the `job-scraper` folder I provided (containing `scraper.py`,
`match_report.py`, `config.py`, `resume_data.py`, `resume_data.js`,
`export_resume_js.py`, `docgen.js`, `dashboard.html`,
`gh_config.example.js`, `requirements.txt`, `README.md`,
`SETUP_GUIDE.md`, `UPDATE_NOTES_AND_INSTRUCTIONS.md`, `.gitignore`, and
the `.github/workflows/daily-scrape.yml` file) and save it somewhere
permanent, e.g.:
- Windows: `C:\Users\YourName\job-scraper`
- Mac: `/Users/YourName/job-scraper`

### 3.2 Create the private repository on GitHub
1. Go to https://github.com/new
2. **Repository name:** `job-search-tracker` (or anything you prefer)
3. **Description:** optional, e.g. "Private daily job search tracker"
4. Select **Private** (this is important — do not select Public)
5. Do **NOT** check "Add a README" (you already have one) — leave all
   the initialize checkboxes unticked
6. Click **Create repository**

GitHub will show you a page with setup commands — keep this page open,
you'll use the "push an existing repository" section next.

### 3.3 Push your files to the new repo
Open a terminal, navigate into your folder, and run these commands one
at a time:

```bash
cd path/to/job-scraper
git init
git add .
git commit -m "Initial commit: job search scraper"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/job-search-tracker.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username and
`job-search-tracker` with whatever you named the repo.

**First push authentication:** GitHub will prompt you to sign in.
- If a browser window pops up asking you to authorize, do so.
- If it asks for a username/password in the terminal, use your GitHub
  username, and for the password use a **Personal Access Token** (GitHub
  stopped accepting real passwords for this in 2021):
  1. Go to https://github.com/settings/tokens
  2. **Generate new token** → **Generate new token (classic)**
  3. Give it a name, set expiration (90 days is fine), check the **repo**
     scope checkbox
  4. Generate, then copy the token immediately (you won't see it again)
  5. Paste this token as the "password" when Git asks

Once this succeeds, refresh your repo page on github.com — you should
see all your files there.

---

## Part 4 — Add your API keys as GitHub Secrets

This is the step that lets the automated job use your API keys without
ever exposing them in code.

1. On your repo's GitHub page, click **Settings** (top menu of the repo,
   not your account settings)
2. In the left sidebar: **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the first one:
   - **Name:** `ADZUNA_APP_ID`
   - **Secret:** paste the App ID you saved earlier
   - Click **Add secret**
5. Repeat for:
   - **Name:** `ADZUNA_APP_KEY` → paste your Adzuna App Key
   - **Name:** `JOOBLE_API_KEY` → paste your Jooble key (skip if you
     didn't sign up for Jooble)

You should now see 2 or 3 secrets listed (values are hidden — that's
expected, GitHub never shows them again after saving).

---

## Part 5 — Enable and test the automated run

### 5.1 Enable Actions
1. Go to the **Actions** tab on your repo
2. If you see a message like "Workflows aren't being run on this
   repository," click the green **I understand my workflows, go ahead
   and enable them** button
3. You should now see **Daily Job Scrape** listed in the left sidebar

### 5.2 Run it manually to test
1. Click **Daily Job Scrape** in the left sidebar
2. Click the **Run workflow** dropdown button (top right of the list)
3. Leave the branch as `main`, click the green **Run workflow** button
4. Refresh after a few seconds — you'll see a new run appear with a
   yellow dot (running) that turns into a green checkmark (success) or
   red X (failed), usually within 30–60 seconds

### 5.3 If it fails — how to read the error
Click on the failed run, then click the job name (`scrape-and-score`) to
expand each step. Common issues:

| Error mentions | Likely cause | Fix |
|---|---|---|
| `401` or `403` from Adzuna/Jooble | Wrong or missing API key | Re-check Part 4 — secret names must match exactly (`ADZUNA_APP_ID`, not `adzuna_app_id`) |
| `git push` permission denied | The workflow file already requests write access, but your account/org default can override this | Go to Settings → Actions → General → scroll to "Workflow permissions" → select "Read and write permissions" → Save, then re-run |
| Nothing about errors, just "No new postings today" | Working correctly — no new postings matched your filters yet | Nothing to fix; this is normal on quiet days |

### 5.4 Confirm results landed in the repo
1. Go to your repo's main page (the **Code** tab)
2. Open the `output/` folder
3. You should see files like `jobs_2026-09-11.csv`,
   `match_report_2026-09-11.xlsx`, `seen_jobs.json`, and `run_log.txt`
4. Click on the `.xlsx` file — GitHub will show a preview of the
   spreadsheet directly in the browser

If you see these files, the whole pipeline works end to end.

---

## Part 6 — Viewing results, generating documents, and tracking applications

You have two options every time you want to check new results:

### Option A — Browse on github.com (simplest, no setup)
Just go to your repo → `output/` folder → open the newest `.html` report
(or `.xlsx`). GitHub renders a read-only preview in-browser. Good for a
quick check, but you can't generate documents or track applications this
way — use Option B for that.

### Option B — Use the local dashboard (full features)
1. Pull the latest files to your computer:
   ```bash
   cd path/to/job-scraper
   git pull
   ```
2. **Run the local server, then open the dashboard through it** — this
   is important, not optional, if you want manually-added jobs and
   tracked application statuses to actually persist across reloads:
   ```bash
   python3 serve_dashboard.py
   ```
   It prints a link and opens it automatically. Leave the terminal
   window open while you use the dashboard. (Double-clicking
   `dashboard.html` directly also works for browsing, scoring, and
   generating documents — but browser data storage is unreliable on a
   directly-opened file, which is exactly why a saved job can
   mysteriously vanish after a reload if you skip this step. See
   `README.md` Section 2.1 for the full explanation.)
3. Click **Choose File**, navigate to the `output/` folder, select the
   newest `match_report_*.html` (preferred — carries full job descriptions
   for better tailoring) or `.xlsx`/`.csv`
4. The table loads, sorted by match % — click any column header to
   re-sort, rows at 75%+ match are highlighted green, and any row marked
   "LOW (thin JD text)" means the score was based on a short snippet, not
   a full description — open that job's link and read the real posting
   before trusting the number.
5. For any role you're interested in:
   - Set its **Status** (Applied, Interview, Offer, Rejected) and add
     **Notes** — this saves automatically in this browser
   - Click **Resume + Cover Letter** to download two tailored `.docx`
     files for that specific job (uses your real CV content, reordered
     to emphasize what's most relevant to that posting — nothing is
     invented)
6. Click **Export all jobs to Excel** any time you want a backup
   copy of everything currently loaded, including your tracked statuses —
   useful since the tracker itself only lives in this browser (see the
   note on the dashboard page itself for details).

You'll need to repeat step 1 (`git pull`) each time you want to see a
new day's results, since the dashboard reads local files only. Your
application-tracking data, however, stays in this browser across
sessions even without pulling — it isn't tied to the loaded file.

### Optional: skip the manual file loading entirely

Steps 1–3 above (`git pull`, open the file picker, select the file) can
be automated so `dashboard.html` fetches the newest report from GitHub
by itself when you open it — no download, no upload, no `git pull`
needed just to check results.

1. Go to https://github.com/settings/tokens?type=beta → **Generate new
   token** (fine-grained)
2. Repository access → **Only select repositories** → pick your repo
3. Permissions → Repository permissions → **Contents: Read-only** (leave
   everything else as "No access")
4. Set an expiration, generate, and copy the token immediately
5. In your local `job-scraper` folder, copy `gh_config.example.js` to
   `gh_config.js` and fill in your GitHub username, repo name, and the
   token
6. Open `dashboard.html` — it will now check GitHub automatically on
   load, and a **Refresh from GitHub** button lets you re-check anytime
   without reloading the page

`gh_config.js` is already excluded via `.gitignore`, so it stays on your
computer only and is never pushed to the repo. Treat it like a password
file regardless — it's a real credential, just a narrowly-scoped one
(read-only, this one repo only). Full details and security notes are in
`README.md` Section 2.2.

---

## Part 7 — Ongoing maintenance

- **Nothing to do daily** — it runs itself at 00:00 UTC (08:00 SGT) every
  day. Just `git pull` and check the dashboard whenever you want.
- **To change the schedule:** edit `.github/workflows/daily-scrape.yml`,
  change the `cron:` line (it's in UTC), commit and push the change.
- **To change search terms or filters:** edit `config.py`
  (`SEARCH_TITLES`, `SENIORITY_KEYWORDS`, `EXCLUDE_TITLE_KEYWORDS`),
  commit and push.
- **To update the resume-matching keywords** (e.g. after your target
  roles shift): edit `RESUME_PROFILE` in `match_report.py`, commit and
  push.
- **To update Roy's actual CV content** (used for both scoring context
  and generated Word documents): edit `resume_data.py` to match the real,
  current CV exactly, then run `python3 export_resume_js.py` to
  regenerate `resume_data.js` (the dashboard reads the `.js` file, not
  the `.py` file), then commit and push both files together.
- **To push any change**, the pattern is always:
  ```bash
  git add .
  git commit -m "describe what you changed"
  git push
  ```
- **Check `UPDATE_NOTES_AND_INSTRUCTIONS.md`** for a running log of what's
  changed in this package over time, including bugs found and fixed —
  useful context if something behaves differently than you expect.

---

## Quick troubleshooting reference

| Problem | Check |
|---|---|
| No `output/` folder appears after first run | Check the Actions log for the "Commit and push results" step — it only commits if a new CSV was created that day |
| Workflow doesn't appear in Actions tab | Confirm `.github/workflows/daily-scrape.yml` was actually pushed — check on github.com under that exact path |
| `git push` asks for password every time | Set up an SSH key or a credential manager (see https://docs.github.com/en/authentication) — optional convenience, not required |
| Want to stop the daily runs temporarily | Actions tab → Daily Job Scrape → **...** menu (top right) → **Disable workflow** |
| Want to delete everything and start over | Delete the repo from Settings → scroll to bottom → **Delete this repository** |
| Dashboard shows "gh_config.js not set up" | Expected if you haven't done the optional automation setup (Part 6) — load files manually, or follow Part 6 to enable auto-fetch |
| Dashboard shows "GitHub fetch failed: GitHub API 401" | Your token is invalid or expired — generate a new fine-grained token and update `gh_config.js` |
| Dashboard shows "GitHub fetch failed: GitHub API 404" | Check `gh_config.js` — the `owner` or `repo` value likely doesn't match your actual GitHub username/repo name exactly |
| Dashboard shows "no match_report_*.html files found yet" | The workflow hasn't produced a scored HTML report yet — check Actions tab, or the scraper may have found zero new postings that day |
| A manually-added job or a tracked status disappears after reloading the dashboard | You almost certainly opened `dashboard.html` by double-clicking it rather than through `python3 serve_dashboard.py` — browser storage is unreliable on a directly-opened file (this is a documented browser behavior, not a bug). Run `python3 serve_dashboard.py` and use the `http://localhost:8765/...` link it prints instead — that fixes it |

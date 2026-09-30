# Setting Up Live 4D/TOTO Data — Complete Step-by-Step Guide

This walks through the entire setup from scratch, assuming no prior GitHub
experience. It uses only the GitHub website (no command line / git
installation needed). Total time: about 15-20 minutes.

**What you'll end up with**: the app's 4D/TOTO section will show real,
automatically-refreshing draw results instead of the static snapshot, plus
a growing historical database that improves the number suggestions over time.

---

## Part 1 — Create a GitHub account (skip if you already have one)

1. Go to **https://github.com/signup**
2. Enter an email address, create a password, choose a username
3. Verify your email (GitHub will send a code or link)
4. You now have a free GitHub account — this is all you need, no paid plan required

---

## Part 2 — Create a new repository to hold the scraper

A "repository" (repo) is just a project folder that lives on GitHub.

1. Once logged in, click the **+** icon in the top-right corner of any
   GitHub page → **New repository**
2. Fill in:
   - **Repository name**: something like `illuminate-lottery-data` (any name works)
   - **Public or Private**: choose **Public** — this is required, because
     the app needs to read the data file from this repo directly, and that
     only works reliably on public repos without extra authentication setup
   - Leave everything else as default
3. Click the green **Create repository** button
4. You'll land on an empty repository page — keep this tab open

---

## Part 3 — Upload the scraper files

You should have received (or downloaded) a folder called `lottery-scraper`
containing three files: `scraper.js`, `refresh-lottery.yml`, `README.md`.

1. On your new repo's page, click **Add file** → **Upload files**
2. Drag `scraper.js` and `README.md` into the upload box. To keep them in a
   subfolder (recommended, matches the automation file's default setup),
   type `lottery-scraper/` before dragging, or drag the whole
   `lottery-scraper` folder itself if your browser supports folder drag-drop
3. Scroll down, click the green **Commit changes** button
4. You should now see a `lottery-scraper` folder in your repo containing
   `scraper.js` and `README.md`

---

## Part 4 — Add the automation file in the right location

GitHub only recognizes automation files (called "Actions workflows") if
they're in a specific folder path: `.github/workflows/`.

1. On your repo's page, click **Add file** → **Create new file**
2. In the "Name your file..." box at the top, type exactly:
   ```
   .github/workflows/refresh-lottery.yml
   ```
   (Typing the slashes will automatically create the folders for you — you
   don't need to create `.github` and `workflows` separately first.)
3. Open your local `refresh-lottery.yml` file in any text editor, select all
   the text, and copy it
4. Paste the entire contents into the big text box on the GitHub page
5. Scroll down, click the green **Commit changes** button

You should now have this structure in your repo:
```
your-repo/
├── .github/
│   └── workflows/
│       └── refresh-lottery.yml
├── lottery-scraper/
│   ├── scraper.js
│   └── README.md
```

---

## Part 5 — Run the scraper for the first time

The automation is scheduled to run automatically a few times a day, but
don't wait for that — trigger it manually right now so you can confirm it
works and get your first `history.json` file immediately.

1. On your repo's page, click the **Actions** tab (top menu, near "Code",
   "Issues", "Pull requests")
2. You should see a workflow listed called **Refresh Lottery History** in
   the left sidebar — click it
3. On the right, click the **Run workflow** dropdown button, then click the
   green **Run workflow** button that appears
4. Wait about 10-15 seconds, then refresh the page. You'll see a new run
   appear in the list, with a yellow dot (running), then either a green
   checkmark (success) or a red X (failed)

### If you see a green checkmark ✅
Click on the run, then click the job name (e.g. "refresh") to see the logs.
You should see lines like:
```
Fetching 4D past-results table: https://check4d.co/sgpools/past/
Backfill found 35 4D entries in the past-results table.
Fetching live page: https://check4d.co/sgpools/
Wrote .../history.json: 35 4D draws (1 full), 1 TOTO draws.
```
This confirms it worked. Go back to your repo's main **Code** tab — you
should now see a new file `lottery-scraper/history.json` has appeared.

### If you see a red X ❌
Click on the run, then the job name, to see the error message. The most
likely causes:
- The source website (check4d.co) may have changed its page layout since
  this scraper was written — see "Troubleshooting" at the end of this guide
- A temporary network issue — try **Run workflow** again

---

## Part 6 — Get the URL to your live data

1. On your repo's **Code** tab, navigate into the `lottery-scraper` folder
   and click on the `history.json` file to open it
2. Click the **Raw** button (top-right of the file view)
3. Your browser will now show the raw JSON text, and the URL in your
   address bar is what you need. It will look like:
   ```
   https://raw.githubusercontent.com/YOUR-USERNAME/illuminate-lottery-data/main/lottery-scraper/history.json
   ```
4. Copy this exact URL

---

## Part 7 — Connect the app to your live data

1. Open `engine-predictions.js` (one of the main app files) in any text editor
2. Find this line near the top of the file (use Ctrl+F / Cmd+F to search for `LOTTERY_JSON_URL`):
   ```js
   const LOTTERY_JSON_URL = ''; // e.g. 'https://raw.githubusercontent.com/<you>/<repo>/main/lottery-scraper/history.json'
   ```
3. Replace the empty `''` with your actual URL from Part 6, so it looks like:
   ```js
   const LOTTERY_JSON_URL = 'https://raw.githubusercontent.com/YOUR-USERNAME/illuminate-lottery-data/main/lottery-scraper/history.json';
   ```
4. Save the file
5. Re-upload/re-deploy this updated `engine-predictions.js` to wherever you
   host the main Illuminate app (replace the old copy)

---

## Part 8 — Verify it's working in the app

1. Open the Illuminate app, sign in, go to the home screen
2. Scroll to the 4D/TOTO section
3. You should see a green line reading something like:
   > ✅ Live data, fetched [date/time] (repository holds 35 draws, source: check4d.co mirror).
4. Tap the **🔄 Refresh** button — it will briefly show "Fetching latest..."
   then update
5. Try the **Browse Past Draws** picker — pick a year and date, tap "View
   This Draw" — you should see a real historical result

If instead you see:
> Verified as of [date] (static snapshot - live source not yet configured).

...then `LOTTERY_JSON_URL` wasn't saved correctly in Part 7 — double check
the file was actually updated and re-uploaded to your hosting location.

If you see:
> ⚠️ Live fetch failed - showing last known snapshot...

...then the URL is set but something's wrong with reaching it — double
check the URL from Part 6 is exactly right (a common mistake is a typo in
the username or repo name), and make sure the repo is set to **Public**.

---

## What happens automatically from here

The GitHub Action is scheduled to run three times a day (see the `cron`
lines in `refresh-lottery.yml` if you want to adjust the timing) and will
keep adding new draws to `history.json` forever, without you doing anything
further. You can check on it anytime via your repo's **Actions** tab.

---

## Troubleshooting

**"Run workflow" button doesn't appear on the Actions tab**
Make sure `refresh-lottery.yml` is at exactly `.github/workflows/refresh-lottery.yml`
(check for typos, and that `.github` starts with a dot).

**The Action fails with a fetch/parsing error**
check4d.co (the results source) may have changed its page structure. Open
the failed run's log to see the specific error message, which will tell you
which part of the page the scraper couldn't find. This scraper's parsing
logic would need updating to match the new page structure — this is a normal
maintenance need for any web scraper, not unique to this one.

**history.json shows 0 draws or looks empty**
Check the Action's log for warnings — the scraper is designed to fail loudly
with a clear error rather than silently write bad data, so if it succeeded
(green checkmark) but the file looks sparse, check the log for any "backfill
failed" warnings that explain what was skipped and why.

**I want to change how often it refreshes**
Edit the `cron:` lines near the top of `refresh-lottery.yml` (there are
three, each in `minute hour * * *` format, times in UTC). You can also
always trigger a manual run anytime via **Run workflow** regardless of the
schedule.

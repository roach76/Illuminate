# Running the Historical Imports — Complete Step-by-Step Guide

This covers `import-historical-4d.js` and `import-historical-toto.js` — the
two one-time scripts that backfill your `history.json` with deep historical
data (5,508 4D draws back to 1986, and 1,810 TOTO draws back to 2008).

**You only need to run each of these once** (or occasionally, if you later
get updated source data). They are separate from `scraper.js`, which keeps
running automatically on its existing schedule for new draws.

There are two ways to run them — pick whichever you're more comfortable
with:
- **Path A: On your own computer** — needed if you want to use
  `import-historical-toto.js` with your own CSV file (this is the more
  common case, since that script needs the CSV file sitting next to it).
- **Path B: Via GitHub Actions** — works fully in the browser, no software
  to install, but only really works well for `import-historical-4d.js`
  (which downloads its own data automatically). For `import-historical-toto.js`,
  you'd need to already have your CSV file *in* the repository first — see
  the note in Path B for how to do that.

---

## Path A: Running on your own computer (recommended, especially for TOTO)

### A.1 — Install Node.js (skip if you already have it)

1. Go to **https://nodejs.org**
2. Download and install the "LTS" (Long Term Support) version for your
   operating system (Windows, Mac, or Linux)
3. To check it worked, open a terminal (Command Prompt or PowerShell on
   Windows, Terminal on Mac) and type:
   ```
   node --version
   ```
   You should see something like `v20.11.0` or similar. Any reasonably
   recent version works.

### A.2 — Get the project files onto your computer

If you already have the Illuminate repository cloned/downloaded to your
computer, skip to A.3. Otherwise:

1. Go to your repository on GitHub (e.g. `https://github.com/roach76/Illuminate`)
2. Click the green **Code** button → **Download ZIP**
3. Unzip it somewhere convenient (e.g. your Desktop or Documents folder)

### A.3 — Open a terminal in the `lottery-scraper` folder

1. Open a terminal (Command Prompt/PowerShell/Terminal)
2. Navigate into the folder. For example, if you unzipped to your Desktop:
   ```
   cd Desktop/Illuminate-main/lottery-scraper
   ```
   (Adjust the path to match wherever your files actually are — if you're
   not sure, you can usually drag the `lottery-scraper` folder from your
   file explorer straight into the terminal window after typing `cd `, and
   it will fill in the correct path automatically.)
3. Confirm you're in the right place by listing the files:
   - **Mac/Linux**: `ls`
   - **Windows**: `dir`

   You should see `scraper.js`, `import-historical-4d.js`,
   `import-historical-toto.js`, `README.md`, and `refresh-lottery.yml`.

### A.4 — Run the 4D import

This one needs no extra setup — it downloads its own data automatically.

```
node import-historical-4d.js
```

You should see output like this (this may take 10-30 seconds, since it's
downloading and processing a ~2.6MB file):

```
Fetching historical 4D dataset: https://raw.githubusercontent.com/.../4d_prizes.csv
Downloaded 2.63 MB, parsing...
Parsed 126418 individual number rows.
Grouped into 5508 distinct draws.

Import complete. history.json now has 5508 4D draws (was 0 before this import).
  5508 draws processed from the source dataset.
  5343 draws have the full 23-number breakdown.
  Date range: 1986-05-31 to 2026-07-12
```

If `history.json` didn't exist in this folder before, it will now.

### A.5 — Get your TOTO CSV file into the `lottery-scraper` folder

1. Locate the TOTO CSV file on your computer (the one you originally
   uploaded — often called `ToTo.csv`)
2. Copy that file into the same `lottery-scraper` folder you're working in
   (the one containing `scraper.js`, right next to it)
3. Make sure it's named exactly `ToTo.csv` — if it has a different name,
   see the alternative command in step A.6 below

### A.6 — Run the TOTO import

If your file is named exactly `ToTo.csv` and sits in this same folder:

```
node import-historical-toto.js
```

If your file has a different name or is somewhere else, pass its full path
instead:

```
node import-historical-toto.js /path/to/your-file.csv
```

You should see output like this:

```
Reading TOTO dataset: /your/path/lottery-scraper/ToTo.csv
Read 1811 non-blank lines (including header).
Header has 33 columns.

Import complete. history.json now has 1810 TOTO draws (was 0 before this import).
  1810 rows imported.
  Date range: 2008-07-03 to 2026-02-02
```

### A.7 — Check the result

Open `history.json` in the same folder (any text editor works, or just
double-click it) and confirm it now has both `"fourD"` and `"toto"` arrays
with real-looking data. You can also run this quick check from the
terminal:

```
node -e "const h=require('./history.json'); console.log('4D:', h.fourD.length, '| TOTO:', h.toto.length)"
```

Expected output: `4D: 5508 | TOTO: 1810` (or higher, if you've since run
`scraper.js` too and it added even more).

### A.8 — Upload the result back to your GitHub repository

The app reads `history.json` from your GitHub repo (via the
`raw.githubusercontent.com` URL you set up earlier), not from your computer
directly — so this last step is what actually makes the import "count."

1. Go to your repository on GitHub, navigate into the `lottery-scraper`
   folder
2. If `history.json` already exists there, click on it, then click the
   pencil (✏️) **Edit** icon
3. Delete the existing content and paste in the entire content of your
   local `history.json` file (open it in a text editor, select all, copy)
4. Alternatively, if it doesn't exist there yet: click **Add file** →
   **Upload files**, and drag your local `history.json` in
5. Scroll down and click **Commit changes**

Once committed, your `raw.githubusercontent.com` URL will immediately serve
the updated file, and the app will pick it up automatically the next time
it fetches live data (or immediately, if you reload the app and it does its
usual on-load fetch).

**Important**: if `scraper.js`'s scheduled GitHub Action runs again *after*
you've done this manual upload but *before* you've pulled the latest version
locally, there's a small chance of it overwriting your import with older
data, or vice-versa on your next manual step. To avoid any confusion, it's
simplest to do these imports, then immediately trigger one manual run of
your existing "Refresh Lottery History" Action afterward (**Actions** tab →
**Run workflow**) — that run will merge in any newer live data on top of
what you just imported, and commit the combined result cleanly.

---

## Path B: Via GitHub Actions (browser-only, no local install)

This works well for the 4D import (which needs no local file). For the TOTO
import, you'd first need your CSV file to already be sitting in your GitHub
repo (upload it there via **Add file → Upload files**, e.g. to
`lottery-scraper/ToTo.csv`), then this same approach will find it.

1. In your repository, click **Add file** → **Create new file**
2. Name it exactly: `.github/workflows/one-time-import.yml`
3. Paste in the following:

```yaml
name: One-Time Historical Import

on:
  workflow_dispatch: {}

concurrency:
  group: refresh-lottery
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  import:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '24'
      - name: Run 4D import
        working-directory: lottery-scraper
        run: node import-historical-4d.js
      - name: Run TOTO import (only works if ToTo.csv is already in this folder)
        working-directory: lottery-scraper
        run: |
          if [ -f ToTo.csv ]; then
            node import-historical-toto.js
          else
            echo "ToTo.csv not found in lottery-scraper/ - skipping TOTO import. Upload your CSV there first, then re-run this workflow."
          fi
      - name: Commit results
        run: |
          git config user.name "lottery-refresh-bot"
          git config user.email "actions@users.noreply.github.com"
          git add -f lottery-scraper/history.json
          git diff --cached --quiet && echo "No change" || git commit -m "One-time historical import"
          git push
```

4. Commit this new file (**Commit changes**)
5. Go to the **Actions** tab → click **"One-Time Historical Import"** in the
   left sidebar → **Run workflow** → **Run workflow** (green button)
6. Wait about 30-60 seconds, then click into the run to see its log and
   confirm both imports succeeded (or that the TOTO one told you to upload
   your CSV first, if you hadn't yet)
7. Once you see it commit successfully, you can delete this workflow file
   afterward if you like (it's only meant to be used once or occasionally) —
   or just leave it there; it only ever runs when you manually click
   "Run workflow," so it won't interfere with anything.

---

## Troubleshooting

**"node: command not found"** — Node.js isn't installed, or your terminal
needs to be restarted after installing it. Revisit step A.1.

**"CSV file not found at .../ToTo.csv"** — the TOTO import couldn't find
your file. Double-check it's actually named `ToTo.csv` and sitting in the
exact same folder as `import-historical-toto.js`, or pass the full correct
path as shown in step A.6.

**Import runs but numbers look wrong** — open your source CSV in a
spreadsheet program first and spot-check a few rows against the column
layout described in `README.md`'s "Deep historical import" section (Draw,
Date, then 6 winning numbers, then Additional Number) — if your file has a
different column order, the import script would need adjusting to match.

**The app still isn't showing the new data after uploading `history.json`**
— double-check `LOTTERY_JSON_URL` in your deployed `engine-predictions.js`
points at the exact right raw URL, and that you actually redeployed that
file after setting it (see `SETUP_4D_TOTO_LIVE_DATA.md` if you need to
revisit that step).

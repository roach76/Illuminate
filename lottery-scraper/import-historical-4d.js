#!/usr/bin/env node
/**
 * lottery-scraper/import-historical-4d.js
 * ---------------------------------------------------------------------------
 * One-time (or occasionally re-run) importer that pulls the FULL historical 4D
 * dataset from a community-compiled GitHub repository and merges it into
 * history.json - a massive upgrade over the ~35-draw current-year backfill
 * scraper.js gets from check4d.co (this covers every 4D draw from 31 May 1986
 * through whenever the source repo was last updated - confirmed to reach at
 * least July 2026 as of when this was written).
 *
 * SOURCE: https://github.com/foooooooooooooooooooooooooootw/Singapore-Pools-Dataset
 * This is a third-party compiled dataset, not scraped by this script from
 * Singapore Pools directly - see the "Why not scrape singaporepools.com.sg"
 * note in README.md for why this project does not do that.
 *
 * WHAT THIS DOES NOT COVER:
 *   - TOTO: the source dataset's TOTO file has no usable dates (every row is
 *     literally "0001/01/01" - a confirmed data-entry error acknowledged in
 *     the source repo's own README), so it cannot be merged into this app's
 *     date-keyed history structure at all. TOTO continues to rely solely on
 *     scraper.js's slower, real-dated accumulation.
 *   - The gap between the source dataset's last entry and today: run
 *     scraper.js (as already scheduled) to keep filling that in going forward.
 *
 * USAGE (run once, or re-run occasionally to pick up newer entries the source
 * repo has added since your last import - it's safe to re-run, existing
 * entries are only replaced if the new data is fuller, exactly like
 * scraper.js's own merge behaviour):
 *   cd lottery-scraper
 *   node import-historical-4d.js
 *
 * This is a SEPARATE, manually-run script - it is NOT wired into the
 * scheduled refresh-lottery.yml Action, since re-downloading and re-parsing a
 * multi-megabyte file on every scheduled run (3x/day, forever) would be
 * wasteful for data that only changes rarely (whenever the source repo
 * itself is updated). If you'd like this to run periodically (e.g. monthly)
 * rather than only manually, see the bottom of this file for how to add a
 * second, separate low-frequency GitHub Action for it.
 */

const fs = require('fs');
const path = require('path');
const HISTORY_PATH = path.join(__dirname, 'history.json');
const CSV_URL = 'https://raw.githubusercontent.com/foooooooooooooooooooooooooootw/Singapore-Pools-Dataset/main/4d_prizes.csv';

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return { fourD: [], toto: [] };
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    return { fourD: data.fourD || [], toto: data.toto || [] };
  } catch (e) {
    console.warn('Could not parse existing history.json, starting fresh:', e.message);
    return { fourD: [], toto: [] };
  }
}

// Same merge behaviour as scraper.js: prefer whichever record has more numbers for a given date,
// so re-running this import (or running it after scraper.js has already captured today's live full
// breakdown) never downgrades an entry.
function mergeEntry(list, entry) {
  const idx = list.findIndex(e => e.isoDate === entry.isoDate);
  if (idx === -1) { list.push(entry); return; }
  const existing = list[idx];
  // BUG FIX: a raw length comparison alone treated a 25-number entry (23 real numbers plus a
  // duplicate) as "fuller" than a clean 23-number entry, when it's actually WORSE (it has a data
  // anomaly, not extra real information). `full` (exactly 23, all distinct) is now compared first;
  // only when neither entry is `full` does raw length break the tie, as a reasonable fallback.
  const existingIsBetter = existing.full && !entry.full
    ? true
    : (!existing.full && entry.full)
      ? false
      : (existing.winning || []).length >= (entry.winning || []).length;
  if (!existingIsBetter) list[idx] = entry;
}

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// Computes the day-of-week directly from the date's own components rather than trusting any
// separately-supplied weekday label, and avoids JS Date's local-timezone quirks (see scraper.js's
// formatIsoDate for the same reasoning) by using Date.UTC purely for the day-of-week calculation.
function formatIsoDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dayOfWeek = DAY_ABBR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dayOfWeek} ${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

// Parses the source CSV's simple 3-column format (draw_number,number,date) - handles the
// CRLF/LF line endings and quoting the raw file was confirmed to use, without needing a full CSV
// parsing library for a format this simple.
function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  // Skip the header row (line 0: "draw_number,number,date")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const [drawNumber, number, dateStr] = parts;
    rows.push({ drawNumber, number: number.trim(), dateStr: dateStr.trim() });
  }
  return rows;
}

async function main() {
  console.log('Fetching historical 4D dataset:', CSV_URL);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const csvText = await res.text();
  console.log(`Downloaded ${(csvText.length / 1024 / 1024).toFixed(2)} MB, parsing...`);

  const rows = parseCsv(csvText);
  console.log(`Parsed ${rows.length} individual number rows.`);

  // Group rows by (drawNumber, dateStr) into one entry per draw.
  const drawMap = new Map(); // key: "drawNumber|dateStr" -> { dateStr, drawNumber, numbers: [] }
  for (const row of rows) {
    const key = `${row.drawNumber}|${row.dateStr}`;
    if (!drawMap.has(key)) drawMap.set(key, { drawNumber: row.drawNumber, dateStr: row.dateStr, numbers: [] });
    drawMap.get(key).numbers.push(row.number);
  }
  console.log(`Grouped into ${drawMap.size} distinct draws.`);

  const history = loadHistory();
  const beforeCount = history.fourD.length;
  let importedCount = 0, skippedBadDateCount = 0;

  for (const { drawNumber, dateStr, numbers } of drawMap.values()) {
    // Source format is YYYY/MM/DD - convert to this app's YYYY-MM-DD isoDate convention.
    const m = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!m) { skippedBadDateCount++; continue; }
    const isoDate = `${m[1]}-${m[2]}-${m[3]}`;
    // HONESTY CHECK: don't assume every draw has all 23 numbers - reflect the actual count. The
    // source data has some draws with FEWER than 23 entries (confirmed by spot-checking against the
    // raw file - a real, systematic gap concentrated in the earliest years, 1986-1991, where 152 of
    // 165 total partial draws are missing exactly 2 numbers each). It ALSO, less commonly, has draws
    // with MORE than 23 entries due to a literal duplicate row in the source (confirmed directly: draw
    // 425 on 1990-06-23 has the number 0104 listed twice in the raw CSV). A draw is only marked `full`
    // if it has EXACTLY 23 numbers AND all 23 are distinct - either too few or a duplicate correctly
    // fails this and gets flagged, rather than an over-count being silently treated as "complete".
    const isExactly23Distinct = numbers.length === 23 && new Set(numbers).size === 23;
    const entry = { isoDate, date: formatIsoDate(isoDate), drawNo: drawNumber, winning: numbers, full: isExactly23Distinct };
    mergeEntry(history.fourD, entry);
    importedCount++;
  }

  history.fourD.sort((a, b) => b.isoDate.localeCompare(a.isoDate));

  const output = {
    lastUpdated: new Date().toISOString(),
    source: 'https://github.com/foooooooooooooooooooooooooootw/Singapore-Pools-Dataset (historical import) + https://check4d.co/sgpools/ (ongoing scraper.js updates)',
    fourD: history.fourD,
    toto: history.toto
  };
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(output, null, 2));

  console.log('');
  console.log(`Import complete. history.json now has ${history.fourD.length} 4D draws (was ${beforeCount} before this import).`);
  console.log(`  ${importedCount} draws processed from the source dataset.`);
  console.log(`  ${history.fourD.filter(e => e.full).length} draws have the full 23-number breakdown.`);
  if (skippedBadDateCount > 0) console.log(`  ${skippedBadDateCount} rows skipped due to an unparseable date.`);
  const dates = history.fourD.map(e => e.isoDate).sort();
  console.log(`  Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
}

main().catch(err => {
  console.error('Import failed:', err.message);
  process.exit(1);
});

/*
OPTIONAL: to run this periodically (e.g. monthly) instead of only manually, create a second
workflow file at .github/workflows/import-historical-4d.yml with contents like:

  name: Import Historical 4D Dataset
  on:
    schedule:
      - cron: '0 3 1 * *'   # 3am UTC on the 1st of each month
    workflow_dispatch: {}
  concurrency:
    group: refresh-lottery   # SAME group name as refresh-lottery.yml, so these two never race
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
        - working-directory: lottery-scraper
          run: node import-historical-4d.js
        - run: |
            git config user.name "lottery-refresh-bot"
            git config user.email "actions@users.noreply.github.com"
            git add -f lottery-scraper/history.json
            git diff --cached --quiet -- lottery-scraper/history.json || git commit -m "Monthly historical 4D import"
            git push
*/

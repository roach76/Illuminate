#!/usr/bin/env node
/**
 * lottery-scraper/scraper.js
 * ---------------------------------------------------------------------------
 * Builds and maintains a GROWING repository of Singapore Pools 4D/TOTO draw
 * results in history.json, rather than overwriting a single "latest draw"
 * snapshot each run. This is what makes a real metaphysics-vs-draw-date
 * correlation check possible (see engine-predictions.js's
 * computeMetaphysicsCorrelation()) - one draw at a time gives no historical
 * base to correlate against.
 *
 * WHAT EACH RUN DOES:
 *   1. Loads existing history.json if present (empty history on first run).
 *   2. BACKFILL (4D only, one-time-ish): fetches check4d.co's past-results
 *      table (~30-35 draws for the year) and merges in any dates not already
 *      present. This table only exposes 1st/2nd/3rd prizes (not the full
 *      Special/Consolation 23-number breakdown) - flagged per-entry as
 *      `full: false` so downstream code knows the limitation.
 *   3. LATEST (4D + TOTO, every run): fetches the live page for the current
 *      draw, which DOES have the full breakdown, and inserts/updates that
 *      date's entry as `full: true`.
 *   4. Writes the merged, deduplicated, newest-first history back out.
 *
 * HONESTY NOTES (same as before, still true):
 *   - Built from a text-extraction of check4d.co's pages, not raw HTML/DOM
 *     inspection - patterns are regex-based against structural text rather
 *     than CSS selectors I could not verify.
 *   - Not run against the live site from this development environment
 *     (no network access to check4d.co here) - treat the first Action run as
 *     the real test, and spot-check history.json afterward.
 *   - TOTO has no confirmed past-results table source, so its history only
 *     grows one draw per run (whenever a new draw happens) rather than being
 *     backfilled - it'll take a couple of months of scheduled runs to
 *     accumulate a meaningful TOTO sample. 4D backfills immediately.
 *
 * OUTPUT FORMAT (history.json):
 * {
 *   "lastUpdated": "2026-09-04T12:00:00.000Z",
 *   "source": "https://check4d.co/sgpools/",
 *   "fourD": [ { "isoDate", "date", "drawNo", "winning": [...3 or 23 numbers], "full": true|false }, ... newest first ],
 *   "toto":  [ { "isoDate", "date", "drawNo", "winning": [6 numbers], "additional": N }, ... newest first ]
 * }
 */

const fs = require('fs');
const path = require('path');
const HISTORY_PATH = path.join(__dirname, 'history.json');
const LIVE_URL = 'https://check4d.co/sgpools/';
const PAST_4D_URL = 'https://check4d.co/sgpools/past/';
// NO CAP: the user explicitly wants the repository to keep growing without ever dropping data, with
// a floor target of 1000+ draws per game as the history accumulates over time. sortAndTrim below only
// sorts (newest first) and deduplicates by date - it does not truncate.
const MIN_TARGET_DRAWS = 1000; // informational target, not enforced/truncated - see README for the honest timeline to reach this

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatIsoDate(isoDate, dayAbbr) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${dayAbbr} ${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IlluminateLotterySync/2.0; +https://github.com/)' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function mergeEntry(list, entry) {
  const idx = list.findIndex(e => e.isoDate === entry.isoDate);
  if (idx === -1) { list.push(entry); return; }
  // Prefer the fuller record if we already have one for this date (e.g. backfill giving 1st/2nd/3rd
  // only, then a later live-page fetch supplying the full 23-number breakdown for the same date).
  const existing = list[idx];
  const existingIsFuller = (existing.winning || []).length >= (entry.winning || []).length;
  if (!existingIsFuller) list[idx] = entry;
}

function sortAndTrim(list) {
  // "Trim" is a misnomer kept for minimal diff - this NEVER drops entries, per the requirement that
  // the repository keeps growing without losing any data. It only sorts (newest first) and relies on
  // mergeEntry's isoDate matching to prevent duplicate dates from ever being added in the first place.
  list.sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  return list;
}

// ---- 4D past-results table backfill ----
function parsePast4DTable(text) {
  // Matches rows like: "2026-09-02 Wed 5530/26 1st 4125 · 2nd 8603 · 3rd 3798"
  const rowRegex = /(\d{4}-\d{2}-\d{2})\s+([A-Za-z]{3})\s+(\d+\/\d+)\s+1st\s+(\d{4})[^0-9]+2nd\s+(\d{4})[^0-9]+3rd\s+(\d{4})/g;
  const entries = [];
  let m;
  while ((m = rowRegex.exec(text)) !== null) {
    const [, isoDate, dayAbbr, drawNo, p1, p2, p3] = m;
    entries.push({ isoDate, date: formatIsoDate(isoDate, dayAbbr), drawNo, winning: [p1, p2, p3], full: false });
  }
  return entries;
}

// ---- Live page: full breakdown for the current draw ----
function parseFourDLive(text) {
  const drawMatch = text.match(/Draw\s+(\d+\/\d+)\s*([A-Za-z]{3})\s+(\d{4}-\d{2}-\d{2})/);
  if (!drawMatch) throw new Error('Could not locate 4D draw header');
  const [, drawNo, dayAbbr, isoDate] = drawMatch;
  const afterDraw = text.slice(drawMatch.index);

  const onest = afterDraw.match(/1st[^\d]*(\d{4})/);
  const twond = afterDraw.match(/2nd[^\d]*(\d{4})/);
  const threerd = afterDraw.match(/3rd[^\d]*(\d{4})/);
  if (!onest || !twond || !threerd) throw new Error('Could not locate 4D 1st/2nd/3rd prize numbers');

  const specialBlockMatch = afterDraw.match(/Special[^0-9]*((?:\d{4}\D+){1,10})/);
  const consolationBlockMatch = afterDraw.match(/Consolation[^0-9]*((?:\d{4}\D+){1,10})/);
  const extractNums = (block) => (block ? block[1].match(/\d{4}/g) || [] : []);
  const special = extractNums(specialBlockMatch);
  const consolation = extractNums(consolationBlockMatch);

  const winning = [onest[1], twond[1], threerd[1], ...special, ...consolation];
  return { isoDate, date: formatIsoDate(isoDate, dayAbbr), drawNo, winning, full: winning.length >= 23 };
}

function parseTotoLive(text) {
  const totoSectionIdx = text.search(/Toto/i);
  if (totoSectionIdx === -1) throw new Error('Could not locate TOTO section');
  const totoText = text.slice(totoSectionIdx);
  const drawMatch = totoText.match(/Draw\s+(\d+)\s*([A-Za-z]{3})\s+(\d{4}-\d{2}-\d{2})/);
  if (!drawMatch) throw new Error('Could not locate TOTO draw header');
  const [, drawNo, dayAbbr, isoDate] = drawMatch;
  const afterDraw = totoText.slice(drawMatch.index);

  const numsMatch = afterDraw.match(/((?:\d{1,2}\D{0,3}){6})\+\s*(\d{1,2})/);
  if (!numsMatch) throw new Error('Could not locate TOTO winning numbers');
  const winning = (numsMatch[1].match(/\d{1,2}/g) || []).map(Number).slice(0, 6);
  const additional = Number(numsMatch[2]);
  if (winning.length !== 6 || Number.isNaN(additional)) throw new Error('TOTO number parsing produced an unexpected shape');

  return { isoDate, date: formatIsoDate(isoDate, dayAbbr), drawNo, winning, additional };
}

async function main() {
  const history = loadHistory();

  console.log('Fetching 4D past-results table:', PAST_4D_URL);
  try {
    const pastHtml = await fetchPage(PAST_4D_URL);
    const pastEntries = parsePast4DTable(htmlToText(pastHtml));
    console.log(`Backfill found ${pastEntries.length} 4D entries in the past-results table (current year).`);
    pastEntries.forEach(e => mergeEntry(history.fourD, e));
  } catch (e) {
    console.warn('4D backfill failed (non-fatal, continuing with live-page fetch only):', e.message);
  }

  // BEST-EFFORT prior-year backfill: reaching the requested 1000-draw floor from a single year's
  // ~35 entries would take years of scheduled runs. check4d.co's past-results page URL did not
  // confirm a documented year-archive pattern during development (no multi-year link was found), so
  // these are speculative guesses at a few plausible URL shapes, tried defensively - each one that
  // 404s or doesn't parse is skipped silently (logged, not fatal) rather than breaking the run. If
  // none of these work for your setup, the repository still reaches 1000+ over time through organic
  // accumulation, since nothing already stored is ever dropped (see sortAndTrim above).
  const currentYear = new Date().getFullYear();
  for (let yearsBack = 1; yearsBack <= 8; yearsBack++) {
    const year = currentYear - yearsBack;
    const candidateUrls = [
      `https://check4d.co/sgpools/past/${year}/`,
      `https://check4d.co/sgpools/past/?year=${year}`
    ];
    let succeededThisYear = false;
    for (const url of candidateUrls) {
      try {
        const html = await fetchPage(url);
        const entries = parsePast4DTable(htmlToText(html));
        if (entries.length > 0) {
          console.log(`Prior-year backfill (${year}) via ${url}: found ${entries.length} entries.`);
          entries.forEach(e => mergeEntry(history.fourD, e));
          succeededThisYear = true;
          break;
        }
      } catch (e) {
        // Expected to fail if this URL pattern isn't real for this site - not logged as a warning
        // per-attempt to avoid noisy logs; see the summary log after this loop instead.
      }
    }
    if (!succeededThisYear) {
      console.log(`Prior-year backfill (${year}): no working URL pattern found - skipping (this is expected if check4d.co has no multi-year archive; see README).`);
      break; // stop trying earlier years once one fails, since they're unlikely to work if this one didn't
    }
  }


  console.log('Fetching live page:', LIVE_URL);
  const liveText = htmlToText(await fetchPage(LIVE_URL));

  try {
    const fourDLive = parseFourDLive(liveText);
    mergeEntry(history.fourD, fourDLive);
  } catch (e) {
    console.warn('Live 4D parse failed (non-fatal if backfill already succeeded):', e.message);
  }

  try {
    const totoLive = parseTotoLive(liveText);
    mergeEntry(history.toto, totoLive);
  } catch (e) {
    console.warn('Live TOTO parse failed:', e.message);
  }

  history.fourD = sortAndTrim(history.fourD);
  history.toto = sortAndTrim(history.toto);

  if (history.fourD.length === 0 && history.toto.length === 0) {
    throw new Error('Sanity check failed: ended up with zero entries for both games - refusing to write an empty history.json');
  }

  const output = {
    lastUpdated: new Date().toISOString(),
    source: LIVE_URL,
    fourD: history.fourD,
    toto: history.toto
  };
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${HISTORY_PATH}: ${history.fourD.length} 4D draws (${history.fourD.filter(e=>e.full).length} full), ${history.toto.length} TOTO draws.`);
  if (history.fourD.length < MIN_TARGET_DRAWS) console.log(`4D repository is at ${history.fourD.length}/${MIN_TARGET_DRAWS} draws toward the target - will keep growing on every future run, nothing is ever dropped.`);
  if (history.toto.length < MIN_TARGET_DRAWS) console.log(`TOTO repository is at ${history.toto.length}/${MIN_TARGET_DRAWS} draws toward the target - will keep growing on every future run, nothing is ever dropped.`);
}

main().catch(err => {
  console.error('Scrape failed:', err.message);
  process.exit(1);
});

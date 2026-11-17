const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies "why are the results for consolation numbers for 4D not showing?". Root cause: check4d.co renamed the 4D "Special" block to
// "Starter" (now followed by a Chinese name), the scraper only knew "Special", so no starters were found and the 10 consolation numbers
// were stored in the starter slots - the app showed them as Starters with nothing under Consolation. Separately, the per-date pages
// use a different header than the live page, so the scraper's upgrade of partial draws had never worked. Tests below use text shaped
// exactly like the real pages (captured 2026-11-17).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const scraper = require(path.join(__PROJECT_ROOT__, 'lottery-scraper', 'scraper.js'));

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const STARTERS = ['0696', '1152', '1236', '2733', '5324', '6912', '7265', '8708', '8711', '8865'];
const CONSOL = ['0595', '2103', '2351', '2636', '3643', '4462', '4729', '6159', '6633', '6966'];
const live = (starterLabel) => `Singapore Pools 4D Live Draw 5562/26 Sun 2026-11-15 Draw 5562/26 Sun 2026-11-15 1st 首奖 7596 2nd 二奖 5126 3rd 三奖 8424 ${starterLabel} ${STARTERS.join(' ')} Consolation 安慰奖 ${CONSOL.join(' ')} Singapore Pools Toto 新加坡多多 Live Draw 4235 Mon 2026-11-16 02 22 24 31 36 43 + 41`;

// ---- 1. the live page, current labels ----
const cur = scraper.parseFourDLive(live('Starter 入围奖'));
check(cur.full === true && cur.winning.length === 23, 'current "Starter 入围奖" page parses to a full 23-number draw');
check(JSON.stringify(cur.winning.slice(0, 3)) === '["7596","5126","8424"]', 'top three are 1st / 2nd / 3rd');
check(JSON.stringify(cur.winning.slice(3, 13)) === JSON.stringify(STARTERS), 'positions 4-13 are the 10 STARTER numbers');
check(JSON.stringify(cur.winning.slice(13, 23)) === JSON.stringify(CONSOL), 'positions 14-23 are the 10 CONSOLATION numbers (the reported bug put these in the starter slots)');
check(cur.drawNo === '5562/26' && cur.isoDate === '2026-11-15' && cur.date === 'Sun 15 Nov 2026', 'draw number and date are read correctly');
// the old label still works
const old = scraper.parseFourDLive(live('Special'));
check(old.full && JSON.stringify(old.winning.slice(3, 13)) === JSON.stringify(STARTERS), 'the old "Special" label is still accepted');
// safety: a missing / short block never shifts prize positions
const noConsol = scraper.parseFourDLive(`Draw 5562/26 Sun 2026-11-15 1st 首奖 7596 2nd 二奖 5126 3rd 三奖 8424 Starter 入围奖 ${STARTERS.join(' ')} Singapore Pools Toto`);
check(noConsol.full === false && noConsol.winning.length === 3, 'a page with no consolation block keeps only the verified top three (full:false), never a shifted half-parse');
const shortStarters = scraper.parseFourDLive(`Draw 5562/26 Sun 2026-11-15 1st 首奖 7596 2nd 二奖 5126 3rd 三奖 8424 Starter 入围奖 ${STARTERS.slice(0, 6).join(' ')} Consolation 安慰奖 ${CONSOL.join(' ')} Toto`);
check(shortStarters.full === false && shortStarters.winning.length === 3, 'a short starter block is not stored as a full draw either');
const labelRenamedAgain = scraper.parseFourDLive(`Draw 5562/26 Sun 2026-11-15 1st 首奖 7596 2nd 二奖 5126 3rd 三奖 8424 Mystery 神秘奖 ${STARTERS.join(' ')} Consolation 安慰奖 ${CONSOL.join(' ')} Toto`);
check(labelRenamedAgain.full === false && labelRenamedAgain.winning.length === 3, 'if the site renames the block again, the draw is NOT stored with consolation numbers in the starter slots');

// ---- 2. per-date pages (different header; date taken from the URL and cross-checked) ----
const past = `Singapore 4D Result Saturday 14 Nov 2026 (14/11/26) Check 4D Singapore Pools Result — 14 Nov 2026 Singapore 4D result for Saturday, 14 November 2026 (14/11/2026) — draw 5561/26. 1st prize 6578. Singapore Pools 4D 1st 首奖 6578 2nd 二奖 9653 3rd 三奖 1399 Starter 入围奖 1571 2035 2193 4577 5143 5515 7429 7797 8945 9001 Consolation 安慰奖 3575 4999 5678 6119 6357 7931 8871 9555 9582 9953 ← Thu 12 Nov 2026`;
const pd = scraper.parseFourDLive(past, '2026-11-14');
check(pd.full && pd.winning.length === 23 && pd.drawNo === '5561/26' && pd.isoDate === '2026-11-14' && pd.date === 'Sat 14 Nov 2026', 'a per-date page parses to a full draw using the date from its URL');
check(pd.winning[3] === '1571' && pd.winning[12] === '9001' && pd.winning[13] === '3575' && pd.winning[22] === '9953', 'per-date page: starters then consolation in the right slots');
let threw = null; try { scraper.parseFourDLive(past, '2026-11-13'); } catch (e) { threw = e.message; }
check(/does not show the requested date/.test(threw || ''), 'a page that does not show the requested date is rejected, never merged under the wrong date');
threw = null; try { scraper.parseFourDLive(past); } catch (e) { threw = e.message; }
check(/Could not locate 4D draw header/.test(threw || ''), 'without a date hint the per-date header is not guessed');

// ---- 3. merging: a full draw replaces a partial or mis-shaped one, never the reverse ----
const list = [{ isoDate: '2026-11-15', winning: ['7596', '5126', '8424'], full: false }];
scraper.mergeEntry(list, cur);
check(list.length === 1 && list[0].winning.length === 23 && list[0].full, 'a full draw replaces the partial entry for the same date');
scraper.mergeEntry(list, { ...cur, winning: cur.winning.slice(0, 3), full: false });
check(list[0].winning.length === 23, 'a partial draw never overwrites a full one');

// ---- 4. the shipped data: every draw is full-shaped, newest draws have distinct starters and consolation ----
const hist = JSON.parse(fs.readFileSync(path.join(__PROJECT_ROOT__, 'lottery-scraper', 'history.json'), 'utf8'));
const recent = hist.fourD.filter(e => e.isoDate >= '2026-07-01');
check(recent.length > 40 && recent.every(e => e.full && e.winning.length === 23), `every 4D draw since July 2026 has the full 23-number breakdown (${recent.length} draws)`);
check(hist.fourD.every(e => e.winning.length >= 3 && (e.full ? e.winning.length >= 23 : e.winning.length === 3)), 'no history entry is in the mis-shaped 13-number state (3 + one block)');
const top = hist.fourD[0];
check(top.winning.slice(3, 13).every(n => !top.winning.slice(13, 23).includes(n)), 'the newest draw\'s starters and consolation numbers are different sets');

// ---- 5. the app: a full draw shows Starter AND Consolation rows, English and Chinese ----
const dom = new JSDOM(fs.readFileSync(path.join(__PROJECT_ROOT__, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
const storage = {};
const sandbox = { console, localStorage: { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } }, navigator: { language: 'en-US' }, document: dom.window.document, window: dom.window, setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp, URL: dom.window.URL, html2pdf: () => ({}), alert() {}, confirm: () => true, fetch: undefined, performance };
sandbox.global = sandbox; sandbox.self = sandbox; vm.createContext(sandbox);
['engine-core.js', 'engine-metaphysics.js', 'engine-predictions.js', 'app.js', 'auth.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__PROJECT_ROOT__, f), 'utf8'), sandbox, { filename: f }));
vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage(); state.users['t@t.com'] = { email: 't@t.com', password: 'x', profile: { englishFirstName: 'A', englishLastName: 'B', birthdate: '1980-01-01', birthtime: '12:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 } }; state.active = 't@t.com'; liveLotteryHistory = ${JSON.stringify({ fourD: [cur], toto: [] })};`, sandbox);
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const en = strip(vm.runInContext(`renderSingleDrawDetail('fourD', '2026-11-15', false)`, sandbox));
check(/Starter:\s*0696, 1152/.test(en) && /Consolation:\s*0595, 2103/.test(en) && !/not available for this draw/.test(en), 'English: Starter row shows the starters and Consolation row shows the consolation numbers');
vm.runInContext(`lang = 'zh'`, sandbox);
const zh = strip(vm.runInContext(`renderSingleDrawDetail('fourD', '2026-11-15', true)`, sandbox));
check(/入围奖:\s*0696/.test(zh) && /安慰奖:\s*0595/.test(zh) && !/此期无此数据/.test(zh), 'Chinese: rows are labelled 入围奖 (Starter) and 安慰奖 (Consolation), the official names');
const src = fs.readFileSync(path.join(__PROJECT_ROOT__, 'engine-predictions.js'), 'utf8');
check(!/bt\('Starter','安慰'\)/.test(src) && !/bt\('Consolation','特别'\)/.test(src) && !/'命中特别奖' : 'Struck Consolation/.test(src), 'the old mislabels (Starter = 安慰, Consolation = 特别) are gone');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

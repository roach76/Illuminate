const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies two Phase 0 fixes from this round's large issue list:
// 1. Favicon 404 - index.html now declares a <link rel="icon">, so the browser stops requesting the
//    non-existent favicon.ico.
// 2. Flying Star direction-label overrun (reported AGAIN after an earlier CSS-only fix) - grid cells
//    in both the property calculator and the temporal overlay now use the short direction key itself
//    (N/NE/E/etc, "C" for center) for English, instead of the full word ("Northeast") that didn't fit
//    a ~100px cell - while the narrative sentence below each grid still spells out the full word.
const fs = require('fs');
const appSrc = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
const htmlSrc = fs.readFileSync((__PROJECT_ROOT__ + '/index.html'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// --- Favicon ---
check(/<link\s+rel=["']icon["']/.test(htmlSrc), 'BUG FIX VERIFIED: index.html now declares a <link rel="icon"> (was previously entirely absent, causing the favicon.ico 404)');
check(!/favicon\.ico/.test(htmlSrc), 'the icon is inlined (data URI), not a reference to a favicon.ico file that would itself need to exist');

// --- Flying Star grid-cell label abbreviation ---
const rfsrStart = appSrc.indexOf('function renderFlyingStarResult(constructionYear, facingDir');
const rfsrEnd = appSrc.indexOf('\nfunction ', rfsrStart + 10);
const rfsrBody = appSrc.slice(rfsrStart, rfsrEnd);
check(rfsrBody.includes("bt(dir, FLYING_STAR_DIR_LABEL_ZH[dir])"), 'BUG FIX VERIFIED: property-calculator grid cells use the short direction key (dir) for English, not the full word from FLYING_STAR_DIR_LABEL_EN');
check(rfsrBody.includes("bt('C','中宫')"), 'property-calculator grid center cell uses the short "C" for English, not "Center"');
check(/Facing \$\{FLYING_STAR_DIR_LABEL_EN\[facingDir\]\}, Sitting \$\{FLYING_STAR_DIR_LABEL_EN/.test(rfsrBody), 'the narrative sentence below the grid still spells out the FULL English word (only the cramped grid cells were abbreviated, not the prose)');

const rfstoStart = appSrc.indexOf('function renderFlyingStarTemporalOverlay(');
const rfstoEnd = appSrc.indexOf('\n// ', rfstoStart + 10);
const rfstoBody = appSrc.slice(rfstoStart, rfstoEnd);
check(rfstoBody.includes("bt(dir, FLYING_STAR_DIR_LABEL_ZH[dir])"), 'BUG FIX VERIFIED: temporal-overlay grid cells (Annual/Monthly/Daily, all 3 use the same buildGrid) also use the short direction key for English');
check(rfstoBody.includes("bt('C','中宫')"), 'temporal-overlay grid center cell also uses the short "C"');

// --- Behavioural check: render an actual chart and confirm no cell contains a long English word ---
const vm = require('vm');
const path = require('path');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
const fakeStorage = {};
const sandbox = {
  console, Math, Date, JSON, Array, Object, String, Number,
  localStorage: { getItem: (k) => (k in fakeStorage ? fakeStorage[k] : null), setItem: (k, v) => { fakeStorage[k] = String(v); }, removeItem: (k) => { delete fakeStorage[k]; } },
};
sandbox.global = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
sandbox.lang = 'en';
vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8'), sandbox, { filename: 'engine-metaphysics.js' });
// Extract just the two render functions + their direct dependencies (bt, FLYING_STAR_DIR_LABEL_*, FLYING_STAR_NATURE, flyingStarNatureLine) by eval'ing them directly - avoids pulling in the entire app.js (which references DOM/localStorage at load time).
vm.runInContext(`
  function bt(en, zh) { return (lang === 'zh' && zh) ? zh : en; }
  ${appSrc.slice(appSrc.indexOf('const DIR_LABEL_ZH'), appSrc.indexOf('function ratingColor'))}
`, sandbox);
vm.runInContext(rfsrBody.replace('function renderFlyingStarResult(constructionYear, facingDir, p)', 'function renderFlyingStarResult(constructionYear, facingDir, p)'), sandbox);
const html = vm.runInContext(`renderFlyingStarResult(2015, 'N')`, sandbox);
const longWords = ['Northeast', 'Southeast', 'Southwest', 'Northwest'];
// The narrative sentence legitimately contains these full words - only check the grid CELL divs (each
// cell's label div is the first div inside its bordered cell, immediately followed by the mountain/facing numbers row).
const cellLabelDivs = html.match(/<div style="font-size:10px; color:var\(--muted\); margin-bottom:4px[^>]*>([^<]*)</g) || [];
check(cellLabelDivs.length === 9, `found all 9 grid cell label divs in a real rendered chart (got ${cellLabelDivs.length})`);
check(cellLabelDivs.every(d => !longWords.some(w => d.includes(w))), 'BUG FIX VERIFIED (behavioural): none of the 9 rendered grid cell labels contain a long full-word direction name');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

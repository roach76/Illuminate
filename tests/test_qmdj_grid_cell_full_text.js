const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for item 2 ("Why is the QMDJ chart simplified. I remembered I asked to follow
// attached sample QMDJ Chart with the full deep reading?"). Root cause: qmdjCell's Deity/Star/Door
// lines were truncated via `.split(' ').slice(0,2).join(' ')`, which for a value like "Tian Peng (天蓬)"
// keeps only "Tian Peng" and SILENTLY DROPS the Chinese characters entirely - stripping the very
// characters that make this a Chinese-metaphysics chart, which is very likely what read as "simplified"
// next to the user's attached reference sample (which shows every cell's Chinese characters prominently,
// including one large central glyph per cell). Fix: Deity/Star/Door now render their full text
// (English + Chinese), and the Star's own second Chinese character is pulled out and shown large and
// centered, matching the reference sample's one-big-glyph-per-cell layout.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let passed = 0, failed = 0;
function check(cond, msg) { if (cond) passed++; else { failed++; console.log('FAIL: ' + msg); } }

const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
const storage = {};
const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
const sandbox = {
  console, localStorage, navigator: { language: 'en-US' },
  document: dom.window.document, window: dom.window,
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  URL: dom.window.URL, alert: () => {}, confirm: () => true,
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');

const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', chineseFirstName: '伟', chineseLastName: '黄', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
};
vm.runInContext(`
  state.users['test@test.com'] = ${JSON.stringify(testUser)};
  state.active = 'test@test.com';
`, sandbox);

vm.runInContext(`renderSystemChart(getProfileData(), 'i', null, false, null)`, sandbox);
// QMDJ (San Shi) lives in the 'timing' tab group, cached separately in chartTabRegistry - not part of
// renderSystemChart's own return value (which only carries the profile overview + the CORE tab's HTML).
const chartHTML = vm.runInContext(`chartTabRegistry['i']['timing']`, sandbox);

// Every one of the 8 outer palaces' Deity/Star/Door text should appear IN FULL somewhere in the chart
// HTML, Chinese characters included - not just the truncated English-only romanization.
const QMDJ_PALACE_REF_STRINGS = vm.runInContext(`JSON.stringify(Object.values(QMDJ_PALACE_REF))`, sandbox);
const palaceRefs = JSON.parse(QMDJ_PALACE_REF_STRINGS);
palaceRefs.forEach((ref, i) => {
  if (ref.door === '— (Center)') return; // palace 5 (center) has no Deity/Star/Door of its own
  check(chartHTML.includes(ref.deity), `Palace ref #${i}: full Deity text "${ref.deity}" (with Chinese) appears in the chart HTML, not truncated`);
  check(chartHTML.includes(ref.star), `Palace ref #${i}: full Star text "${ref.star}" (with Chinese) appears in the chart HTML, not truncated`);
  check(chartHTML.includes(ref.door), `Palace ref #${i}: full Door text "${ref.door}" (with Chinese) appears in the chart HTML, not truncated`);
});

// The large central Star glyph (the star's own 2nd Chinese character, e.g. 天蓬 -> 蓬) should be present
// as its own styled span for at least one real palace.
check(/font-size:20px;font-weight:800;color:#1565c0/.test(chartHTML), 'a large centered Star glyph span is present in the rendered chart (matches the reference sample\'s one-big-glyph-per-cell layout)');
check(chartHTML.includes('蓬') || chartHTML.includes('心') || chartHTML.includes('柱') || chartHTML.includes('英') || chartHTML.includes('任') || chartHTML.includes('冲') || chartHTML.includes('芮') || chartHTML.includes('禽'), 'at least one Star\'s own single Chinese glyph is present in the rendered chart');

// Regression guard: the old truncating pattern must be gone from the source entirely.
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
check(!/cell\.deity\.split\(' '\)\.slice\(0,\s*2\)/.test(appSrc), 'BUG FIX VERIFIED: the old Deity-truncating `.split(\' \').slice(0,2)` pattern is gone from app.js');
check(!/cell\.star\.split\(' '\)\.slice\(0,\s*2\)/.test(appSrc), 'BUG FIX VERIFIED: the old Star-truncating `.split(\' \').slice(0,2)` pattern is gone from app.js');
check(!/cell\.door\.split\(' '\)\.slice\(0,\s*2\)/.test(appSrc), 'BUG FIX VERIFIED: the old Door-truncating `.split(\' \').slice(0,2)` pattern is gone from app.js');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

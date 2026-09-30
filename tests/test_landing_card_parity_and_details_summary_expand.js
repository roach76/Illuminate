const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's 5-part request:
// 1) Personal Assets block on the landing summary card now sits below the Zi Wei Life Palace/Ba Zhai
//    Kua tiles (covered in test_personal_assets_on_landing_cards.js's updated placement check).
// 2) The standalone Home-dashboard Personal Assets card is removed (covered in
//    test_usability_round_7features.js's flipped Task 2 checks).
// 3) The chart-level Flying Star tile (in the Profile Overview card) no longer sits alone at half
//    width with its text wrapping into many lines - it now spans the full grid width.
// 4) The landing page's key-facts grid (generateSummaryCardHTML) now shows the SAME 13 tiles, in the
//    SAME order, as the chart-level Profile Overview card - not its own hand-picked 11-item subset.
// 5) The "Details Summary" card is expanded (open) by default on every one of the 4 tabs
//    (Core/Timing/Environment/More), for every profile type - not just the very first section overall.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static: the chart-level Flying Star tile now passes `true` (wide) to overviewTile ---
check(/overviewTile\(bt\(`Flying Star \(\$\{fsOv\.annual\.year\} Annual\)`, `飞星（\$\{fsOv\.annual\.year\}流年）`\), flyingStarNatureLine\(fsOv\.annual\.chart\.center\), true\)/.test(appSrc), 'the chart-level Profile Overview\'s Flying Star tile now passes wide=true to overviewTile, so it spans both grid columns instead of sitting alone at half width');
check(/const overviewTile = \(label, value, wide\) =>/.test(appSrc), 'overviewTile itself now accepts an optional wide parameter');
check(/grid-column:span 2/.test(appSrc.slice(appSrc.indexOf('const overviewTile ='), appSrc.indexOf('const overviewTile =') + 400)), 'overviewTile\'s wide flag actually applies grid-column:span 2');

// --- Static: Details Summary is index 0 in every one of the 4 tabGroups arrays, and openThis is now
// keyed off that position (idx === 0) rather than a single page-wide firstOverall flag. ---
check(/core: \[artDetailsSummaryCore, /.test(appSrc), 'Core tab\'s Details Summary is still first in its array');
check(/timing: \[artDetailsSummaryTiming, /.test(appSrc), 'Timing tab\'s Details Summary is still first in its array');
check(/environment: \[artDetailsSummaryEnvironment, /.test(appSrc), 'Environment tab\'s Details Summary is still first in its array');
check(/more: \[artDetailsSummaryMore, /.test(appSrc), 'More tab\'s Details Summary is still first in its array');
check(/const openThis = idx === 0; \/\/ Details Summary \(always first\) starts open in every tab/.test(appSrc), 'each tab\'s own Details Summary now opens by default (idx === 0), not just the single very-first section overall');
check(!/let firstOverall = true;/.test(appSrc), 'the old page-wide firstOverall flag is gone (replaced by the per-tab idx===0 check)');

// --- Behavioral: build a real profile (main, partner, business partner) and check the actual output. ---
const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
const storage = {};
const localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};
const sandbox = {
  console, localStorage, navigator: { language: 'en-US' },
  document: dom.window.document, window: dom.window,
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
  alert: () => {}, confirm: () => true,
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');

vm.runInContext(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = {
    profile: {
      englishFirstName: 'Roy', englishLastName: 'Wong', gender: 'male',
      birthdate: '1976-09-07', birthtime: '09:33', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '91234567', vehicles: [{ number: 'SJL1234A', shared: false }],
    },
    home: { address: '92 Flora Road, Singapore 507005' },
    partner: {
      englishFirstName: 'Amy', englishLastName: 'Lee', gender: 'female',
      birthdate: '1978-05-12', birthtime: '14:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
      mobileNumber: '98765432',
    },
    children: [{
      englishFirstName: 'Timmy', englishLastName: 'Wong', gender: 'male',
      birthdate: '2010-01-01', birthtime: '06:00', birthLocation: 'Singapore',
      birthLongitude: 103.8198, birthTimezone: 8,
    }],
  };
  initListeners();
  var __p = getProfileData(activeUser().profile);
  var __pp = getProfileData(activeUser().partner);
  var __cp = getProfileData(activeUser().children[0]);
  var __chartI = renderSystemChart(__p, 'i');
  var __chartP = renderSystemChart(__pp, 'p');
  var __chartC = renderSystemChart(__cp, 'c0');
  var __landingMain = generateSummaryCardHTML(__p, null, false, false, 'i');
  var __landingPartner = generateSummaryCardHTML(__pp, __p, false, false, 'p');
`, sandbox);

const chartI = vm.runInContext('__chartI', sandbox);
const chartP = vm.runInContext('__chartP', sandbox);
const chartC = vm.runInContext('__chartC', sandbox);
const landingMain = vm.runInContext('__landingMain', sandbox);
const landingPartner = vm.runInContext('__landingPartner', sandbox);

// --- Requirement 5: Details Summary expanded by default, all 4 tabs, all profile types. ---
// renderSystemChart's returned string only carries the CORE tab's content directly (tabBarHTML embeds
// tabContentHTML.core) - the other 3 tabs' HTML lives in chartTabRegistry[prefix], swapped in on tab
// click. Check both: Core via the direct return value, and Timing/Environment/More via the registry.
function detailsSummaryIsOpenInHtml(html, sectionId) {
  // A wrapSectionCollapsible <details> block for this section id, with the `open` attribute present.
  const re = new RegExp(`<details class="section-details" id="${sectionId}"[^>]*open[^>]*>`);
  return re.test(html);
}
check(detailsSummaryIsOpenInHtml(chartI, 'detailssummary-core'), 'main profile: Core tab\'s Details Summary is open by default');

const registryI = vm.runInContext(`chartTabRegistry['i']`, sandbox);
const registryP = vm.runInContext(`chartTabRegistry['p']`, sandbox);
const registryC = vm.runInContext(`chartTabRegistry['c0']`, sandbox);
check(!!registryI && /<details class="section-details" id="detailssummary-timing"[^>]*open/.test(registryI.timing), 'main profile: Timing tab\'s Details Summary is open by default');
check(!!registryI && /<details class="section-details" id="detailssummary-environment"[^>]*open/.test(registryI.environment), 'main profile: Environment tab\'s Details Summary is open by default');
check(!!registryI && /<details class="section-details" id="detailssummary-more"[^>]*open/.test(registryI.more), 'main profile: More tab\'s Details Summary is open by default');

// Partner/child profiles never get a real `id` (idAttr only fires for prefix 'i'), so check via the
// class-based <details> marker plus the "Details Summary" heading text instead, and confirm the FIRST
// <details> block within each tab's content (which is always the Details Summary, per tabGroups'
// ordering) carries the `open` attribute.
function firstDetailsIsOpen(html) {
  const m = html.match(/<details class="section-details"[^>]*>/);
  return !!m && /open/.test(m[0]);
}
check(firstDetailsIsOpen(chartP), 'Life Partner: Core tab\'s Details Summary (first <details> block) is open by default');
check(!!registryP && firstDetailsIsOpen(registryP.timing), 'Life Partner: Timing tab\'s Details Summary is open by default');
check(!!registryP && firstDetailsIsOpen(registryP.environment), 'Life Partner: Environment tab\'s Details Summary is open by default');
check(!!registryP && firstDetailsIsOpen(registryP.more), 'Life Partner: More tab\'s Details Summary is open by default');
check(firstDetailsIsOpen(chartC), 'Child profile: Core tab\'s Details Summary (first <details> block) is open by default');
check(!!registryC && firstDetailsIsOpen(registryC.timing), 'Child profile: Timing tab\'s Details Summary is open by default');
check(!!registryC && firstDetailsIsOpen(registryC.environment), 'Child profile: Environment tab\'s Details Summary is open by default');
check(!!registryC && firstDetailsIsOpen(registryC.more), 'Child profile: More tab\'s Details Summary is open by default');

// --- Requirement 4: landing page key-facts grid now has 13 tiles matching chart-level's 13, in order. ---
const chartLevelOrder = ['Gregorian Birth', 'Lunar Birth', 'Day Master', 'Bone Weight', 'Da Yun (Current Cycle)', 'Life Expectancy', 'Numerology Life Path', 'Sun Sign', 'I Ching Hexagram', 'Zi Wei Life Palace', 'QMDJ Life Palace', 'Ba Zhai Kua', 'Flying Star'];
// Chart-level Profile Overview tile labels, in the order they appear in artProfileOverview's own HTML.
const overviewLabelOrder = ['Gregorian Birth', 'Lunar Birth', 'Day Master', 'Bone Weight', 'Da Yun (Current Cycle)', 'Life Expectancy', 'Numerology Life Path', 'Sun Sign', 'I Ching Hexagram', 'Zi Wei Life Palace', 'QMDJ Life Palace', 'Ba Zhai Kua', 'Flying Star ('];
const overviewIndices = overviewLabelOrder.map(label => chartI.indexOf(label));
check(overviewIndices.every(i => i !== -1), `all 13 expected chart-level Profile Overview tile labels were found in the real rendered chart (missing: ${overviewLabelOrder.filter((_, i) => overviewIndices[i] === -1).join(', ') || 'none'})`);
check(overviewIndices.every((v, i) => i === 0 || v > overviewIndices[i - 1]), 'chart-level Profile Overview tiles appear in the expected 13-item order');

const landingLabelOrder = ['Gregorian Birth', 'Lunar Birth', 'Day Master', 'Bone Weight', 'Da Yun (Current Cycle)', 'Life Expectancy', 'Numerology Life Path', 'Sun Sign', 'I Ching Hexagram', 'Zi Wei Life Palace', 'QMDJ Life Palace', 'Ba Zhai Kua', 'Flying Star ('];
const landingIndices = landingLabelOrder.map(label => landingMain.indexOf(label));
check(landingIndices.every(i => i !== -1), `all 13 expected labels were found on the landing summary card (missing: ${landingLabelOrder.filter((_, i) => landingIndices[i] === -1).join(', ') || 'none'})`);
check(landingIndices.every((v, i) => i === 0 || v > landingIndices[i - 1]), 'landing summary card tiles appear in the SAME 13-item order as the chart-level Profile Overview card');

// Zodiac is no longer one of the landing card's key-facts tiles (it wasn't one of the chart-level
// Profile Overview's 13 tiles either - Zodiac is shown in that card's header line instead), confirming
// the landing card was actually reconciled to the chart-level set, not just padded with extras.
const keyFactsGridSlice = landingMain.slice(landingMain.indexOf('grid-template-columns:1fr 1fr'), landingMain.indexOf('grid-template-columns:1fr 1fr') + 3500);
check(!/>Zodiac</.test(keyFactsGridSlice) && !/>生肖</.test(keyFactsGridSlice), 'Zodiac is no longer a separate key-facts tile on the landing card (it was never one of the chart-level Profile Overview\'s 13 tiles)');

// Confirm this also holds for a second profile type (Life Partner), not just the main profile.
const landingPartnerIndices = landingLabelOrder.map(label => landingPartner.indexOf(label));
check(landingPartnerIndices.every(i => i !== -1) && landingPartnerIndices.every((v, i) => i === 0 || v > landingPartnerIndices[i - 1]), 'the Life Partner\'s landing summary card also shows the same 13 tiles in the same order');

// --- Requirement 3 (behavioral): the Flying Star tile in the real rendered chart carries the wide
// style. Matched as a single regex across the tile's own opening div through its label text, since a
// plain indexOf('Flying Star (') would instead match this app's own explanatory HTML comment a few
// hundred characters earlier ("...except Flying Star (玄空飞星), which previously only appeared...").
check(/grid-column:span 2"><div style="font-size:10px;color:var\(--muted\);text-transform:uppercase;letter-spacing:\.05em;margin-bottom:3px">Flying Star \(/.test(chartI), 'the real rendered chart-level Flying Star tile\'s own opening markup carries grid-column:span 2, so it spans the full grid width instead of sitting alone at half width');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

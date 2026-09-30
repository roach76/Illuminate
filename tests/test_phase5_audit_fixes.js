const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the 2 genuine findings from Phase 5's full-app audit (a systematic pass hunting for any
// reading that is half-baked, assumed, hardcoded, or not actually calculated from real inputs).
//
// Finding 1 (engine-metaphysics.js): getCalculatedAstrologyChartHTML/getNatalChartDiagramHTML were
// 100%-static decorative SVGs - byte-identical for every user - despite being named/placed as if they
// rendered a "calculated"/"natal" chart. Fixed to plot a real marker at the person's own real natal
// Sun longitude (computeNatalSunLongitude, already used elsewhere for the 3-year transit reading).
//
// Finding 2 (app.js): editing the home construction year (after a Flying Star deep analysis was
// already showing) called renderFlyingStarResult with only 2 of its 3 arguments, silently dropping
// the whole "Flying Star Property Deep Analysis" section from the live view - every other call site
// correctly passes the 3rd argument (the computed profile). Fixed to match.
process.on('unhandledRejection', () => {});
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const engineSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');

// --- Static regression guards ---
check(/const lon = \(p\?\.bazi\?\.birthMomentUTC\) \? computeNatalSunLongitude\(p\.bazi\.birthMomentUTC\) : 0;/.test(engineSrc), 'BUG FIX VERIFIED: getCalculatedAstrologyChartHTML/getNatalChartDiagramHTML now derive their marker position from the person\'s own real natal Sun longitude, not a fixed template');
// UPDATED (Task #76/#77): the construction-year handling moved into the structured Home Address field
// listener (data-idprefix="homeAddr") as part of the address restructuring, and its result div was
// renamed fsResDiv there to avoid clashing with the address block's own resDiv - the 3rd-argument fix
// itself (passing the computed profile to renderFlyingStarResult) is unchanged, just relocated.
check(/const flyingStarP = prof \? getProfileData\(prof\) : getProfileData\(\);\s*\n\s*fsResDiv\.innerHTML = renderFlyingStarResult\(u\.home\.constructionYear, DIR_FULL_TO_SHORT\[prof\.fsDir\], flyingStarP\);/.test(appSrc), 'BUG FIX VERIFIED: the construction-year handling still passes the computed profile (3rd argument) to renderFlyingStarResult, matching every other call site');

// --- Behavioral: the two astrology SVGs genuinely vary between two real people with different ---
// --- real birth moments, and are internally consistent (same person -> same marker position). ---
let threw = null;
try {
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = { console, localStorage, navigator: { language: 'en-US' } };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
  vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8'), sandbox, { filename: 'engine-metaphysics.js' });

  function profileFor(rec) {
    vm.runInContext(`var __rec = ${JSON.stringify(rec)};`, sandbox);
    return vm.runInContext('getProfileData(__rec)', sandbox);
  }
  const roy = profileFor({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore' });
  const tina = profileFor({ englishFirstName: 'Tina', englishLastName: 'Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female', birthLocation: 'Singapore' });

  vm.runInContext(`var __royP = ${JSON.stringify(roy)}; __royP.bazi.birthMomentUTC = new Date(${JSON.stringify(roy.bazi.birthMomentUTC)});`, sandbox);
  vm.runInContext(`var __tinaP = ${JSON.stringify(tina)}; __tinaP.bazi.birthMomentUTC = new Date(${JSON.stringify(tina.bazi.birthMomentUTC)});`, sandbox);

  const royChart1 = vm.runInContext('getCalculatedAstrologyChartHTML(__royP)', sandbox);
  const royChart2 = vm.runInContext('getCalculatedAstrologyChartHTML(__royP)', sandbox);
  const tinaChart = vm.runInContext('getCalculatedAstrologyChartHTML(__tinaP)', sandbox);
  const royNatal = vm.runInContext('getNatalChartDiagramHTML(__royP)', sandbox);
  const tinaNatal = vm.runInContext('getNatalChartDiagramHTML(__tinaP)', sandbox);

  check(!!royChart1 && royChart1.includes('<svg'), 'getCalculatedAstrologyChartHTML produced real SVG output');
  check(royChart1 === royChart2, 'the same person produces the identical chart on repeated calls (deterministic, not random)');
  check(royChart1 !== tinaChart, 'BUG FIX VERIFIED: two different real people (different real natal Sun longitudes) now produce genuinely DIFFERENT chart SVGs, where before this fix they were byte-identical for everyone');
  check(royNatal !== tinaNatal, 'BUG FIX VERIFIED: the natal chart diagram also now genuinely differs between two different real people');

  // Independently recompute Roy's real natal Sun longitude and confirm the marker's coordinates in
  // the rendered SVG match the real trigonometry, not an arbitrary/placeholder position.
  const royLon = vm.runInContext('computeNatalSunLongitude(__royP.bazi.birthMomentUTC)', sandbox);
  const expectedX = (80 + 65 * Math.cos(royLon * Math.PI / 180)).toFixed(1);
  const expectedY = (80 + 65 * Math.sin(royLon * Math.PI / 180)).toFixed(1);
  check(royChart1.includes(`cx="${expectedX}" cy="${expectedY}"`), `the marker's real (x,y) position in the rendered SVG matches an independent recomputation from Roy's real natal Sun longitude (${royLon.toFixed(2)}°) - expected cx=${expectedX} cy=${expectedY}`);

  // --- Behavioral: renderFlyingStarResult's own documented contract (with vs without the 3rd arg) ---
  const fnStart = appSrc.indexOf('function renderFlyingStarResult(constructionYear, facingDir, p) {');
  const fnEnd = appSrc.indexOf('\n}\n', fnStart) + 2;
  const fnSrc = appSrc.slice(fnStart, fnEnd);
  check(fnSrc.length > 100, 'located the real renderFlyingStarResult function body');
  // generateDeepAnalysisData is a huge function this test doesn't need to load - stub it so we can
  // isolate exactly the `p ? ... : ''` gating behavior renderFlyingStarResult itself is responsible for.
  const dirLabelStart = appSrc.indexOf('const FLYING_STAR_DIR_LABEL_EN');
  const dirLabelSrc = appSrc.slice(dirLabelStart, appSrc.indexOf('\n', appSrc.indexOf('const FLYING_STAR_DIR_LABEL_ZH')) + 1);
  vm.runInContext(`
    function generateDeepAnalysisData(type, p, extra) { return '<div class="flying-star-deep-analysis">STUB DEEP ANALYSIS</div>'; }
    function bt(en, zh) { return en; }
    ${dirLabelSrc}
    ${fnSrc}
  `, sandbox);
  const withP = vm.runInContext(`renderFlyingStarResult(2015, 'S', __royP)`, sandbox);
  const withoutP = vm.runInContext(`renderFlyingStarResult(2015, 'S', null)`, sandbox);
  check(withP.includes('flying-star-deep-analysis'), 'renderFlyingStarResult DOES include the deep-analysis section when a computed profile is passed (the correct behavior every call site should produce)');
  check(!withoutP.includes('flying-star-deep-analysis'), 'renderFlyingStarResult correctly OMITS the deep-analysis section when no profile is passed - reproducing exactly the bug the construction-year handler used to trigger before this fix, confirming the fix (passing the profile) is what actually matters');
} catch (e) { threw = e; }
check(!threw, 'behavioral section completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

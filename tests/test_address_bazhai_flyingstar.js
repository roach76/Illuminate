const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for "the addressed should take into consideration the ba zhai and flying star for
// compatibility calculation and deep analysis": an address's Compatibility Score previously came ONLY
// from the digit-elemental audit (same method as Mobile Number/Vehicle Plate) - completely separate
// from Ba Zhai (personal Kua-vs-facing-direction) and Flying Star (property chart from construction
// year + facing). Per the agreed scope: applies to Home Address and Checked Addresses (both collect a
// facing direction); Work Address deliberately has no facing/construction-year field at all (by
// design, out of Feng Shui scope) so it must keep using the digit score alone, unchanged. When no
// facing direction is saved, falls back to the digit score alone rather than blocking the score.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static ---
check(/function computeAddressFullCompatibility\(addrVal, p, partnerP, facing, constructionYear\)/.test(appSrc), 'computeAddressFullCompatibility exists with the expected signature');
check(/const BAZHAI_RATING_TO_SCORE = /.test(appSrc), 'Ba Zhai rating-to-score mapping exists');
check(/function flyingStarFavToScore\(fav\)/.test(appSrc), 'Flying Star favourable-to-score mapping exists');
check(/function computeAddressDeepAnalysisHTML\(addrVal, shared = true, facing = null, constructionYear = null\)/.test(appSrc), 'computeAddressDeepAnalysisHTML now accepts facing/constructionYear');

function freshSandbox() {
  const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLCanvasElement.prototype.getContext = function () { return { fillStyle: '#fff', fillRect() {} }; };
  const storage = {};
  const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
  const sandbox = {
    console, localStorage, navigator: { language: 'en-US' },
    document: dom.window.document, window: dom.window,
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    URL: dom.window.URL, html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}} }),
    alert: () => {}, confirm: () => true, fetch: undefined, performance,
  };
  sandbox.global = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
  load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');
  vm.runInContext(`initAuthListeners(); initListeners(); updateStaticLanguage();`, sandbox);
  return { dom, sandbox };
}

const testUser = {
  email: 'test@test.com', password: 'x',
  profile: { englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.82, birthTimezone: 8 },
  home: {},
};

// --- 1. computeAddressFullCompatibility: no facing -> falls back to digit score alone (unchanged) ---
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`state.users['test@test.com'] = ${JSON.stringify(testUser)}; state.active = 'test@test.com';`, sandbox);
  const p = vm.runInContext(`getProfileData()`, sandbox);
  vm.runInContext(`window.__p = ${JSON.stringify(p)};`, sandbox);
  const digitOnly = vm.runInContext(`auditAddressScore('123 Orchard Road, Singapore', window.__p, null)`, sandbox);
  const full = vm.runInContext(`computeAddressFullCompatibility('123 Orchard Road, Singapore', window.__p, null, null, null)`, sandbox);
  check(full.score === digitOnly.score, `no facing direction -> full.score (${full.score}) matches the digit-only score (${digitOnly.score}) exactly`);
  check(full.baZhai === null, 'no facing direction -> baZhai component is null');
  check(full.flyingStar === null, 'no facing direction -> flyingStar component is null');
}

// --- 2. computeAddressFullCompatibility: facing + construction year -> real Ba Zhai + Flying Star ---
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`state.users['test@test.com'] = ${JSON.stringify(testUser)}; state.active = 'test@test.com';`, sandbox);
  const p = vm.runInContext(`getProfileData()`, sandbox);
  vm.runInContext(`window.__p2 = ${JSON.stringify(p)};`, sandbox);
  const full = vm.runInContext(`computeAddressFullCompatibility('123 Orchard Road, Singapore', window.__p2, null, 'North', 2005)`, sandbox);
  check(full.baZhai !== null, 'facing direction present -> baZhai component is computed');
  check(typeof full.baZhai.star === 'string' && full.baZhai.star.length > 0, 'baZhai component has a real star name');
  check(['Highly Auspicious','Auspicious','Inauspicious','Highly Inauspicious'].includes(full.baZhai.rating), 'baZhai component has one of the 4 real ratings');
  check(full.flyingStar !== null, 'facing direction + construction year present -> flyingStar component is computed');
  check(typeof full.flyingStar.facingStarNum === 'number' && full.flyingStar.facingStarNum >= 1 && full.flyingStar.facingStarNum <= 9, 'flyingStar component has a real Facing Star number 1-9');
  check(typeof full.flyingStar.mountainStarNum === 'number' && full.flyingStar.mountainStarNum >= 1 && full.flyingStar.mountainStarNum <= 9, 'flyingStar component has a real Mountain Star number 1-9');
  // Verify the overall score really is the average of all 3, not just one of them re-used.
  const expectedAvg = Math.round((full.digitScore + full.baZhai.score + full.flyingStar.score) / 3);
  check(full.score === expectedAvg, `overall score (${full.score}) is the equal-weighted average of digit/Ba Zhai/Flying Star (expected ${expectedAvg})`);
  check(full.score !== full.digitScore, 'blended score genuinely differs from the digit-only score (both other components are real inputs, not no-ops)');
}

// --- 3. computeAddressFullCompatibility: facing but NO construction year -> Ba Zhai only, no Flying Star ---
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`state.users['test@test.com'] = ${JSON.stringify(testUser)}; state.active = 'test@test.com';`, sandbox);
  const p = vm.runInContext(`getProfileData()`, sandbox);
  vm.runInContext(`window.__p3 = ${JSON.stringify(p)};`, sandbox);
  const full = vm.runInContext(`computeAddressFullCompatibility('123 Orchard Road, Singapore', window.__p3, null, 'North', null)`, sandbox);
  check(full.baZhai !== null, 'facing without construction year -> baZhai still computed');
  check(full.flyingStar === null, 'facing without construction year -> flyingStar is NOT computed (needs the year)');
  const expectedAvg2 = Math.round((full.digitScore + full.baZhai.score) / 2);
  check(full.score === expectedAvg2, `with only 2 of 3 components available, overall score (${full.score}) averages just those 2 (expected ${expectedAvg2})`);
}

// --- 4. renderHomeDetailsBlock: Home Address (with facing+year) shows the BLENDED score; Work Address
// (no facing/year by design) keeps the digit-only score; a Checked Address (with facing+year) also
// gets the blended score. ---
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`state.users['test@test.com'] = ${JSON.stringify(testUser)}; state.active = 'test@test.com';`, sandbox);
  const u = vm.runInContext(`activeUser()`, sandbox);
  u.home.addresses = {
    profile: { houseNumber: '123', streetName: 'Orchard Road', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '238859', constructionYear: 2005, facing: '', shared: false },
    work: { houseNumber: '1', streetName: 'Raffles Place', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '048616' },
    checked: [
      { houseNumber: '456', streetName: 'Toa Payoh Lorong 8', unit: '', city: 'Singapore', country: 'Singapore', postalCode: '319391', constructionYear: 2010, facing: 'East', shared: false },
    ],
  };
  const homeP = vm.runInContext(`getProfileData()`, sandbox);
  vm.runInContext(`window.__homeP = ${JSON.stringify(homeP)};`, sandbox);
  const expectedHomeFull = vm.runInContext(`computeAddressFullCompatibility('123 Orchard Road, Singapore', window.__homeP, null, 'North', 2005)`, sandbox);
  const expectedWorkDigit = vm.runInContext(`auditAddressScore('1 Raffles Place, Singapore', window.__homeP, null)`, sandbox);
  const expectedCheckedFull = vm.runInContext(`computeAddressFullCompatibility('456 Toa Payoh Lorong 8, Singapore', window.__homeP, null, 'East', 2010)`, sandbox);

  const blockHTML = vm.runInContext(`renderHomeDetailsBlock(activeUser(), 'North')`, sandbox);
  check(blockHTML.includes(`Compatibility Score: ${expectedHomeFull.score}%`), `Home Address block shows the blended score (${expectedHomeFull.score}%), not the digit-only score`);
  check(blockHTML.includes(`Compatibility Score: ${expectedWorkDigit.score}%`), `Work Address block shows the digit-only score (${expectedWorkDigit.score}%) - unchanged, since Work Address has no facing/year fields`);
  check(blockHTML.includes(`Compatibility Score: ${expectedCheckedFull.score}%`), `Checked Address block shows its own blended score (${expectedCheckedFull.score}%)`);
}

// --- 5. Deep-analysis text mentions Ba Zhai/Flying Star when present, and is honest about their
// absence when a facing direction isn't saved. ---
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`state.users['test@test.com'] = ${JSON.stringify(testUser)}; state.active = 'test@test.com';`, sandbox);
  const withFacingHTML = vm.runInContext(`(function(){ pdfExportMode = true; try { return computeAddressDeepAnalysisHTML('123 Orchard Road, Singapore', false, 'North', 2005); } finally { pdfExportMode = false; } })()`, sandbox);
  check(/Ba Zhai/.test(withFacingHTML) || /八宅/.test(withFacingHTML), 'deep-analysis text mentions Ba Zhai when a facing direction is present');
  check(/Flying Star/.test(withFacingHTML) || /飞星/.test(withFacingHTML), 'deep-analysis text mentions Flying Star when a construction year is present');

  const noFacingHTML = vm.runInContext(`(function(){ pdfExportMode = true; try { return computeAddressDeepAnalysisHTML('123 Orchard Road, Singapore', false, null, null); } finally { pdfExportMode = false; } })()`, sandbox);
  check(/could not be added/.test(noFacingHTML), 'deep-analysis text is honest that Ba Zhai/Flying Star could not be added when no facing direction is saved');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

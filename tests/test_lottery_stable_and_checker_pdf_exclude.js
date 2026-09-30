const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies two fixes made this round, both reported directly by the user against a real, live PDF
// export and a live running session:
//
// 1) "for 4D and toto. the suggested numbers should not change everytime it is loaded as this is
//    statistically tracked". Root cause: the "Most Recent 3 Draws (Verified Results)" section's "Your
//    Suggested Numbers" called get4DSets/getTotoSets directly on every render - unlike the "Upcoming 3
//    Draws" section, which already persisted its picks via getOrCreatePrediction. Since the underlying
//    frequency model is built from whichever historical data happened to be available THIS load (a live
//    fetch can succeed one load and silently fall back to the static snapshot the next), the verified
//    section's suggested numbers could genuinely differ across reloads. Fixed by routing both sections
//    through the same getOrCreatePrediction cache, keyed by the draw's own isoDate.
//
// 2) "items like vehicle plate check and generator should not be included into the pdf" - confirmed by
//    inspecting a real export: pages 50-51 showed "Vehicle Plate Check and Generator" / "Mobile Phone
//    Check and Generator" headings each followed by an empty "---" placeholder box (their interactive
//    form controls were already pdf-exclude'd, but the outer <article> + heading were not). Fixed by
//    marking the outer <article> pdf-exclude too, so the whole section - heading included - is dropped.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
const predSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-predictions.js'), 'utf8');

// --- Static source checks -------------------------------------------------
check(/<article class="reading pdf-exclude">\s*\n\s*<span class="pill">\$\{bt\('Vehicle Plate Check and Generator'/.test(appSrc), 'Vehicle Plate Check and Generator article is marked pdf-exclude');
check(/<article class="reading pdf-exclude">\s*\n\s*<span class="pill">\$\{bt\('Mobile Phone Check and Generator'/.test(appSrc), 'Mobile Phone Check and Generator article is marked pdf-exclude');
check(/const get4DSetsStable = \(dayKey, tier\) => getOrCreatePrediction\('fourD', dayKeyToIso\(dayKey\), \(\) => get4DSets\(dayKey, tier\)\);/.test(predSrc), 'get4DSetsStable persists via getOrCreatePrediction');
check(/const getTotoSetsStable = \(dayKey, tier\) => getOrCreatePrediction\('toto', dayKeyToIso\(dayKey\), \(\) => getTotoSets\(dayKey, tier\)\);/.test(predSrc), 'getTotoSetsStable persists via getOrCreatePrediction');
check(/const suggested4D = get4DSetsStable\(draw\.dayKey, tier\);/.test(predSrc), 'the "Verified Results" 4D section now calls the stable/persisted variant');
check(/const suggestedToto = getTotoSetsStable\(draw\.dayKey, tier\);/.test(predSrc), 'the "Verified Results" TOTO section now calls the stable/persisted variant');

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
    alert: () => {}, confirm: () => true,
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
  home: { addresses: { profile: { houseNumber: '92', streetName: 'Flora Road', unit: '#03-37', city: 'Singapore', country: 'Singapore', postalCode: '507005', constructionYear: '2005' }, checked: [] } },
};

// --- 1. Verified-draw suggested numbers stay identical across repeated calls/renders ---------------
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
    go('chart');
  `, sandbox);
  const p = vm.runInContext(`getProfileData()`, sandbox);
  vm.runInContext(`window.__testP = getProfileData();`, sandbox);

  // Call renderLotteryPredictions twice in a row (simulating two separate page loads/renders) and
  // capture the persisted log's "Most Recent 3 Draws" sets both times via the log directly (isoDate
  // derived from each static snapshot draw's own dayKey).
  vm.runInContext(`document.body.insertAdjacentHTML('beforeend', '<div id="fourDContainer"></div><div id="totoContainer"></div>');`, sandbox);
  vm.runInContext(`renderLotteryPredictions(window.__testP);`, sandbox);
  const log1 = vm.runInContext(`JSON.stringify(state.users['test@test.com'].lotteryLog.fourD.map(e => ({isoDate: e.isoDate, sets: e.sets})))`, sandbox);
  const totoLog1 = vm.runInContext(`JSON.stringify(state.users['test@test.com'].lotteryLog.toto.map(e => ({isoDate: e.isoDate, sets: e.sets})))`, sandbox);

  // Simulate a second, independent render (as a fresh page load calling renderLotteryPredictions again
  // against the SAME persisted state) - the point of the fix is that this must NOT change the sets for
  // draws that already have a log entry.
  vm.runInContext(`renderLotteryPredictions(window.__testP);`, sandbox);
  const log2 = vm.runInContext(`JSON.stringify(state.users['test@test.com'].lotteryLog.fourD.map(e => ({isoDate: e.isoDate, sets: e.sets})))`, sandbox);
  const totoLog2 = vm.runInContext(`JSON.stringify(state.users['test@test.com'].lotteryLog.toto.map(e => ({isoDate: e.isoDate, sets: e.sets})))`, sandbox);

  check(log1 === log2, 'a second render does not change any already-generated 4D prediction (including "Verified Results" draws)');
  check(totoLog1 === totoLog2, 'a second render does not change any already-generated TOTO prediction (including "Verified Results" draws)');
  const fourDCount = vm.runInContext(`state.users['test@test.com'].lotteryLog.fourD.length`, sandbox);
  check(fourDCount >= 6, `both the 3 verified draws and the 3 upcoming draws got persisted log entries (found ${fourDCount})`);
}

// --- 2. A verified draw's suggested numbers are consistent even if the "model" data source changes --
{
  const { sandbox } = freshSandbox();
  vm.runInContext(`
    state.users['test@test.com'] = ${JSON.stringify(testUser)};
    state.active = 'test@test.com';
    go('chart');
    document.body.insertAdjacentHTML('beforeend', '<div id="fourDContainer"></div><div id="totoContainer"></div>');
  `, sandbox);
  const p = vm.runInContext(`getProfileData()`, sandbox);
  vm.runInContext(`window.__testP = getProfileData(); renderLotteryPredictions(window.__testP);`, sandbox);
  const beforeSets = vm.runInContext(`JSON.stringify(state.users['test@test.com'].lotteryLog.fourD[0].sets)`, sandbox);

  // Simulate a live-fetch data source becoming available on a SUBSEQUENT render (previously this alone
  // could change the "Verified Results" suggested numbers, since get4DSets was called fresh every time).
  vm.runInContext(`
    liveLotteryHistory = {
      lastUpdated: new Date().toISOString(),
      fourD: [
        { date: 'Wed 2 Sep 2026', isoDate: '2026-09-02', winning: ['1111','2222','3333','0253','1002','1967','2104','2182','2362','2809','3598','3983','3997','0616','1119','3761','4997','6485','6934','7885','7999','8043','9283'] },
        { date: 'Sun 30 Aug 2026', isoDate: '2026-08-30', winning: ['9238','8594','0379','1482','1739','2854','3412','4808','6214','6622','7241','7627','8578','0608','0733','2203','4510','4656','5505','6756','8849','9828','9868'] },
        { date: 'Sat 29 Aug 2026', isoDate: '2026-08-29', winning: ['0363','4694','2691','0277','0457','0583','0640','3223','3230','6453','6512','7302','7755','1024','1343','2957','6639','7014','7136','7480','9483','9537','9679'] },
      ],
      toto: [
        { date: 'Thu 3 Sep 2026', isoDate: '2026-09-03', winning: [1,2,3,4,5,6], additional: 7 },
        { date: 'Mon 31 Aug 2026', isoDate: '2026-08-31', winning: [7, 26, 33, 39, 41, 46], additional: 11 },
        { date: 'Thu 27 Aug 2026', isoDate: '2026-08-27', winning: [8, 9, 14, 17, 35, 40], additional: 18 },
      ],
    };
  `, sandbox);
  vm.runInContext(`renderLotteryPredictions(window.__testP);`, sandbox);
  const afterSets = vm.runInContext(`JSON.stringify(state.users['test@test.com'].lotteryLog.fourD[0].sets)`, sandbox);
  check(beforeSets === afterSets, "a verified draw's already-persisted suggested numbers do not change even when the live-fetch data source becomes available on a later render");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

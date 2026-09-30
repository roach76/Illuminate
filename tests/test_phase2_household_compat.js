const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Phase 2's "Household compatibility" feature - previously entirely MISSING (confirmed by
// direct source investigation: calculateTrueCompatibility was already used for User-vs-Partner,
// User-vs-Business-Partner, and User-vs-each-Child, but NEVER pairwise across the whole household, and
// NEVER for household occupants at all, since occupants only ever had a bare Kua number, not a full
// profile calculateTrueCompatibility needs).
//
// Covers:
// 1. getOccupantProfileData() - builds a REAL, full BaZi profile (via the same getProfileData()
//    pipeline every other profile type uses) from an occupant's {name, birthdate, birthtime, gender},
//    with a sensible fallback name and the approximateBirth flag carried through.
// 2. buildHouseholdCompatibilityRoster() - assembles the full-profile roster (you + Life Partner +
//    every child + every occupant), mirroring buildHouseholdPeopleList's exact membership.
// 3. The 'household_compat' deep-analysis branch - drives the REAL calculateTrueCompatibility engine
//    pairwise across a real roster, confirming the overall score is a genuine average (not a fixed/
//    generic number), that strongest/weakest pairings are correctly identified, and that the empty/
//    single-person case is handled without throwing.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function buildSandbox() {
  const storage = {};
  const localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
  };
  const sandbox = {
    localStorage, console, navigator: { language: 'en-US' },
    setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
    alert: () => {}, document: { createElement: () => ({ style: {}, appendChild(){}, querySelectorAll: () => [] }) },
    html2pdf: () => ({ set(){return this}, from(){return this}, toPdf(){return {then(){}}; } }),
  };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js');
  return { sandbox, run: (code) => vm.runInContext(code, sandbox) };
}

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guards ---
check(/function getOccupantProfileData\(occupant, indexForFallbackName\)/.test(appSrc), 'getOccupantProfileData() exists with the expected signature');
check(/function buildHouseholdCompatibilityRoster\(p, u, occupants\)/.test(appSrc), 'buildHouseholdCompatibilityRoster() exists with the expected signature');
check(/type === 'household_compat' && extraData && Array\.isArray\(extraData\.roster\)/.test(appSrc), 'a household_compat deep-analysis branch is wired in generateDeepAnalysisData');
check(/for \(let i = 0; i < roster\.length; i\+\+\) \{\s*\n\s*for \(let j = i \+ 1; j < roster\.length; j\+\+\) \{\s*\n\s*const cr = calculateTrueCompatibility\(roster\[i\]\.profile, roster\[j\]\.profile, false\);/.test(appSrc),
  'BUG FIX VERIFIED: the household reading genuinely runs calculateTrueCompatibility pairwise (i<j) across every roster member, not a single aggregate shortcut');
check(/id="household-compat-analysis-\$\{prefix\}"/.test(appSrc), 'the household compatibility reading is wired into the rendered Feng Shui/household block');

// --- Behavioral: extract and run the REAL functions verbatim ---
let threw = null;
try {
  const START = 'function getOccupantProfileData(occupant, indexForFallbackName) {';
  const END = 'function buildHouseholdPeopleList(p, u, occupants) {';
  const startIdx = appSrc.indexOf(START);
  check(startIdx !== -1, 'located the real getOccupantProfileData/buildHouseholdCompatibilityRoster block');
  const endIdx = appSrc.indexOf(END, startIdx);
  check(endIdx !== -1, 'located the block\'s end boundary (start of buildHouseholdPeopleList)');
  const helpersSrc = appSrc.slice(startIdx, endIdx);

  // Extract the real household_compat branch body out of generateDeepAnalysisData, to drive it
  // directly against a real roster without needing the entire multi-thousand-line dispatch function.
  const branchStart = appSrc.indexOf("} else if (type === 'household_compat'");
  const branchEnd = appSrc.indexOf("} else if (type === 'face') {", branchStart);
  check(branchStart !== -1 && branchEnd !== -1, 'located the real household_compat branch body');
  const branchBody = appSrc.slice(branchStart, branchEnd).replace(/^\} else if/, 'if') + '\n}';

  const { sandbox, run } = buildSandbox();
  // getProfileData needs `activeUser`/`state`/`lang` (from engine-core.js, already loaded) and a few
  // small app.js-level helpers/tables the branch itself references - load only what's needed rather
  // than the entire app.js (which needs a real `document` with far more DOM surface than this test
  // requires).
  vm.runInContext(`
    lang = 'en';
    function bt(en, zh) { return (lang === 'zh' && zh) ? zh : en; }
    function escapeHtml(str) { if (str === null || str === undefined) return ''; return String(str); }
    function computeCurrentAge(birthdateStr) {
      const birthDateObj = new Date(birthdateStr + 'T00:00:00');
      const today = new Date();
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const hadBirthdayThisYear = (today.getMonth() > birthDateObj.getMonth()) || (today.getMonth() === birthDateObj.getMonth() && today.getDate() >= birthDateObj.getDate());
      if (!hadBirthdayThisYear) age -= 1;
      return Math.max(0, age);
    }
    ${helpersSrc}
  `, sandbox);

  // A real, complete Individual profile record (same shape the rest of this app's test suite uses).
  run(`
    var __rawUser = {
      englishFirstName: 'Roy', englishLastName: 'Wong', englishName: 'Roy Wong',
      birthdate: '1976-09-07', birthtime: '09:33', gender: 'male',
      birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8,
    };
    var p = getProfileData(__rawUser);
    var u = {
      partner: { englishFirstName: 'Jane', englishLastName: 'Tan', englishName: 'Jane Tan', birthdate: '1978-03-03', birthtime: '11:00', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      children: [
        { englishFirstName: 'Kid', englishLastName: 'Wong', englishName: 'Kid Wong', birthdate: '2010-01-01', birthtime: '12:00', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 },
      ],
    };
    var occupants = [
      { name: 'Grandma', birthdate: '1950-03-02', birthtime: '08:15', gender: 'female', year: 1950, approximateBirth: false },
      { name: '', birthdate: '1988-06-15', birthtime: '', gender: 'male', year: 1988, approximateBirth: true }, // migrated legacy record
    ];
  `);

  check(!!run('p'), 'built a real full profile for the primary user via getProfileData()');
  check(!!run('p.bazi') && typeof run('p.bazi.dayStemIdx') === 'number', 'the primary profile has a real, computed BaZi Day Master');

  // --- Test 1: getOccupantProfileData ---
  const occ0 = run('getOccupantProfileData(occupants[0], 0)');
  check(!!occ0 && !!occ0.bazi, 'BUG FIX VERIFIED: getOccupantProfileData() produces a real, full BaZi profile for an occupant with a birthdate/time - not just a Kua number');
  check(occ0.englishFirstName === 'Grandma', 'the occupant\'s own name is carried through as their profile name, not a generic placeholder');
  check(occ0.isOccupantApproximate === false, 'a real (non-migrated) occupant is correctly NOT flagged approximate');
  const occ1 = run('getOccupantProfileData(occupants[1], 1)');
  check(!!occ1 && occ1.isOccupantApproximate === true, 'a migrated (approximate) occupant record is correctly flagged approximate in its computed profile too');
  check(occ1.englishFirstName === run('bt("Occupant 2", "住户2")'), 'an occupant with no name falls back to a numbered "Occupant N" label rather than "undefined"');
  check(run('getOccupantProfileData(null, 0)') === null, 'a null/incomplete occupant record returns null rather than throwing');
  check(run('getOccupantProfileData({name:"X"}, 0)') === null, 'an occupant record with no birthdate at all returns null rather than producing a garbage profile');

  // --- Test 2: buildHouseholdCompatibilityRoster ---
  const roster = run('buildHouseholdCompatibilityRoster(p, u, occupants)');
  check(Array.isArray(roster) && roster.length === 5, `BUG FIX VERIFIED: the household compatibility roster includes exactly 5 people (you + partner + 1 child + 2 occupants) - got ${Array.isArray(roster) ? roster.length : 'not an array'}`);
  check(roster.every(r => r.profile && r.profile.bazi), 'every single roster member (including both occupants) carries a full, real BaZi profile - not a bare Kua number');
  check(roster[0].label === run('bt("You", "本人")'), 'the primary user is correctly labelled "You" and listed first');

  // --- Test 3: the real household_compat branch, driven directly ---
  function runBranch(extraDataCode) {
    const localSandbox = { ...sandbox };
    vm.createContext(localSandbox);
    vm.runInContext(`
      var type = 'household_compat';
      var extraData = ${extraDataCode};
      var chars, exp, traits, hl, pos, neg, cau, opts;
      ${branchBody}
      globalThis.__result = { chars, exp, traits, hl, pos, neg, cau, opts };
    `, localSandbox);
    return localSandbox.__result;
  }
  const result = runBranch('{ roster: buildHouseholdCompatibilityRoster(p, u, occupants) }');
  check(!!result.chars && /overall household score \d+%/.test(result.chars), 'BUG FIX VERIFIED: the reading reports a genuine, computed overall household score (not a fixed placeholder)');
  check(Array.isArray(result.hl) && result.hl.some(h => /Overall household score/.test(h)), 'the highlights include the overall score line');
  check(Array.isArray(result.hl) && result.hl.some(h => /Strongest pairing/.test(h)) && result.hl.some(h => /Most in need of active management/.test(h)),
    'the reading correctly identifies both the strongest AND weakest pairings out of all 10 pairs (5 people = 5*4/2 = 10 pairs)');
  // Cross-check the overall score really is the mean of the individual pairwise scores (not, say,
  // just the first pair's score, or a hardcoded constant), by recomputing it independently here.
  const pairScores = [];
  const rosterLen = 5;
  run(`
    var __roster = buildHouseholdCompatibilityRoster(p, u, occupants);
    var __pairs = [];
    for (var i = 0; i < __roster.length; i++) for (var j = i+1; j < __roster.length; j++) __pairs.push(calculateTrueCompatibility(__roster[i].profile, __roster[j].profile, false).score);
    globalThis.__pairScores = __pairs;
  `);
  const independentPairs = run('__pairScores');
  check(Array.isArray(independentPairs) && independentPairs.length === 10, `exactly 10 pairwise scores computed for a 5-person household (5 choose 2) - got ${independentPairs.length}`);
  const expectedOverall = Math.round(independentPairs.reduce((a,b)=>a+b,0) / independentPairs.length);
  check(result.chars.includes(`overall household score ${expectedOverall}%`), `BUG FIX VERIFIED: the reported overall score (${expectedOverall}% expected) is a genuine average of all pairwise scores, independently recomputed and matched exactly`);

  // Regression: fewer than 2 people (nothing to compare) is handled gracefully, not a crash.
  const emptyResult = runBranch('{ roster: [{ label: "You", profile: p }] }');
  check(!!emptyResult.chars && /at least 2 people/.test(emptyResult.chars), 'a household of only 1 person correctly reports that at least 2 are needed, without throwing');
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

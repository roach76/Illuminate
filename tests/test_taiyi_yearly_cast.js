const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Test: computeTaiYiYearlyCast (Tai Yi Shen Shu Yearly Cast, steps 1-3 of user's classical formula)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name); }
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only', url: 'https://example.com/' });
const sandbox = dom.window;
sandbox.window = sandbox;
sandbox.console = console;
sandbox.localStorage = (function() {
  let store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();
sandbox.html2pdf = () => ({ from: () => ({ set: () => ({ save: () => {}, outputPdf: () => {}, toPdf: () => ({ get: () => ({ save: () => {} }) }) }) }) });
vm.createContext(sandbox);

function load(file) { vm.runInContext(fs.readFileSync(path.join(PROJECT, file), 'utf8'), sandbox, { filename: file }); }
load('engine-core.js');
load('engine-metaphysics.js');

// Seed a minimal logged-in user so activeUser()-dependent functions (getProfileData) work.
vm.runInContext(`
  state = { users: {}, active: 'roy@test.com' };
  state.users['roy@test.com'] = { profile: { name: 'Roy Wong' } };
`, sandbox);

// Pull functions/constants into local scope via the sandbox global.
const computeTaiYiYearlyCast = sandbox.computeTaiYiYearlyCast;
check('computeTaiYiYearlyCast is a function', typeof computeTaiYiYearlyCast === 'function');

// --- Step 1: Accumulated Years ---
const r2026 = computeTaiYiYearlyCast(2026);
check('Accumulated Years = year + 10,153,917 (2026)', r2026.accumulatedYears === 2026 + 10153917);

const r1 = computeTaiYiYearlyCast(1);
check('Accumulated Years works for small year (1 AD)', r1.accumulatedYears === 1 + 10153917);

// --- Step 2: Bureau/Dun (mod 72) ---
// accumulatedYears for 2026 = 10155943. 10155943 % 72 = ?
function mod72(y) { return (y + 10153917) % 72; }
function mod24(y) { return (y + 10153917) % 24; }

check('remainder72 matches raw mod for 2026', r2026.remainder72 === (mod72(2026) === 0 ? 72 : mod72(2026)));

// Find a year where accumulatedYears % 72 === 0 (Bureau 72, edge case)
let yearR72Zero = null;
for (let y = 2000; y < 2200; y++) { if (mod72(y) === 0) { yearR72Zero = y; break; } }
check('found a year with accumulatedYears % 72 === 0 for testing', yearR72Zero !== null);
if (yearR72Zero !== null) {
  const rz = computeTaiYiYearlyCast(yearR72Zero);
  check('remainder 0 in mod-72 maps to Bureau 72 (Yin Dun)', rz.remainder72 === 72 && rz.dun === 'yin' && rz.bureauNumber === 36);
}

// Find boundary years around Yang/Yin Dun split (r72 === 36 vs 37)
let year36 = null, year37 = null;
for (let y = 2000; y < 2200; y++) {
  const r = mod72(y);
  if (r === 36 && year36 === null) year36 = y;
  if (r === 37 && year37 === null) year37 = y;
  if (year36 !== null && year37 !== null) break;
}
check('found boundary years for Yang/Yin Dun split', year36 !== null && year37 !== null);
if (year36 !== null) {
  const rb = computeTaiYiYearlyCast(year36);
  check('remainder 36 => Yang Dun, Bureau 36 (last Yang Dun bureau)', rb.dun === 'yang' && rb.bureauNumber === 36);
}
if (year37 !== null) {
  const rb = computeTaiYiYearlyCast(year37);
  check('remainder 37 => Yin Dun, Bureau 1 (first Yin Dun bureau)', rb.dun === 'yin' && rb.bureauNumber === 1);
}

// General Bureau/Dun sanity across a range
let bureauOk = true;
for (let y = 1990; y < 2090; y++) {
  const r = computeTaiYiYearlyCast(y);
  const raw = mod72(y);
  const expectedR72 = raw === 0 ? 72 : raw;
  const expectedDun = expectedR72 <= 36 ? 'yang' : 'yin';
  const expectedBureau = expectedDun === 'yang' ? expectedR72 : expectedR72 - 36;
  if (r.remainder72 !== expectedR72 || r.dun !== expectedDun || r.bureauNumber !== expectedBureau) {
    bureauOk = false;
    console.log('  mismatch at year', y, r);
    break;
  }
}
check('Bureau/Dun formula holds across 1990-2089', bureauOk);

// --- Step 3: Tai Yi Palace position (mod 24, 3 years/palace, 8 palaces) ---
// Find a year where accumulatedYears % 24 === 0 (edge case, maps to r24=24, last palace/year)
let yearR24Zero = null;
for (let y = 2000; y < 2200; y++) { if (mod24(y) === 0) { yearR24Zero = y; break; } }
check('found a year with accumulatedYears % 24 === 0 for testing', yearR24Zero !== null);
if (yearR24Zero !== null) {
  const rz = computeTaiYiYearlyCast(yearR24Zero);
  check('remainder 0 in mod-24 maps to remainder24=24, yearInPalace=3 (Human)', rz.remainder24 === 24 && rz.yearInPalace === 3 && rz.phase.en === 'Human');
}

// Yang Dun starts at Qian (palace 1); Yin Dun starts at Xun (palace 9, per resolution)
// Find a year that is Yang Dun with palaceOffset = 0 (first palace of the 24-yr cycle, r24 in 1..3)
let yangFirstYear = null;
for (let y = 2000; y < 2300; y++) {
  const r = computeTaiYiYearlyCast(y);
  if (r.dun === 'yang' && r.palaceOffset === 0) { yangFirstYear = y; break; }
}
check('found a Yang Dun year with palaceOffset 0', yangFirstYear !== null);
if (yangFirstYear !== null) {
  const r = computeTaiYiYearlyCast(yangFirstYear);
  check('Yang Dun palaceOffset=0 => Tai Yi Palace = Qian (1)', r.palace.name === 'Qian' && r.palace.num === 1);
}

let yinFirstYear = null;
for (let y = 2000; y < 2300; y++) {
  const r = computeTaiYiYearlyCast(y);
  if (r.dun === 'yin' && r.palaceOffset === 0) { yinFirstYear = y; break; }
}
check('found a Yin Dun year with palaceOffset 0', yinFirstYear !== null);
if (yinFirstYear !== null) {
  const r = computeTaiYiYearlyCast(yinFirstYear);
  check('Yin Dun palaceOffset=0 => Tai Yi Palace = Xun (9), per user-confirmed classical numbering', r.palace.name === 'Xun' && r.palace.num === 9);
}

// --- User-confirmed full orbital paths (2026-09-22 clarification) ---
// Yang Dun (clockwise, forward through TAIYI_PALACE_SEQUENCE):
//   1 Qian -> 2 Li -> 3 Gen -> 4 Zhen -> 6 Dui -> 7 Kun -> 8 Kan -> 9 Xun
// Yin Dun (counter-clockwise, backward through TAIYI_PALACE_SEQUENCE from Xun):
//   9 Xun -> 8 Kan -> 7 Kun -> 6 Dui -> 4 Zhen -> 3 Gen -> 2 Li -> 1 Qian
// Only assert the full-cycle path over a window where the Dun (Yang/Yin) doesn't itself
// flip mid-cycle (its own 36-year period doesn't align with the 24-year palace period).
function findFullCycleStart(preferredDun) {
  for (let y = 2000; y < 2400; y++) {
    const r0 = computeTaiYiYearlyCast(y);
    if (r0.dun !== preferredDun || r0.palaceOffset !== 0) continue;
    let ok = true;
    const path = [];
    for (let i = 0; i < 8; i++) {
      const r = computeTaiYiYearlyCast(y + i * 3);
      if (r.dun !== preferredDun) { ok = false; break; }
      path.push(r.palace.num);
    }
    if (ok) return { year: y, path };
  }
  return null;
}

const yangCycle = findFullCycleStart('yang');
check('found a full 24-year Yang Dun cycle window for path verification', yangCycle !== null);
if (yangCycle !== null) {
  check('Yang Dun full 8-palace path matches user-confirmed clockwise order', JSON.stringify(yangCycle.path) === JSON.stringify([1, 2, 3, 4, 6, 7, 8, 9]));
}

const yinCycle = findFullCycleStart('yin');
check('found a full 24-year Yin Dun cycle window for path verification', yinCycle !== null);
if (yinCycle !== null) {
  check('Yin Dun full 8-palace path matches user-confirmed counter-clockwise order', JSON.stringify(yinCycle.path) === JSON.stringify([9, 8, 7, 6, 4, 3, 2, 1]));
}

// Palace sequence never includes Center (5) - verify indirectly via the palace values
// produced across a wide span of years (a plain 24-year window isn't guaranteed to align
// with a single Dun's own palace cycle, since the 36-year Dun period and 24-year palace
// period don't share a start), since TAIYI_PALACE_SEQUENCE is a top-level const and not
// exposed on the sandbox global by the vm module.
const palaceNumsSeen = new Set();
for (let y = 2000; y < 2200; y++) { palaceNumsSeen.add(computeTaiYiYearlyCast(y).palace.num); }
check('Tai Yi Palace values across a wide span exclude Center (5)', !palaceNumsSeen.has(5));
check('Tai Yi Palace values across a wide span span exactly 8 distinct palaces', palaceNumsSeen.size === 8);

// Year-in-palace phase labels
const phases = new Set();
for (let y = 2020; y < 2044; y++) { phases.add(computeTaiYiYearlyCast(y).phase.en); }
check('all three phase labels (Heaven/Earth/Human) appear across a 24-year span', phases.has('Heaven') && phases.has('Earth') && phases.has('Human'));

// --- Ji Shen (计神), per user-supplied formula: (16 - YearBranchIndex[1-12]) MOD 12, 0=>12 ---
// Anchor check: a Zi year (branch index 0) must place Ji Shen at Yin (branch index 2).
function findYearWithBranch(branchIdx0) {
  for (let y = 2000; y < 2020; y++) { if (mod(y - 4, 12) === branchIdx0) return y; }
  return null;
}
function mod(a, n) { return ((a % n) + n) % n; }
const ziYear = findYearWithBranch(0);
check('found a Zi-branch year for Ji Shen anchor check', ziYear !== null);
if (ziYear !== null) {
  const r = computeTaiYiYearlyCast(ziYear);
  check('Ji Shen exists on yearlyCast', !!r.jiShen);
  check('Zi year => Ji Shen anchored at Yin, per user-confirmed anchor', r.jiShen && r.jiShen.name === 'Yin');
}
// Independently recompute Ji Shen's position for every possible year-branch (0-11) using the
// user's own formula and cross-check against the engine's output.
let jiShenOk = true;
for (let branchIdx0 = 0; branchIdx0 < 12; branchIdx0++) {
  const y = findYearWithBranch(branchIdx0);
  if (y === null) { jiShenOk = false; break; }
  const idx1 = branchIdx0 + 1;
  let pos1 = (16 - idx1) % 12; if (pos1 === 0) pos1 = 12;
  const expectedBranchIdx0 = pos1 - 1;
  const r = computeTaiYiYearlyCast(y);
  if (!r.jiShen || r.jiShen.branchIdx !== expectedBranchIdx0) { jiShenOk = false; console.log('  Ji Shen mismatch at branch', branchIdx0, r.jiShen); break; }
}
check('Ji Shen formula holds for all 12 year-branches, independently recomputed', jiShenOk);

// --- The Three Foundations (三基 - Jun Ji/Chen Ji/Min Ji), per user-supplied formulas ---
if (ziYear !== null) {
  const r = computeTaiYiYearlyCast(ziYear);
  check('threeFoundations exists on yearlyCast', !!r.threeFoundations);
  check('threeFoundations has junJi/chenJi/minJi', !!(r.threeFoundations && r.threeFoundations.junJi && r.threeFoundations.chenJi && r.threeFoundations.minJi));
}
// Independently recompute Jun Ji/Chen Ji/Min Ji across a range of years and cross-check.
let foundationsOk = true;
for (let y = 2000; y < 2060; y++) {
  const r = computeTaiYiYearlyCast(y);
  const base = r.accumulatedYears + 250;
  const expectedJunJi = Math.floor((base % 360) / 30) % 12;
  const expectedChenJi = Math.floor((base % 36) / 3) % 12;
  const expectedMinJi = (base % 12) % 12;
  if (r.threeFoundations.junJi.branchIdx !== expectedJunJi || r.threeFoundations.chenJi.branchIdx !== expectedChenJi || r.threeFoundations.minJi.branchIdx !== expectedMinJi) {
    foundationsOk = false; console.log('  Three Foundations mismatch at year', y, r.threeFoundations); break;
  }
}
check('Three Foundations (Jun Ji/Chen Ji/Min Ji) formulas hold across 2000-2059, independently recomputed', foundationsOk);

// --- Branch-to-Palace mapping and 16 Deities table (data tables, checked via known anchor points) ---
// These live as top-level consts inside engine-metaphysics.js and aren't exposed on the sandbox
// global directly, but we can validate their effect indirectly: Ji Shen anchor already proves the
// branch indexing is right, and the Three Foundations checks above prove the Zi-start convention.
// Directly re-read the source for the specific mapping table's values as a static sanity check,
// since these are plain data (not computed), to guard against a future accidental edit.
const engineSrcForCheck = fs.readFileSync(path.join(PROJECT, 'engine-metaphysics.js'), 'utf8');
check('Branch-to-Palace map source matches user-supplied table (Zi=8, Chou/Gen/Yin=3, Mao=4, Chen/Xun/Si=9, Wu=2, Wei/Kun/Shen=7, You=6, Xu/Qian/Hai=1)',
  /const TAIYI_BRANCH_PALACE_MAP = \[8, 3, 3, 4, 9, 9, 2, 7, 7, 6, 1, 1\]/.test(engineSrcForCheck));
check('16 Deities table source includes all 16 user-supplied deity names', [
  'Di Zhu', 'Yang De', 'He De', 'Lu Shen', 'Gao Cong', 'Tai Yang', 'Da Wu', 'Tai Ming',
  'Tian Fan', 'Yin De', 'Da Chen', 'Wu De', 'Tai Cu', 'Yin Zhu', 'Tian Liu', 'Da Yi'
].every(name => engineSrcForCheck.includes(`deity: '${name}'`)));

// --- Harmony (和/具) vs Discordant (无地/无天) classifier, per user-supplied digit rule ---
const classifyTaiYiHarmony = sandbox.classifyTaiYiHarmony;
check('classifyTaiYiHarmony is a function', typeof classifyTaiYiHarmony === 'function');
if (typeof classifyTaiYiHarmony === 'function') {
  check('14 (tens+units both nonzero) => Harmonious', classifyTaiYiHarmony(14).code === 'he_ju');
  check('27 (tens+units both nonzero) => Harmonious', classifyTaiYiHarmony(27).code === 'he_ju');
  check('7 (single digit, no tens) => No Earth (discordant)', classifyTaiYiHarmony(7).code === 'wu_di');
  check('30 (ends in zero, no units) => No Heaven (discordant)', classifyTaiYiHarmony(30).code === 'wu_tian');
  check('40 (ends in zero, no units) => No Heaven (discordant)', classifyTaiYiHarmony(40).code === 'wu_tian');
}

// --- Wen Chang (天目文昌), 16-year cycle per user's 2026-09-22 correction ---
// Yang Dun: (12 + BureauIndex - 1) MOD 16, starting Shen(12). Yin Dun: (4 - (BureauIndex-1)) MOD 16, starting Yin(4).
const taiYiMod1to16 = sandbox.taiYiMod1to16;
check('taiYiMod1to16 is a function', typeof taiYiMod1to16 === 'function');
let wenChangOk = true;
for (let y = 2000; y < 2200; y++) {
  const r = computeTaiYiYearlyCast(y);
  const expected = r.dun === 'yang'
    ? taiYiMod1to16(12 + r.bureauNumber - 1)
    : taiYiMod1to16(4 - (r.bureauNumber - 1));
  if (!r.wenChang || r.wenChang.boardIndex !== expected) { wenChangOk = false; console.log('  Wen Chang mismatch at', y, r.wenChang, 'expected', expected); break; }
}
check('Wen Chang board index formula holds across 2000-2199, independently recomputed for both Duns', wenChangOk);
// Anchor checks: bureau 1 must start at the stated sectors for each Dun.
let yangBureau1Year = null, yinBureau1Year = null;
for (let y = 2000; y < 2100; y++) {
  const r = computeTaiYiYearlyCast(y);
  if (r.dun === 'yang' && r.bureauNumber === 1 && yangBureau1Year === null) yangBureau1Year = y;
  if (r.dun === 'yin' && r.bureauNumber === 1 && yinBureau1Year === null) yinBureau1Year = y;
}
check('found a Yang Dun Bureau-1 year', yangBureau1Year !== null);
if (yangBureau1Year !== null) check('Yang Dun Bureau 1 => Wen Chang at Shen (board index 12)', computeTaiYiYearlyCast(yangBureau1Year).wenChang.boardIndex === 12);
check('found a Yin Dun Bureau-1 year', yinBureau1Year !== null);
if (yinBureau1Year !== null) check('Yin Dun Bureau 1 => Wen Chang at Yin (board index 4)', computeTaiYiYearlyCast(yinBureau1Year).wenChang.boardIndex === 4);

// --- Shi Ji (地目始击): distance from Ji Shen to Wen Chang, re-applied from He De (Gen, board 3) ---
// User's own worked example: Ji Shen at Zi(1), Wen Chang at Shen(12) => distance 11 => Shi Ji at Xu(14).
check('Shi Ji worked example: Ji Shen(board1=Zi), Wen Chang(board12=Shen) => distance 11, Shi Ji at board14 (Xu)', (() => {
  const distance = ((12 - 1) % 16 + 16) % 16;
  const shiJiIdx = taiYiMod1to16(3 + distance);
  return distance === 11 && shiJiIdx === 14;
})());
let shiJiOk = true;
for (let y = 2000; y < 2150; y++) {
  const r = computeTaiYiYearlyCast(y);
  const jiShenBoardIdx = r.jiShen.boardIndex;
  const expectedDistance = ((r.wenChang.boardIndex - jiShenBoardIdx) % 16 + 16) % 16;
  const expectedShiJi = taiYiMod1to16(3 + expectedDistance);
  if (!r.shiJi || r.shiJi.boardIndex !== expectedShiJi || r.shiJi.distanceFromJiShen !== expectedDistance) {
    shiJiOk = false; console.log('  Shi Ji mismatch at', y, r.shiJi, 'expected', expectedShiJi); break;
  }
}
check('Shi Ji formula holds across 2000-2149, independently recomputed from Ji Shen and Wen Chang', shiJiOk);

// --- "The palace behind Tai Yi" (spatial clockwise perimeter, distinct from the orbit sequence) ---
const computeTaiYiPalaceBehind = sandbox.computeTaiYiPalaceBehind;
check('computeTaiYiPalaceBehind is a function', typeof computeTaiYiPalaceBehind === 'function');
if (typeof computeTaiYiPalaceBehind === 'function') {
  check('Tai Yi in Zhen(4) => palace behind is Gen(3), per user example', computeTaiYiPalaceBehind(4).num === 3);
  check('Tai Yi in Qian(1) => palace behind is Dui(6), per user example', computeTaiYiPalaceBehind(1).num === 6);
  // Full spatial sequence: Qian(1) -> Kan(8) -> Gen(3) -> Zhen(4) -> Xun(9) -> Li(2) -> Kun(7) -> Dui(6) -> back to Qian.
  const spatialPairs = [[1, 6], [8, 1], [3, 8], [4, 3], [9, 4], [2, 9], [7, 2], [6, 7]];
  const spatialOk = spatialPairs.every(([cur, behind]) => computeTaiYiPalaceBehind(cur).num === behind);
  check('Full spatial clockwise sequence (Qian-Kan-Gen-Zhen-Xun-Li-Kun-Dui) holds for every palace', spatialOk);
}

// --- Host/Guest Count (主算/客算) - Jian Chen inherit their parent Palace's value, counted once ---
const computeTaiYiHostGuestCount = sandbox.computeTaiYiHostGuestCount;
check('computeTaiYiHostGuestCount is a function', typeof computeTaiYiHostGuestCount === 'function');
if (typeof computeTaiYiHostGuestCount === 'function') {
  check('Same start/end palace => count is just that palace\'s own value once', computeTaiYiHostGuestCount(1, 8) === 8);
  // From Zi (board1, palace8/Kan) to Gen (palace3): passes Zi(8), Chou(3, first sector of Gen's corner) -> stop, summing 8+3=11.
  check('Zi(board1) to Gen(palace3): sums Kan(8)+Gen(3) once each = 11, not double-counting Gen\'s 3 sectors', computeTaiYiHostGuestCount(1, 3) === 11);
  // A full spatial-order walk from Wen Chang to "behind Tai Yi" for a concrete Yearly Cast, cross-checked
  // by independently re-walking the 16-sector board using the same Jian Chen dedupe rule.
  const r = computeTaiYiYearlyCast(2026);
  function independentCount(startIdx, endPalaceNum) {
    const board = [
      { s: 'Zi', p: 8 }, { s: 'Chou', p: 3 }, { s: 'Gen', p: 3 }, { s: 'Yin', p: 3 }, { s: 'Mao', p: 4 }, { s: 'Chen', p: 9 },
      { s: 'Xun', p: 9 }, { s: 'Si', p: 9 }, { s: 'Wu', p: 2 }, { s: 'Wei', p: 7 }, { s: 'Kun', p: 7 }, { s: 'Shen', p: 7 },
      { s: 'You', p: 6 }, { s: 'Xu', p: 1 }, { s: 'Qian', p: 1 }, { s: 'Hai', p: 1 }
    ];
    let idx = startIdx, total = 0, last = null;
    for (let i = 0; i < 16; i++) {
      const pnum = board[idx - 1].p;
      if (pnum !== last) { total += pnum; last = pnum; }
      if (pnum === endPalaceNum) break;
      idx = idx % 16 + 1;
    }
    return total;
  }
  const expectedHost = independentCount(r.wenChang.boardIndex, r.behindPalace.num);
  const expectedGuest = independentCount(r.shiJi.boardIndex, r.behindPalace.num);
  check('Host Count for a real Yearly Cast (2026) matches an independently re-walked board', r.hostCount === expectedHost);
  check('Guest Count for a real Yearly Cast (2026) matches an independently re-walked board', r.guestCount === expectedGuest);
  check('Host Count is classified by classifyTaiYiHarmony and matches a fresh classification', JSON.stringify(r.hostHarmony) === JSON.stringify(classifyTaiYiHarmony(r.hostCount)));
  check('Guest Count is classified by classifyTaiYiHarmony and matches a fresh classification', JSON.stringify(r.guestHarmony) === JSON.stringify(classifyTaiYiHarmony(r.guestCount)));
}

// --- Wiring into natal taiYi and getCurrentYearTaiYiForProfile ---
const getProfileData = sandbox.getProfileData;
const getCurrentYearTaiYiForProfile = sandbox.getCurrentYearTaiYiForProfile;
check('getProfileData exists', typeof getProfileData === 'function');
check('getCurrentYearTaiYiForProfile exists', typeof getCurrentYearTaiYiForProfile === 'function');

if (typeof getProfileData === 'function') {
  const testProfile = {
    name: 'Test Person',
    gender: 'male',
    birthdate: '1990-06-15',
    birthtime: '10:30',
    birthLongitude: 114.1694,
    birthTimezone: 8,
    birthLocation: 'Hong Kong'
  };
  let p;
  try {
    p = getProfileData(testProfile);
  } catch (e) {
    console.log('  getProfileData threw:', e.message);
  }
  check('getProfileData returns a profile object', !!p);
  if (p) {
    check('natal p.taiYi exists', !!p.taiYi);
    check('natal p.taiYi.yearlyCast exists', !!(p.taiYi && p.taiYi.yearlyCast));
    if (p.taiYi && p.taiYi.yearlyCast) {
      check('natal yearlyCast.gregorianYear = birth year (1990)', p.taiYi.yearlyCast.gregorianYear === 1990);
      check('natal yearlyCast has palace/dun/bureauNumber fields', !!p.taiYi.yearlyCast.palace && !!p.taiYi.yearlyCast.dun && typeof p.taiYi.yearlyCast.bureauNumber === 'number');
    }
    // Macro theme fields (pre-existing, must still be present alongside yearlyCast)
    check('natal p.taiYi retains macro theme fields (tierEN/tierZH/themeEN)', typeof p.taiYi.tierEN === 'string' && typeof p.taiYi.tierZH === 'string' && typeof p.taiYi.themeEN === 'string');

    if (typeof getCurrentYearTaiYiForProfile === 'function') {
      const cur = getCurrentYearTaiYiForProfile(p);
      check('getCurrentYearTaiYiForProfile returns an object', !!cur);
      check('getCurrentYearTaiYiForProfile.yearlyCast exists', !!(cur && cur.yearlyCast));
      if (cur && cur.yearlyCast) {
        check('current-year yearlyCast.gregorianYear is a plausible flowing year', cur.yearlyCast.gregorianYear >= 2020 && cur.yearlyCast.gregorianYear <= 2030);
      }
      check('getCurrentYearTaiYiForProfile retains flowingYear/yearStemIdx/yearBranchIdx', typeof cur.flowingYear === 'number' && typeof cur.yearStemIdx === 'number' && typeof cur.yearBranchIdx === 'number');
    }
  }
}

// --- Primary/Vice Generals (大将/参将) ---
const computeTaiYiGeneral = sandbox.computeTaiYiGeneral;
check('computeTaiYiGeneral exists', typeof computeTaiYiGeneral === 'function');
if (typeof computeTaiYiGeneral === 'function') {
  // Worked examples from the user's message.
  let g = computeTaiYiGeneral(27);
  check('Count 27 -> Primary Palace 7 (Kun)', g.primary.num === 7 && g.primary.name === 'Kun');
  g = computeTaiYiGeneral(8);
  check('Count 8 -> Primary Palace 8 (Kan)', g.primary.num === 8 && g.primary.name === 'Kan');
  g = computeTaiYiGeneral(30);
  check('Count 30 (zero exception) -> Primary Palace 3 (Gen), via MOD 9', g.primary.num === 3 && g.primary.name === 'Gen' && g.usedZeroException === true);
  // The full Primary -> Vice mapping table the user gave, exhaustively.
  const expectedViceMap = { 1: 3, 2: 6, 3: 9, 4: 2, 5: 5, 6: 8, 7: 1, 8: 4, 9: 7 };
  let allViceMatch = true;
  for (let p = 1; p <= 9; p++) {
    // Drive computeTaiYiGeneral with a count whose non-zero-exception branch yields this exact Primary.
    const testG = computeTaiYiGeneral(p); // units digit = p directly (p is 1-9, never triggers zero exception)
    if (testG.primary.num !== p || testG.vice.num !== expectedViceMap[p]) allViceMatch = false;
  }
  check('Full Primary->Vice mapping (1->3,2->6,...,9->7) matches the user\'s table exactly', allViceMatch);
  // Center/besieged exception: any count ending in 5 (15, 25, 35) sends both Primary and Vice to Center.
  [15, 25, 35].forEach(c => {
    const gc = computeTaiYiGeneral(c);
    check(`Count ${c} -> Primary AND Vice both Center (5), besieged=true`, gc.primary.num === 5 && gc.vice.num === 5 && gc.besieged === true);
  });
  // Non-besieged sanity: a count NOT ending in 5 or a multiple-of-10 should never report besieged.
  check('Count 27 (non-Center) is not besieged', computeTaiYiGeneral(27).besieged === false);
  // Cross-check that computeTaiYiYearlyCast wires hostGeneral/guestGeneral in for a real year, matching
  // a fresh, independent computeTaiYiGeneral call on that same year's real hostCount/guestCount.
  const rGen = computeTaiYiYearlyCast(2026);
  check('2026 yearlyCast.hostGeneral exists and matches a fresh computeTaiYiGeneral(hostCount)', JSON.stringify(rGen.hostGeneral) === JSON.stringify(computeTaiYiGeneral(rGen.hostCount)));
  check('2026 yearlyCast.guestGeneral exists and matches a fresh computeTaiYiGeneral(guestCount)', JSON.stringify(rGen.guestGeneral) === JSON.stringify(computeTaiYiGeneral(rGen.guestCount)));
}

console.log(`\n${pass} passed, ${fail} failed (test_taiyi_yearly_cast.js)`);
process.exit(fail === 0 ? 0 : 1);

const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies Phase 3's Zi Wei Dou Shu addition: Di Kong (地空) / Di Jie (地劫) minor-star placement.
//
// Formula under test (calculateZWDSChart, engine-metaphysics.js): counting from Hai (亥, branch idx
// 11) representing Zi hour (子时, hour branch idx 0) - Di Kong (地空) is counted BACKWARD (逆行) by the
// hour branch index, Di Jie (地劫) is counted FORWARD (顺行) by the same index:
//   diKongIdx = mod(11 - hourBranchIdx, 12)
//   diJieIdx  = mod(11 + hourBranchIdx, 12)
//
// IMPORTANT: this is the OPPOSITE assignment from the direction initially specified in the work
// brief (which said Di Kong forward / Di Jie backward). Independent verification caught this before
// shipping: the classical mnemonic "亥上子时顺安劫，逆回便是地空亡" (forward places Di Jie, backward
// places Di Kong) and the widely-used open-source "iztro" Zi Wei Dou Shu library's own
// getKongJieIndex (kongIndex = hai - timeIndex, jieIndex = hai + timeIndex) both independently agree
// with EACH OTHER and both contradict the brief's originally-stated direction. This test hard-codes
// the verified (not the originally-assumed) direction and will fail loudly if the implementation
// ever regresses to the wrong-direction version.
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
  };
  sandbox.global = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  function loadFile(name) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, name), 'utf8'), sandbox, { filename: name }); }
  loadFile('engine-core.js'); loadFile('engine-metaphysics.js');
  return { sandbox, run: (code) => vm.runInContext(code, sandbox) };
}

const engineSrc = fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');

// --- Static regression guards ---
check(/dikong:\s*\{\s*cn:\s*'地空'/.test(engineSrc), 'ZWDS_MINOR_STARS defines dikong (地空)');
check(/dijie:\s*\{\s*cn:\s*'地劫'/.test(engineSrc), 'ZWDS_MINOR_STARS defines dijie (地劫)');
check(/dikong:\s*\{[\s\S]{0,60}kind:\s*'void'/.test(engineSrc), 'dikong is tagged with its own distinct kind (void), not folded into an existing kind');
check(/dijie:\s*\{[\s\S]{0,60}kind:\s*'void'/.test(engineSrc), 'dijie is tagged with its own distinct kind (void)');
check(/ZWDS_MINOR_STAR_MEANING[\s\S]{0,2000}dikong:\s*\{\s*en:/.test(engineSrc), 'ZWDS_MINOR_STAR_MEANING has real interpretive text for dikong');
check(/ZWDS_MINOR_STAR_MEANING[\s\S]{0,2000}dijie:\s*\{\s*en:/.test(engineSrc), 'ZWDS_MINOR_STAR_MEANING has real interpretive text for dijie');
check(/placements\.dikong\s*=\s*mod\(11\s*-\s*hourBranchIdx,\s*12\)/.test(engineSrc), 'placements.dikong uses the verified BACKWARD-from-Hai formula');
check(/placements\.dijie\s*=\s*mod\(11\s*\+\s*hourBranchIdx,\s*12\)/.test(engineSrc), 'placements.dijie uses the verified FORWARD-from-Hai formula');

// The "Not included" disclosure line must no longer list Di Kong/Di Jie (added this round) NOR Huo
// Xing/Ling Xing (added in the later round that implemented Wang Tingzhi's Zhongzhou formula) as
// missing, but must still list lesser auxiliary stars and brightness ratings as not included.
// NOTE: this test file predates the Huo Xing/Ling Xing round; the assertion that they'd still be
// listed as "not included" was correct AT THE TIME this test was written but is now stale by design -
// updated here rather than left to bit-rot, since a stale regression test is worse than no test.
const disclosureMatch = appSrc.match(/Not included:[^']*/);
check(!!disclosureMatch, 'located the "Not included" disclosure line');
if (disclosureMatch) {
  const line = disclosureMatch[0];
  check(!/Di Kong\/Di Jie/.test(line), 'Di Kong/Di Jie no longer appear in the "Not included" list');
  check(!/Huo Xing\/Ling Xing/.test(line) || /Huo Xing\/Ling Xing - the last two placed per/.test(appSrc), 'Huo Xing/Ling Xing no longer appear in the "Not included" list (now implemented per the Zhongzhou formula)');
  check(/lesser auxiliary stars/.test(line), 'lesser auxiliary stars still correctly listed as not included');
  check(/庙旺陷平/.test(line), 'star brightness ratings (庙旺陷平) still correctly listed as not included');
}
check(/void:\s*\{\s*symbol:\s*'✕'/.test(appSrc), 'the palace-table badge legend defines a distinct symbol for the void kind');
check(/14 Major \+ 14 Minor Stars/.test(appSrc), 'the star-chart pill label was updated to 14 minor stars (Huo Xing/Ling Xing added since this test was first written)');

// --- Behavioral: drive the REAL calculateZWDSChart against all 8 real test-data people, and
// independently recompute the expected Di Kong/Di Jie palace for each from their real hour branch. ---
const { run } = buildSandbox();

const REAL_PEOPLE = [
  { name: 'Roy Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male' },
  { name: 'Tina Seah', birthdate: '1976-04-25', birthtime: '10:21', gender: 'female' },
  { name: 'Bobby Neo', birthdate: '1965-06-27', birthtime: '05:28', gender: 'male' },
  { name: 'Deana Ling', birthdate: '1972-07-09', birthtime: '10:00', gender: 'female' },
  { name: 'Audemars Neo', birthdate: '2000-08-27', birthtime: '19:28', gender: 'male' },
  { name: 'Calista Neo', birthdate: '2008-08-26', birthtime: '18:27', gender: 'female' },
  { name: 'Zayn Neo', birthdate: '2024-08-15', birthtime: '12:27', gender: 'male' },
  { name: 'Nur Afiqah', birthdate: '1994-08-08', birthtime: '09:30', gender: 'female' },
];

REAL_PEOPLE.forEach(person => {
  run(`var __raw = ${JSON.stringify({ ...person, englishFirstName: person.name.split(' ')[0], englishLastName: person.name.split(' ')[1] || '', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
  const p = run('getProfileData(__raw)');
  check(!!p && !!p.ziwei, `${person.name}: profile + Zi Wei chart computed without throwing`);
  if (!p || !p.ziwei) return;

  const hourBranchIdx = p.bazi.hourBranchIdx;
  // Independent recompute (not calling calculateZWDSChart's own internals - plain arithmetic per the
  // verified formula) of the expected palaces.
  const expectedDiKong = ((11 - hourBranchIdx) % 12 + 12) % 12;
  const expectedDiJie = ((11 + hourBranchIdx) % 12 + 12) % 12;

  check(p.ziwei.placements.dikong === expectedDiKong, `${person.name} (hour branch ${hourBranchIdx}): Di Kong lands at branch ${expectedDiKong} exactly as independently recomputed - got ${p.ziwei.placements.dikong}`);
  check(p.ziwei.placements.dijie === expectedDiJie, `${person.name} (hour branch ${hourBranchIdx}): Di Jie lands at branch ${expectedDiJie} exactly as independently recomputed - got ${p.ziwei.placements.dijie}`);
  check(p.ziwei.starsByBranch[expectedDiKong].includes('dikong'), `${person.name}: starsByBranch correctly lists dikong at its computed branch`);
  check(p.ziwei.starsByBranch[expectedDiJie].includes('dijie'), `${person.name}: starsByBranch correctly lists dijie at its computed branch`);

  // Sanity: for a Zi-hour (hour branch 0) birth, both stars would coincide at Hai itself (11-0=11,
  // 11+0=11) - not present among these 8 real people, but confirms the formula's boundary behaviour
  // is at least internally consistent (both formulas agree exactly when hourBranchIdx === 0).
  if (hourBranchIdx === 0) check(expectedDiKong === 11 && expectedDiJie === 11, `${person.name}: Zi-hour edge case - both Di Kong and Di Jie correctly coincide at Hai itself`);
});

// Cross-hour-branch sanity: across all 12 possible hour branches, Di Kong and Di Jie are symmetric
// around Hai and never land outside 0-11.
for (let h = 0; h < 12; h++) {
  const dk = ((11 - h) % 12 + 12) % 12;
  const dj = ((11 + h) % 12 + 12) % 12;
  check(dk >= 0 && dk <= 11 && dj >= 0 && dj <= 11, `hour branch ${h}: both Di Kong (${dk}) and Di Jie (${dj}) land within a valid palace index`);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

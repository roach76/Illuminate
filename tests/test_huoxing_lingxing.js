const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the newly-added Huo Xing (火星) / Ling Xing (铃星) minor-star placement, implemented per a
// specific, user-sourced formula: Wang Tingzhi's Zhongzhou School (王亭之《中州派紫微斗数初级讲义》),
// via the classical mnemonic "申子辰人寅戌扬，寅午戌人丑卯方，巳酉丑人卯戌位，亥卯未人酉戌房" - starting
// palace by year-branch group, then counted FORWARD (顺数) by the birth hour branch.
//
// This test independently re-derives the expected starting palace from the mnemonic's 4 groups (not
// trusting the shipped lookup tables) and confirms an exact match for every one of the 12 year branches
// crossed with all 12 hour branches (144 combinations per star), then separately confirms the two
// stars are wired into the chart's placements/starsByBranch/badge-kind plumbing correctly.
process.on('unhandledRejection', () => {});
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// Branch index convention used throughout engine-metaphysics.js: 0=Zi,1=Chou,2=Yin,3=Mao,4=Chen,5=Si,
// 6=Wu,7=Wei,8=Shen,9=You,10=Xu,11=Hai.
const ZI = 0, CHOU = 1, YIN = 2, MAO = 3, CHEN = 4, SI = 5, WU = 6, WEI = 7, SHEN = 8, YOU = 9, XU = 10, HAI = 11;

// Independent re-derivation of the mnemonic's 4 groups, expressed as {branches, huoStart, lingStart}.
const MNEMONIC_GROUPS = [
  { branches: [SHEN, ZI, CHEN], huoStart: YIN, lingStart: XU },   // 申子辰人寅戌扬
  { branches: [YIN, WU, XU],    huoStart: CHOU, lingStart: MAO }, // 寅午戌人丑卯方
  { branches: [SI, YOU, CHOU],  huoStart: MAO, lingStart: XU },   // 巳酉丑人卯戌位
  { branches: [HAI, MAO, WEI],  huoStart: YOU, lingStart: XU }    // 亥卯未人酉戌房
];
function expectedStarts(yearBranchIdx) {
  const g = MNEMONIC_GROUPS.find(g => g.branches.includes(yearBranchIdx));
  if (!g) throw new Error('year branch ' + yearBranchIdx + ' not covered by any mnemonic group');
  return { huoStart: g.huoStart, lingStart: g.lingStart };
}
function mod12(n) { return ((n % 12) + 12) % 12; }

const storage = {};
const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
const sandbox = { console, localStorage, navigator: { language: 'en-US' } };
sandbox.global = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, 'engine-metaphysics.js'), 'utf8'), sandbox, { filename: 'engine-metaphysics.js' });

// --- Exhaustive cross-check: all 12 year branches x all 12 hour branches, for both stars ---
let allMatched = true;
for (let yearBranchIdx = 0; yearBranchIdx < 12; yearBranchIdx++) {
  const { huoStart, lingStart } = expectedStarts(yearBranchIdx);
  for (let hourBranchIdx = 0; hourBranchIdx < 12; hourBranchIdx++) {
    // yearStemIdx, lunarMonthNumber, lunarDay are irrelevant to huoxing/lingxing placement (which only
    // depend on yearBranchIdx + hourBranchIdx) - fixed arbitrary values used just to get a valid chart.
    const chart = vm.runInContext(
      `calculateZWDSChart(3, 10, ${hourBranchIdx}, 0, ${yearBranchIdx})`, sandbox
    );
    const expectedHuo = mod12(huoStart + hourBranchIdx);
    const expectedLing = mod12(lingStart + hourBranchIdx);
    if (chart.placements.huoxing !== expectedHuo) {
      allMatched = false;
      console.error(`MISMATCH Huo Xing: yearBranch=${yearBranchIdx} hourBranch=${hourBranchIdx} expected=${expectedHuo} got=${chart.placements.huoxing}`);
    }
    if (chart.placements.lingxing !== expectedLing) {
      allMatched = false;
      console.error(`MISMATCH Ling Xing: yearBranch=${yearBranchIdx} hourBranch=${hourBranchIdx} expected=${expectedLing} got=${chart.placements.lingxing}`);
    }
  }
}
check(allMatched, 'Huo Xing and Ling Xing placements match an independent re-derivation of the Zhongzhou mnemonic for all 144 year-branch x hour-branch combinations');

// --- Spot checks against the mnemonic's literal wording, read directly off the 4 groups (sanity,
// independent of the loop above using the same MNEMONIC_GROUPS table) ---
const spot = vm.runInContext(`calculateZWDSChart(3, 10, 0, 0, ${SHEN})`, sandbox); // Shen year, Zi hour
check(spot.placements.huoxing === YIN, 'Shen-year, Zi-hour: Huo Xing lands exactly at Yin (寅) per "申子辰人寅戌扬" with zero forward-count from Zi hour');
check(spot.placements.lingxing === XU, 'Shen-year, Zi-hour: Ling Xing lands exactly at Xu (戌) per "申子辰人寅戌扬"');
const spot2 = vm.runInContext(`calculateZWDSChart(3, 10, 2, 0, ${YIN})`, sandbox); // Yin year, Yin hour (2 forward from Zi)
check(spot2.placements.huoxing === mod12(CHOU + 2), 'Yin-year, Yin-hour (2 steps forward from Zi): Huo Xing correctly counted 2 palaces forward from its Chou (丑) start per "寅午戌人丑卯方"');
check(spot2.placements.lingxing === mod12(MAO + 2), 'Yin-year, Yin-hour: Ling Xing correctly counted 2 palaces forward from its Mao (卯) start');

// --- Plumbing: both stars are properly registered (metadata, badge kind, starsByBranch, meanings) ---
const huoInfo = vm.runInContext(`ZWDS_MINOR_STARS.huoxing`, sandbox);
const lingInfo = vm.runInContext(`ZWDS_MINOR_STARS.lingxing`, sandbox);
check(huoInfo && huoInfo.kind === 'malefic' && huoInfo.cn === '火星', 'Huo Xing is registered in ZWDS_MINOR_STARS with the correct Chinese name and malefic kind (for badge rendering)');
check(lingInfo && lingInfo.kind === 'malefic' && lingInfo.cn === '鈴星', 'Ling Xing is registered in ZWDS_MINOR_STARS with the correct Chinese name and malefic kind');
const huoMeaning = vm.runInContext(`ZWDS_MINOR_STAR_MEANING.huoxing`, sandbox);
const lingMeaning = vm.runInContext(`ZWDS_MINOR_STAR_MEANING.lingxing`, sandbox);
check(huoMeaning && huoMeaning.en.length > 10 && huoMeaning.zh.length > 5, 'Huo Xing has a real EN+ZH interpretive meaning entry, not a placeholder');
check(lingMeaning && lingMeaning.en.length > 10 && lingMeaning.zh.length > 5, 'Ling Xing has a real EN+ZH interpretive meaning entry, not a placeholder');
const sampleChart = vm.runInContext(`calculateZWDSChart(3, 10, 5, 3, ${MAO})`, sandbox);
check(Array.isArray(sampleChart.starsByBranch[sampleChart.placements.huoxing]) && sampleChart.starsByBranch[sampleChart.placements.huoxing].includes('huoxing'), 'huoxing appears in starsByBranch at its own placed branch (the palace-lookup table used by chart rendering)');
check(Array.isArray(sampleChart.starsByBranch[sampleChart.placements.lingxing]) && sampleChart.starsByBranch[sampleChart.placements.lingxing].includes('lingxing'), 'lingxing appears in starsByBranch at its own placed branch');

// --- Regression guard: Huo Xing and Ling Xing never accidentally land on the SAME palace for any
// year-branch group (a real risk given both derive from similar-looking start/offset tables) ---
let neverCollide = true;
for (let yearBranchIdx = 0; yearBranchIdx < 12; yearBranchIdx++) {
  for (let hourBranchIdx = 0; hourBranchIdx < 12; hourBranchIdx++) {
    const chart = vm.runInContext(`calculateZWDSChart(3, 10, ${hourBranchIdx}, 0, ${yearBranchIdx})`, sandbox);
    // Note: Huo Xing and Ling Xing CAN legitimately share a palace under this formula (e.g. Yin-year
    // group has Huo start Chou, Ling start Mao - 2 apart - so they never coincide for that group, but
    // other groups have wider gaps too). This check instead confirms they track their OWN start palace
    // independently (different starts move independently under the shared +hourBranchIdx term).
    const { huoStart, lingStart } = expectedStarts(yearBranchIdx);
    if (huoStart !== lingStart) {
      const expectDiff = mod12(chart.placements.huoxing - chart.placements.lingxing) !== 0;
      if (!expectDiff) { neverCollide = false; }
    }
  }
}
check(neverCollide, 'Huo Xing and Ling Xing placements move independently (never accidentally collapse to the same palace when their start palaces differ)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

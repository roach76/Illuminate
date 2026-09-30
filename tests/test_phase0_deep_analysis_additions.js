const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies two more Phase 0 fixes from this round's large issue list:
// 1. "There should be short descriptions on every item on what it is, not just the header" (Luan Tou
//    specifically had real descriptive text, but it only ever appeared inside the full "Deep Analysis"
//    expansion) - a new getTopicShortDescription() helper surfaces the exact same text inline, next to
//    the header, without hand-duplicating it.
// 2. "No deep-reading detail exists for the Flying Star temporal overlay" and "the Flying Star property
//    calculator also lacks deep analysis - Go Deep" - two new generateDeepAnalysisData branches
//    (flyingstar_property, flyingstar_temporal) that read the ACTUAL computed chart/overlay numbers
//    (not generic boilerplate) against a documented star-nature reference table.
const fs = require('fs');
const vm = require('vm');
const appSrc = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// --- Static checks ---
check(/function getTopicShortDescription\(type, p, extraData = null\)/.test(appSrc), 'getTopicShortDescription helper exists');
check(/getTopicShortDescription\('luantou', p, \{title: 'Luan Tou Form School Deep Analysis'\}\)/.test(appSrc), 'BUG FIX VERIFIED: Luan Tou call site now renders a short description via the new helper');
check(/type === 'flyingstar_property' && extraData && extraData\.chart/.test(appSrc), 'a flyingstar_property deep-analysis branch exists, gated on real chart data being passed in');
check(/type === 'flyingstar_temporal' && extraData && extraData\.overlay/.test(appSrc), 'a flyingstar_temporal deep-analysis branch exists, gated on a real overlay being passed in');
check(/generateDeepAnalysisData\('flyingstar_property', p, \{ title: 'Flying Star Property Deep Analysis', chart, constructionYear, facingDir \}\)/.test(appSrc), 'renderFlyingStarResult wires the property chart into its own deep analysis');
check(/generateDeepAnalysisData\('flyingstar_temporal', p, \{ title: 'Flying Star Temporal Overlay Deep Analysis', overlay \}\)/.test(appSrc), 'renderFlyingStarTemporalOverlay wires the real overlay into its own deep analysis');

// --- Behavioural checks: extract generateDeepAnalysisData + its direct dependencies verbatim and run them. ---
const fnStart = appSrc.indexOf('function generateDeepAnalysisData(type, p, extraData = null, rawOnly = false) {');
const fnEnd = appSrc.indexOf('\nfunction ratingColor', fnStart);
const block = appSrc.slice(fnStart, fnEnd);

const fakeStorage = {};
const sandbox = {
  console, Math, Date, JSON, Array, Object, String, Number,
  localStorage: { getItem: (k) => (k in fakeStorage ? fakeStorage[k] : null), setItem: (k, v) => { fakeStorage[k] = String(v); }, removeItem: (k) => { delete fakeStorage[k]; } },
};
sandbox.global = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
sandbox.lang = 'en';
vm.runInContext(fs.readFileSync((__PROJECT_ROOT__ + '/engine-core.js'), 'utf8'), sandbox, { filename: 'engine-core.js' });
vm.runInContext(fs.readFileSync((__PROJECT_ROOT__ + '/engine-metaphysics.js'), 'utf8'), sandbox, { filename: 'engine-metaphysics.js' });
vm.runInContext(`function bt(en, zh) { return (lang === 'zh' && zh) ? zh : en; }`, sandbox);
vm.runInContext(block, sandbox, { filename: 'generateDeepAnalysisData-block.js' });

let threw = null;
try {
  // Luan Tou: short description should be non-empty and mention the real distinguishing content
  // (Ba Zhai vs Luan Tou), not generic boilerplate, and should match the full block's own "chars" text.
  const luanP = { kuaGroup: 'East' };
  const luanShort = vm.runInContext(`getTopicShortDescription('luantou', p)`, Object.assign(sandbox, { p: luanP }));
  check(typeof luanShort === 'string' && luanShort.length > 20, 'Luan Tou short description returns real, non-trivial text');
  check(luanShort.includes('Luan Tou') && luanShort.includes('Kua'), 'Luan Tou short description is genuinely topic-specific (mentions Luan Tou and the person\'s own Kua group), not generic boilerplate');
  const luanRaw = vm.runInContext(`generateDeepAnalysisData('luantou', p, null, true)`, sandbox);
  check(luanRaw.chars === luanShort, 'the short description is the SAME text used inside the full Deep Analysis block (single source of truth, not a hand-duplicated copy)');

  // Flying Star property calculator deep analysis: build a real chart via the real engine and confirm
  // the reading reflects the ACTUAL numbers computed for that chart, not placeholder text.
  const chart = vm.runInContext(`computeFlyingStarChart(2015, 'N')`, sandbox);
  const propP = { kuaGroup: 'East' };
  const propRaw = vm.runInContext(`generateDeepAnalysisData('flyingstar_property', p, { title: 't', chart: chartVar, constructionYear: 2015, facingDir: 'N' }, true)`, Object.assign(sandbox, { p: propP, chartVar: chart }));
  check(typeof propRaw.chars === 'string' && propRaw.chars.includes(`Period ${chart.period}`), 'property deep-analysis "chars" cites the real computed Period number, not a made-up one');
  const facingPalace = chart.palaces[chart.facingDirection];
  check(propRaw.chars.includes(String(facingPalace.mountain)) && propRaw.chars.includes(String(facingPalace.facing)), 'property deep-analysis cites the real computed Mountain/Facing star numbers at the actual facing palace');
  check(Array.isArray(propRaw.hl) && propRaw.hl.length >= 2, 'property deep-analysis produces real highlight bullets, not an empty/generic list');

  // Flying Star temporal overlay deep analysis: confirm it correctly finds the real palace the Five
  // Yellow (5) and the Wealth Star (8) occupy in a synthetic overlay, rather than a fixed/made-up palace.
  const fakeOverlay = {
    annual: { chart: { N:5, NE:8, E:1, SE:2, S:3, SW:4, W:6, NW:7, center:9 }, year: 2026 },
    monthly: { chart: { N:1, NE:2, E:5, SE:3, S:8, SW:4, W:6, NW:7, center:9 }, year: 2026, month: 9 },
    daily: { chart: { N:1, NE:2, E:3, SE:4, S:5, SW:6, W:7, NW:8, center:9 }, seed: 9, governingTerm: 'Bai Lu' },
  };
  const temporalRaw = vm.runInContext(`generateDeepAnalysisData('flyingstar_temporal', p, { title: 't', overlay: ov }, true)`, Object.assign(sandbox, { p: propP, ov: fakeOverlay }));
  // The deep-analysis modal has room, so (unlike the cramped grid cells) it spells out full direction
  // words - North/Northeast/East - via FLYING_STAR_DIR_LABEL_EN, same as the narrative sentence above.
  check(/Five Yellow currently occupies North\b/.test(temporalRaw.chars), 'BUG FIX VERIFIED: temporal deep-analysis correctly locates the Annual Five Yellow at North (N) in this synthetic overlay (not a hardcoded direction)');
  check(/Wealth Star 8 currently occupies Northeast\b/.test(temporalRaw.chars), 'temporal deep-analysis correctly locates the Annual Wealth Star 8 at Northeast (NE)');
  check(/Monthly Five Yellow occupies East\b/.test(temporalRaw.chars), 'temporal deep-analysis correctly locates the (differently-positioned) Monthly Five Yellow at East (E), proving it reads Monthly separately from Annual');
} catch (e) { threw = e; }
check(!threw, 'test completed without throwing: ' + (threw && (threw.stack || threw.message)));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

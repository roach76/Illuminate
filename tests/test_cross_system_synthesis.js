const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this round's enhancement (the 3rd and final follow-on item scoped after the astro_compat %
// fix, completed per "proceed to complete all pending items" - originally requested directly: "The
// profile readings and charts for all needs to take into account all aspects of metaphysics calculations
// in the app, chinese, western, etc"): a new "Cross-System Profile Synthesis" reading that cross-
// references BaZi (Ten Gods), Zi Wei Dou Shu (palace/star placement), Qi Men Dun Jia (Door domains), and
// Western astrology (Sun/Venus sign) for the same 3 real-world domains (Career/Wealth/Relationships) -
// see app.js (computeCrossSystemSynthesis / generateCrossSystemSynthesisHTML / the cross_system_synthesis
// deep-analysis branch). Per the standing "nothing half baked, all must be factual and defensible"
// instruction, this deliberately reuses only already-verified functions/tables (computeAllTenGods,
// ZWDS_PALACE_NAMES_BY_STEP_BACK/starsByBranch, QMDJ's wealthPalace/lifeDoor, SIGN_PROFILE_TABLE) and
// never claims fabricated cross-framework "agreement" or a blended score.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const sandbox = { console, navigator: { language: 'en-US' }, document: dom.window.document, window: dom.window, alert: () => {}, requestAnimationFrame: (fn) => setTimeout(fn, 0) };
sandbox.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
sandbox.global = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
function run(code) { return vm.runInContext(code, sandbox); }

let loadThrew = null;
try { load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('auth.js'); load('app.js'); }
catch (e) { loadThrew = e; }
check(!loadThrew, `all 5 app files load cleanly together${loadThrew ? ': ' + loadThrew.message : ''}`);

const appSrc = fs.readFileSync(path.join(PROJECT_DIR, 'app.js'), 'utf8');
check(/function computeCrossSystemSynthesis\(/.test(appSrc), 'computeCrossSystemSynthesis() exists');
check(/function generateCrossSystemSynthesisHTML\(/.test(appSrc), 'generateCrossSystemSynthesisHTML() exists');
check(/cross_system_synthesis/.test(appSrc), 'the cross_system_synthesis deep-analysis branch is wired in');
check(/artCrossSystemSynthesis/.test(appSrc), 'the new section is wired into a tab group');

run(`var __raw = ${JSON.stringify({ englishFirstName: 'Roy', englishLastName: 'Wong', birthdate: '1976-09-07', birthtime: '09:33', gender: 'male', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var p = getProfileData(__raw);');

let synThrew = null, syn = null;
try { syn = run('var syn = computeCrossSystemSynthesis(p); syn'); } catch (e) { synThrew = e; }
check(!synThrew, `computeCrossSystemSynthesis runs without throwing${synThrew ? ': ' + synThrew.message : ''}`);
check(!!syn, 'computeCrossSystemSynthesis returns a real object for a full profile');

// Structural checks: all 3 domains present with all 4 systems represented (qmdj may be null for
// career/relationships - that's an honest, documented gap, not a bug)
['career', 'wealth', 'relationships'].forEach(dom => {
  check(!!syn[dom], `synthesis has a "${dom}" domain`);
  check(!!syn[dom].bazi, `${dom} domain has a bazi signal`);
  check(!!syn[dom].ziwei && Array.isArray(syn[dom].ziwei.stars), `${dom} domain has a ziwei signal with a stars array`);
  check(!!syn[dom].western, `${dom} domain has a western signal`);
});
check(!!syn.wealth.qmdj, 'wealth domain ALWAYS has a qmdj signal (the Wealth Palace door is always present)');
check(typeof syn.wealth.qmdj.wealthPalace === 'number', 'wealth.qmdj.wealthPalace is a real palace number');
check(!!syn.qmdjLifeDoorGeneral && !!syn.qmdjLifeDoorGeneral.door, 'a general qmdjLifeDoorGeneral note is always present');

// BaZi Ten God family counts are internally consistent: career=officer family, wealth=wealth family,
// and the SAME dominantFamily/dominantTheme is reported identically across career/wealth (whole-chart
// property, not domain-specific)
check(syn.career.bazi.dominantFamily === syn.wealth.bazi.dominantFamily, 'dominantFamily (a whole-chart property) is identical whether read from career or wealth');
check(['officer','wealth','output','resource','peer'].includes(syn.career.bazi.dominantFamily), 'dominantFamily is one of the 5 real classical Ten God families');
check(syn.career.bazi.count === syn.career.bazi.gods.length, 'career bazi.count matches the length of its own gods array');
check(syn.wealth.bazi.count === syn.wealth.bazi.gods.length, 'wealth bazi.count matches the length of its own gods array');

// Relationships domain uses the Day Branch specifically (a distinct, real BaZi convention - the
// classical "Spouse Palace" - not the whole-chart family tally used for career/wealth)
check(Array.isArray(syn.relationships.bazi.dayBranchTenGods), 'relationships.bazi.dayBranchTenGods is an array');
check(typeof syn.relationships.bazi.dayBranchCN === 'string' && syn.relationships.bazi.dayBranchCN.length === 1, 'relationships.bazi.dayBranchCN is a single Chinese branch character');

// Western Venus-based wealth signal is genuinely computed (not hardcoded) - re-derive independently and cross-check
const independentCheck = run(`
  (function(){
    var chart = computeFullNatalChart(p.bazi.birthMomentUTC);
    var venusSign = chart.venus.sign.en;
    var elem = ZODIAC_ELEMENT_MODALITY[venusSign].element;
    return { venusSign: venusSign, elem: elem };
  })()
`);
check(syn.wealth.western.venusSign === independentCheck.venusSign, 'wealth.western.venusSign matches an independently-recomputed natal Venus sign');
check(syn.wealth.western.venusElement === independentCheck.elem, 'wealth.western.venusElement matches an independently-recomputed Element lookup');

// QMDJ Door-to-domain mapping only ever assigns ONE of career/relationships (never both) for any single
// profile, since a person has exactly one natal Life Door
check(!(syn.career.qmdj && syn.relationships.qmdj), 'the Life Door never maps to both Career AND Relationships for the same profile (it has one real door)');

// --- Rendering ---
let renderThrew = null, html = null;
try { html = run('generateCrossSystemSynthesisHTML(p)'); } catch (e) { renderThrew = e; }
check(!renderThrew, `generateCrossSystemSynthesisHTML runs without throwing${renderThrew ? ': ' + renderThrew.message : ''}`);
check(typeof html === 'string' && html.length > 200, 'generateCrossSystemSynthesisHTML returns real, substantial HTML');
check(/Career|事业/.test(html), 'rendered HTML mentions Career');
check(/Wealth|财富/.test(html), 'rendered HTML mentions Wealth');
check(/Relationships|人际关系/.test(html), 'rendered HTML mentions Relationships');
check(/Ten God|十神/.test(html), 'rendered HTML references Ten Gods');
check(/does NOT claim|刻意不宣称/.test(html), 'rendered HTML includes the explicit non-fabrication honesty disclosure');
check(!/undefined/i.test(html), 'rendered HTML contains no literal "undefined" text');

// Deep-analysis branch renders cleanly (rawOnly) in both languages, with no "undefined" leakage
let deepThrew = null, deepEn = null, deepZh = null;
try {
  deepEn = JSON.stringify(run(`generateDeepAnalysisData('cross_system_synthesis', p, { title: 'test', synthesis: syn }, true)`));
  run(`lang = 'zh';`);
  deepZh = JSON.stringify(run(`generateDeepAnalysisData('cross_system_synthesis', p, { title: 'test', synthesis: syn }, true)`));
  run(`lang = 'en';`);
} catch (e) { deepThrew = e; }
check(!deepThrew, `cross_system_synthesis deep-analysis branch renders in both languages${deepThrew ? ': ' + deepThrew.message : ''}`);
check(!/undefined/i.test(deepEn), 'EN deep-analysis output has no literal "undefined"');
check(!/undefined/i.test(deepZh), 'ZH deep-analysis output has no literal "undefined"');
check(/dominant Ten God family|主导的十神类别/.test(deepEn + deepZh), 'deep-analysis mentions the dominant Ten God family');

// A second, different profile produces genuinely different synthesis data (not a fixed template)
run(`var __raw2 = ${JSON.stringify({ englishFirstName: 'Jane', englishLastName: 'Tan', birthdate: '1980-03-15', birthtime: '14:20', gender: 'female', birthLocation: 'Singapore', birthLongitude: 103.8198, birthTimezone: 8 })};`);
run('var p2 = getProfileData(__raw2); var syn2 = computeCrossSystemSynthesis(p2);');
const syn2Check = run('JSON.stringify({c:syn2.career.bazi.count, w:syn2.wealth.bazi.count, sign:syn2.career.western.sign})');
const syn1Check = run('JSON.stringify({c:syn.career.bazi.count, w:syn.wealth.bazi.count, sign:syn.career.western.sign})');
check(syn2Check !== syn1Check, `two different profiles produce genuinely different synthesis signals - got ${syn1Check} vs ${syn2Check}`);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

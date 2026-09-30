const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for item 2 of the "re-examine all compatibility scoring and deep analysis, ensure
// nothing is half baked" audit: the QMDJ door deep-analysis text (generateDeepAnalysisData, type
// 'qmdj_door') used to produce near word-for-word identical Positives/Negatives/Cautions/Remedies text
// for all 3 Auspicious doors (and separately for all 3 Caution doors), varying only the door's own
// name - confirmed directly in a real 58-page PDF export the user attached. Fix: QMDJ_DOOR_DOMAIN now
// supplies each door's real traditional governing domain, woven into every part of the text, so no two
// doors of the same tier read identically anymore.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const PROJECT_DIR = (__PROJECT_ROOT__ + '');
let passed = 0, failed = 0;
function check(cond, msg) { if (cond) passed++; else { failed++; console.log('FAIL: ' + msg); } }

const dom = new JSDOM(fs.readFileSync(path.join(PROJECT_DIR, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
const storage = {};
const localStorage = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } };
const sandbox = {
  console, localStorage, navigator: { language: 'en-US' },
  document: dom.window.document, window: dom.window,
  setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, Number, Map, Set, Promise, RegExp,
  URL: dom.window.URL, alert: () => {}, confirm: () => true,
};
sandbox.global = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
function load(f) { vm.runInContext(fs.readFileSync(path.join(PROJECT_DIR, f), 'utf8'), sandbox, { filename: f }); }
load('engine-core.js'); load('engine-metaphysics.js'); load('engine-predictions.js'); load('app.js'); load('auth.js');

// Minimal fake profile - generateDeepAnalysisData('qmdj_door', p, extraData) doesn't read much off `p`
// for this branch, so an empty object is enough to exercise the branch in isolation.
vm.runInContext(`globalThis.__testP = {};`, sandbox);

function buildDoorAnalysis(door, isGood, dirLabel, pal) {
  // rawOnly=true returns the underlying {chars, exp, traits, hl, pos, neg, cau, opts} data directly,
  // instead of a "View Details" button whose actual content only lives in deepAnalysisRegistry - this
  // is both the more direct thing to test and avoids polluting that registry with test-only entries.
  const data = vm.runInContext(`generateDeepAnalysisData('qmdj_door', globalThis.__testP, ${JSON.stringify({ door, isGood, dirLabel, pal })}, true)`, sandbox);
  return [data.chars, data.exp, data.traits, ...(data.hl||[]), ...(data.pos||[]), ...(data.neg||[]), ...(data.cau||[]), ...((data.opts&&data.opts.remedies)||[])].join(' | ');
}

const auspiciousDoors = ['Kai Men (开门)', 'Xiu Men (休门)', 'Sheng Men (生门)'];
const cautionDoors = ['Shang Men (伤门)', 'Si Men (死门)', 'Jing Men (惊门)'];

const auspiciousHTML = auspiciousDoors.map((door, i) => buildDoorAnalysis(door, true, 'North', i + 1));
const cautionHTML = cautionDoors.map((door, i) => buildDoorAnalysis(door, false, 'South', i + 4));

// Strip out the door name and palace/direction placeholders so we're comparing only the SURROUNDING
// prose - if two doors' prose is identical even after removing their own names, the boilerplate bug
// is still present.
function stripIdentifying(html, door, dirLabel, pal) {
  return html.split(door).join('DOOR').split(dirLabel).join('DIR').split(String(pal)).join('PAL');
}
const auspiciousStripped = auspiciousDoors.map((door, i) => stripIdentifying(auspiciousHTML[i], door, 'North', i + 1));
const cautionStripped = cautionDoors.map((door, i) => stripIdentifying(cautionHTML[i], door, 'South', i + 4));

check(auspiciousStripped[0] !== auspiciousStripped[1], 'BUG FIX VERIFIED: Kai Men and Xiu Men (both Auspicious) no longer produce identical deep-analysis prose once their own names are stripped out');
check(auspiciousStripped[0] !== auspiciousStripped[2], 'BUG FIX VERIFIED: Kai Men and Sheng Men (both Auspicious) no longer produce identical deep-analysis prose');
check(auspiciousStripped[1] !== auspiciousStripped[2], 'BUG FIX VERIFIED: Xiu Men and Sheng Men (both Auspicious) no longer produce identical deep-analysis prose');
check(cautionStripped[0] !== cautionStripped[1], 'BUG FIX VERIFIED: Shang Men and Si Men (both Caution) no longer produce identical deep-analysis prose');
check(cautionStripped[0] !== cautionStripped[2], 'BUG FIX VERIFIED: Shang Men and Jing Men (both Caution) no longer produce identical deep-analysis prose');
check(cautionStripped[1] !== cautionStripped[2], 'BUG FIX VERIFIED: Si Men and Jing Men (both Caution) no longer produce identical deep-analysis prose');

// Each door's own real traditional domain should actually appear in its own analysis.
check(auspiciousHTML[0].includes('officialdom'), 'Kai Men analysis names its real domain (officialdom/new ventures)');
check(auspiciousHTML[1].includes('romance') || auspiciousHTML[1].includes('recuperation'), 'Xiu Men analysis names its real domain (rest/romance)');
check(auspiciousHTML[2].includes('wealth') || auspiciousHTML[2].includes('investment'), 'Sheng Men analysis names its real domain (wealth/investment)');
check(cautionHTML[0].includes('confrontational') || cautionHTML[0].includes('dispute'), 'Shang Men analysis names its real domain (confrontation/disputes)');
check(cautionHTML[1].includes('health') || cautionHTML[1].includes('commitments'), 'Si Men analysis names its real domain (major commitments/health)');
check(cautionHTML[2].includes('legal') || cautionHTML[2].includes('shocks'), 'Jing Men analysis names its real domain (legal/sudden shocks)');

// Sanity: still produces well-formed output (a real string, non-trivial length) for every door.
[...auspiciousHTML, ...cautionHTML].forEach((html, i) => {
  check(typeof html === 'string' && html.length > 200, `door analysis #${i} is a substantial, well-formed string (length ${html && html.length})`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;

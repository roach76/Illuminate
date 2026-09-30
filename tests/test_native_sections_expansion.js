const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the 4 sections added two rounds ago that are still part of the current spec (Name
// Analysis, I Ching, Numerology, Western Astrology), each using the correct generateDeepAnalysisData
// type key and rawOnly=true.
//
// NOTE: the previous version of this test also checked for a standalone "Qi Men Dun Jia" section and
// a manually-gated "Ba Zhai (Feng Shui)" section. Both were deliberately REPLACED in the following
// round once Roy specified the full 18-item section sequence: QMDJ has no standalone section in that
// spec (its data still surfaces in the Summary Information tiles), and Ba Zhai is now folded into the
// comprehensive "Feng Shui" section (which reuses the live app's own Feng Shui tab HTML, covering Ba
// Zhai + Flying Star + Luan Tou together) - see test_native_section_order.js for that section's own
// coverage. Removing the stale assertions here (rather than leaving them failing) reflects that
// deliberate change instead of masking it as a regression.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const fnStart = src.indexOf('function buildNativeProfileSections(prefix)');
const fnEnd = src.indexOf('\nasync function exportProfileToPdf', fnStart);
const fnBody = src.slice(fnStart, fnEnd);

check(fnStart !== -1 && fnEnd !== -1 && fnEnd > fnStart, 'buildNativeProfileSections function located');

const expectations = [
  { title: "bt('Name Analysis'", type: "generateDeepAnalysisData('name', p," },
  { title: "bt('I Ching'", type: "generateDeepAnalysisData('iching', p," },
  { title: "bt('Numerology'", type: "generateDeepAnalysisData('numerology', p," },
  { title: "bt('Western Astrology'", type: "generateDeepAnalysisData('astro', p," },
];
expectations.forEach(({ title, type }) => {
  check(fnBody.includes(title), `section title present: ${title}`);
  check(fnBody.includes(type), `correct generateDeepAnalysisData call present: ${type}`);
  check(fnBody.includes(type) && fnBody.slice(fnBody.indexOf(type), fnBody.indexOf(type) + 200).includes(', true)'),
    `${type} passes rawOnly=true (native writer must never receive HTML)`);
});

// QMDJ is intentionally NOT a standalone section per the current spec, but its data should still
// surface in Summary Information (formerly Profile Overview / Details Summary).
check(fnBody.includes("QMDJ Life Palace"), 'QMDJ Life Palace still surfaces in Summary Information tiles/rows, even without its own section');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

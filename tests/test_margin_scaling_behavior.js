const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Functional test: extracts the ACTUAL production two-pass scan+apply loop (font-size, padding,
// AND margin) and runs it against fake elements simulating this app's real .section-header CSS
// (margin: 35px 0 15px) to prove margins genuinely shrink in proportion to the font-size change,
// instead of being left at their large, un-shrunk original size next to now-tiny 9pt text.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');

function must(re, label) { const m = src.match(re); if (!m) throw new Error('Could not locate: ' + label); return m; }

const constBlock = must(
  /const TARGET_FONT_PT = 9;\s*const MM_PER_PT = 25\.4 \/ 72;\s*const PX_PER_MM_AT_CAPTURE = EXPORT_CAPTURE_WIDTH \/ CONTENT_W_MM;\s*const TARGET_FONT_PX = TARGET_FONT_PT \* MM_PER_PT \* PX_PER_MM_AT_CAPTURE;\s*const EXPORT_FONT_FAMILY = 'Arial, Helvetica, sans-serif';/,
  'absolute font-size target constants'
)[0];

const scanStart = src.indexOf('if (secContainer.querySelectorAll && window.getComputedStyle)');
const scanSection = src.slice(scanStart, scanStart + 3000);
const snapshotLoop = must(
  /allEls\.forEach\(el => \{\s*const computed = window\.getComputedStyle\(el\);[\s\S]*?originalMargins\.set\(el, \{[\s\S]*?\}\);\s*\}\);/,
  'pass 1 snapshot loop'
).exec ? must(/allEls\.forEach\(el => \{\s*const computed = window\.getComputedStyle\(el\);[\s\S]*?originalMargins\.set\(el, \{[\s\S]*?\}\);\s*\}\);/, 'pass 1 snapshot loop')[0]
  : null;
const applyLoop = must(
  /allEls\.forEach\(el => \{\s*const size = originalFontSizes\.get\(el\);[\s\S]*?if \(mar\.left\) el\.style\.marginLeft = \(mar\.left \* padScale\) \+ 'px';\s*\}\);/,
  'pass 2 apply loop'
)[0];

// --- fake DOM ---
function makeEl(fontSize, marginTop, marginBottom) {
  return {
    style: {},
    _computed: {
      fontSize: fontSize + 'px',
      paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px',
      marginTop: marginTop + 'px', marginRight: '0px', marginBottom: marginBottom + 'px', marginLeft: '0px',
    },
  };
}
// Mirrors the app's real .section-header CSS: font-size ~22px (from `.section-header { font: 500
// 22px Georgia, serif; ... }`), margin: 35px 0 15px.
const sectionHeading = makeEl(22, 35, 15);
const bodyText = makeEl(13, 4, 0); // mirrors `.reading p { font-size: 13px; margin: 0 }`-ish sibling
const allEls = [sectionHeading, bodyText];
allEls.forEach = Array.prototype.forEach.bind(allEls);
const fakeWindow = { getComputedStyle: (el) => el._computed };

var MARGIN_MM = 10, PAGE_W_MM = 210;
var CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2;
var EXPORT_CAPTURE_WIDTH = 420;
eval(constBlock.replace(/const /g, 'var '));

// Run pass 1 (snapshot) using the real production snapshot pattern.
var originalFontSizes = new Map();
var originalPaddings = new Map();
var originalMargins = new Map();
allEls.forEach(el => {
  const computed = fakeWindow.getComputedStyle(el);
  originalFontSizes.set(el, parseFloat(computed.fontSize));
  originalPaddings.set(el, {
    top: parseFloat(computed.paddingTop), right: parseFloat(computed.paddingRight),
    bottom: parseFloat(computed.paddingBottom), left: parseFloat(computed.paddingLeft),
  });
  originalMargins.set(el, {
    top: parseFloat(computed.marginTop), right: parseFloat(computed.marginRight),
    bottom: parseFloat(computed.marginBottom), left: parseFloat(computed.marginLeft),
  });
});

// Run the ACTUAL extracted production apply loop.
eval(applyLoop);

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const headingScale = TARGET_FONT_PX / 22;
const bodyScale = TARGET_FONT_PX / 13;

check(sectionHeading.style.fontSize === TARGET_FONT_PX + 'px', 'heading font-size set to absolute 9pt target');
check(Math.abs(parseFloat(sectionHeading.style.marginTop) - 35 * headingScale) < 1e-6,
  'heading 35px top margin scaled down proportionally to its own font shrink, not left at 35px');
check(Math.abs(parseFloat(sectionHeading.style.marginBottom) - 15 * headingScale) < 1e-6,
  'heading 15px bottom margin scaled down proportionally');
check(parseFloat(sectionHeading.style.marginTop) < 35, 'scaled top margin is genuinely smaller than the original 35px (real whitespace reduction)');
check(parseFloat(sectionHeading.style.marginTop) > 0, 'margin is reduced, not zeroed out entirely (keeps some visual separation)');

check(Math.abs(parseFloat(bodyText.style.marginTop) - 4 * bodyScale) < 1e-6, 'body element small margin also scaled by its own ratio');

// The whole point: after the fix, margin size relative to font size across DIFFERENT elements should
// be far more consistent than before (previously: font shrunk ~3x, margin unchanged - wildly
// disproportionate; now both move together).
const marginToFontRatioBefore = 35 / 22; // pre-fix: original margin vs original font
const marginToFontRatioAfter = parseFloat(sectionHeading.style.marginTop) / parseFloat(sectionHeading.style.fontSize);
check(Math.abs(marginToFontRatioAfter - marginToFontRatioBefore) < 1e-6,
  'margin-to-font-size ratio preserved (proportional shrink) rather than left disproportionate');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

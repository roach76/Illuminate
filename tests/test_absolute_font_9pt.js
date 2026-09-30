const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the new absolute-9pt-Arial font-size fix in app.js's captureChunksIntoPdf, by extracting
// the ACTUAL production code (constants + scaling loop) via string slicing and running it against a
// realistic fake DOM - not a reimplementation, so this genuinely tests the shipped code.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');

function must(re, label) {
  const m = src.match(re);
  if (!m) throw new Error('Could not locate: ' + label);
  return m;
}

// 1. Extract geometry constants used by the fix.
must(/const MARGIN_MM = 10, PAGE_W_MM = 210, PAGE_H_MM = 297;/, 'page geometry constants');
must(/const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM \* 2;/, 'CONTENT_W_MM');
must(/const EXPORT_CAPTURE_WIDTH = 420;/, 'EXPORT_CAPTURE_WIDTH');

// 2. Extract the new absolute-target constant block.
const constBlock = must(
  /const TARGET_FONT_PT = 9;\s*const MM_PER_PT = 25\.4 \/ 72;\s*const PX_PER_MM_AT_CAPTURE = EXPORT_CAPTURE_WIDTH \/ CONTENT_W_MM;\s*const TARGET_FONT_PX = TARGET_FONT_PT \* MM_PER_PT \* PX_PER_MM_AT_CAPTURE;\s*const EXPORT_FONT_FAMILY = 'Arial, Helvetica, sans-serif';/,
  'absolute font-size target constants'
)[0];

// 3. Confirm the old relative multiplier is fully gone.
if (/const FONT_SCALE = 0\.35;/.test(src)) throw new Error('Old relative FONT_SCALE constant still present - should have been replaced');
if (/size \* FONT_SCALE/.test(src)) throw new Error('Old relative scaling expression still present');

// 4. Extract the scaling loop itself (the second allEls.forEach in this section). This loop now also
//    scales margin (added in the same session's follow-up whitespace fix) - the regex is widened to
//    swallow through to the end of the whole forEach body rather than stopping right after padding,
//    so this extraction keeps working regardless of what else gets added inside that same loop.
const loopBlock = must(
  /allEls\.forEach\(el => \{\s*const size = originalFontSizes\.get\(el\);[\s\S]*?\}\);/,
  'absolute-target scaling loop'
)[0];

// --- Build a minimal fake DOM element + Map-based "querySelectorAll" harness ---
function makeEl(fontSize, padding) {
  return {
    style: {},
    _computed: {
      fontSize: fontSize + 'px', paddingTop: (padding||0)+'px', paddingRight: (padding||0)+'px', paddingBottom: (padding||0)+'px', paddingLeft: (padding||0)+'px',
      marginTop: '0px', marginRight: '0px', marginBottom: '0px', marginLeft: '0px',
    },
  };
}

const elLarge = makeEl(24, 12);   // e.g. a heading
const elSmall = makeEl(6, 2);     // an already-tiny label
const elInherited = makeEl(16, 8); // a normal body element
const allEls = [elLarge, elSmall, elInherited];
allEls.forEach = Array.prototype.forEach.bind(allEls);

const fakeWindow = { getComputedStyle: (el) => el._computed };

// Evaluate the extracted constant block + loop in a sandbox with the real geometry constants.
var MARGIN_MM = 10, PAGE_W_MM = 210;
var CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2; // 190
var EXPORT_CAPTURE_WIDTH = 420;
// direct eval of `const ...` creates bindings scoped only to the eval call itself, invisible to this
// outer scope - switch to `var` (functionally identical here, all top-level, no re-declaration risk)
// so the extracted production values are actually readable afterward.
eval(constBlock.replace(/const /g, 'var '));

if (Math.abs(TARGET_FONT_PX - 9 * (25.4/72) * (420/190)) > 1e-9) throw new Error('TARGET_FONT_PX formula mismatch');
if (TARGET_FONT_PX < 6.9 || TARGET_FONT_PX > 7.1) throw new Error('TARGET_FONT_PX out of expected ~7.02px range: ' + TARGET_FONT_PX);

// Run pass 1 (snapshot) using the real extracted logic pattern (mirrors production: read all first).
const originalFontSizes = new Map();
const originalPaddings = new Map();
const originalMargins = new Map();
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

// Now execute the ACTUAL extracted production loop text against our fake elements.
eval(loopBlock);

// --- Assertions ---
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } }

// All three elements, regardless of wildly different original sizes, must land on the EXACT same
// absolute 9pt-equivalent pixel size - this is the whole point of the fix (no more per-element drift).
check(elLarge.style.fontSize === TARGET_FONT_PX + 'px', 'large element scaled to absolute target');
check(elSmall.style.fontSize === TARGET_FONT_PX + 'px', 'small element scaled to absolute target');
check(elInherited.style.fontSize === TARGET_FONT_PX + 'px', 'mid-size element scaled to absolute target');
check(elLarge.style.fontSize === elSmall.style.fontSize && elSmall.style.fontSize === elInherited.style.fontSize, 'all elements converge on identical final size');

// Font-family forced to Arial/Helvetica stack on every element.
check(elLarge.style.fontFamily === 'Arial, Helvetica, sans-serif', 'large element gets Arial font-family');
check(elSmall.style.fontFamily === 'Arial, Helvetica, sans-serif', 'small element gets Arial font-family');

// Padding scales proportionally to how much THAT element's own size changed (24px->~7px shrinks a
// lot more than 6px->~7px, which should barely change / even grow slightly) - never compounded
// across elements since each reads its own original from the Map, not a sibling's mutated style.
const expectedPadLarge = 12 * (TARGET_FONT_PX / 24);
const expectedPadSmall = 2 * (TARGET_FONT_PX / 6);
check(Math.abs(parseFloat(elLarge.style.paddingTop) - expectedPadLarge) < 1e-6, 'large element padding scaled down proportionally to its own shrink');
check(Math.abs(parseFloat(elSmall.style.paddingTop) - expectedPadSmall) < 1e-6, 'small element padding scaled by its own ratio (grows slightly, not shrunk blindly)');

// Sanity: 9pt Arial is a legible size - must not be sub-5px or absurdly large regardless of geometry.
check(TARGET_FONT_PX > 5 && TARGET_FONT_PX < 12, 'resulting px size is in a sane legible range for 9pt at this capture geometry');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

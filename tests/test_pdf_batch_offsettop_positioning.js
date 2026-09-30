const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Regression test for a real, live-reproduced bug: "Generated PDF now only has 2 pages! no issues on
// console." Root cause (confirmed by direct in-browser instrumentation against the real served app,
// not just code reading): captureChunksIntoPdf's per-batch member position measurement reads each
// member's `offsetTop` to find its position WITHIN batchContainer:
//
//   const memberBounds = memberWrappers.map(w => ({ top: w.offsetTop, height: w.offsetHeight }));
//
// offsetTop/offsetParent only reset at the nearest ANCESTOR with a non-static CSS `position` (per the
// DOM spec) - `display:flow-root` does not count. Before this fix, neither batchContainer nor
// secContainer set any `position`, so with no positioned ancestor anywhere, every member's offsetTop
// resolved against <body> (its absolute position in the WHOLE live page, tens of thousands of px, since
// this detached container is appended far down inside the live app's own rendered UI) instead of its
// small, correct offset inside its own tiny batchContainer. That huge, wrong offset then hugely
// overshot the real captured batchCanvas height, so the downstream slicing math clamped nearly every
// unit's sliced height down to 1px - collapsing almost all real content out of the exported PDF.
//
// Why the existing test suite never caught this: every test in this suite runs under jsdom, and jsdom
// does not implement real CSS layout - offsetTop/offsetHeight/getBoundingClientRect all read back as 0
// for every element regardless of its actual styling, so a bug that only manifests through real browser
// layout math is invisible here no matter how the pipeline is exercised. This was only found and
// confirmed by direct live-browser instrumentation against the user's own running app (see
// UPDATE_NOTES_AND_INSTRUCTIONS.md for that session's evidence: offsetTop values of ~74,000px+ against
// a batch canvas only ~1,500px tall, collapsing a 648-piece capture down to 2 pages).
//
// Live-verified fix: giving batchContainer `position:relative` makes it the positioned ancestor every
// member's offsetTop resolves against, so offsetTop is always the small, correct offset within this
// container regardless of where it happens to sit on the live page. Confirmed live: without the fix, a
// large real-scale export produced 2 pages with member offsets up to ~74,000px; with the fix, offsets
// stayed under 500px and the same export produced 65 pages.
//
// This test can only assert the fix is present in the source (a real-layout check needs a real browser,
// which is exactly the gap above) - but it directly targets the regex a future edit could break, so if
// someone strips this `position:relative` back out - even while "cleaning up" the cssText string, or
// reformatting it - this test fails loudly instead of silently reintroducing the bug.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

const batchContainerMatch = src.match(/batchContainer\.style\.cssText = `([^`]*)`;/);
check(!!batchContainerMatch, 'batchContainer.style.cssText assignment found in app.js');
if (batchContainerMatch) {
  check(/position\s*:\s*relative/.test(batchContainerMatch[1]),
    'BUG FIX VERIFIED: batchContainer sets position:relative, so offsetTop reads used later for ' +
    'per-member slicing (memberBounds) resolve against batchContainer itself, not <body>');
}

// Guard: the memberBounds line must still be reading offsetTop/offsetHeight off each member wrapper -
// if that measurement approach changes (e.g. to getBoundingClientRect deltas), this fix's own
// position:relative would no longer be load-bearing and this test would need to change with it, not
// silently pass while checking something that no longer matters.
check(/const memberBounds = memberWrappers\.map\(w => \(\{ top: w\.offsetTop, height: w\.offsetHeight \}\)\);/.test(src),
  'memberBounds still derives from offsetTop/offsetHeight (this fix targets exactly that measurement)');

console.log(`${pass} passed, ${fail} failed`);
process.exitCode = fail > 0 ? 1 : 0;

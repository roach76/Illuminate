const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies this session's "too much blank space" fix: (1) wrapperStyle's page-level padding is no
// longer duplicated into every single per-section capture container, and (2) margins - which this
// app's CSS relies on heavily for spacing (.section-header, headings, etc.) - are now scaled down
// alongside font-size and padding, instead of being left at their full, un-shrunk on-screen size.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// 1. wrapperStyle padding stripped before being applied per-unit.
check(/const wrapperStyleNoPadding = wrapperStyle\.replace\(\/padding\\s\*:\[\^;\]\+;\?\/gi, ''\);/.test(src),
  'wrapperStyleNoPadding strips padding via regex');
check(/secContainer\.style\.cssText = wrapperStyleNoPadding \+ `; padding:0; display:flow-root;/.test(src),
  'secContainer uses padding-stripped wrapper style with padding explicitly zeroed and flow-root set');
check(!/secContainer\.style\.cssText = wrapperStyle \+/.test(src),
  'old per-unit full-wrapperStyle (with its padding) assignment removed');

// Sanity-check the actual stripping regex behaves as intended against a realistic wrapperStyle string.
const sampleWrapperStyle = 'font-family:Georgia,serif;padding:20px;color:#182030;';
const stripped = sampleWrapperStyle.replace(/padding\s*:[^;]+;?/gi, '');
check(!/padding/i.test(stripped), 'sample wrapperStyle padding actually removed by the regex');
check(/font-family:Georgia,serif/.test(stripped) && /color:#182030/.test(stripped), 'non-padding declarations survive the strip');

// 2. Margin scaling added to the two-pass font/padding scan.
check(/const originalMargins = new Map\(\);/.test(src), 'originalMargins map declared');
check(/originalMargins\.set\(el, \{/.test(src), 'margins captured in pass 1 snapshot');
check(/top: parseFloat\(computed\.marginTop\), right: parseFloat\(computed\.marginRight\),/.test(src),
  'marginTop/marginRight read from computed style');
check(/const mar = originalMargins\.get\(el\);/.test(src), 'pass 2 reads back the snapshotted margin');
check(/if \(mar\.top\) el\.style\.marginTop = \(mar\.top \* padScale\) \+ 'px';/.test(src),
  'marginTop scaled by the same per-element padScale ratio as padding');
check(/if \(mar\.left\) el\.style\.marginLeft = \(mar\.left \* padScale\) \+ 'px';/.test(src),
  'marginLeft scaled too');

// 3. Regression: absolute 9pt font fix (from the prior change this session) still intact.
check(/const TARGET_FONT_PX = TARGET_FONT_PT \* MM_PER_PT \* PX_PER_MM_AT_CAPTURE;/.test(src), 'absolute 9pt target still present');
check(!/const FONT_SCALE = 0\.35;/.test(src), 'old relative FONT_SCALE still gone');

// 4. Regression: earlier established fixes untouched.
check(/x:\s*0,\s*y:\s*0,\s*scrollX:\s*0,\s*scrollY:\s*0/.test(src), 'html2canvas x/y/scroll offset fix still present');
check(/let __pdfExportUidCounter = 0;/.test(src), 'shared unique-id counter still present');
check(/MAX_TOC_TITLE_LENGTH\s*=\s*70/.test(src), 'TOC truncation still present');

// 5. Padding-scaling loop structure preserved (two full passes, no compounding regression risk).
// NOTE: this scan now runs once per BATCH (over batchContainer) rather than once per individual
// secContainer - see this round's PERFORMANCE FIX (batching multiple html2canvas capture units into one
// call). The two-pass snapshot-then-apply structure itself is unchanged.
const scanStart = src.indexOf('if (batchContainer.querySelectorAll && window.getComputedStyle)');
const scanSection = src.slice(scanStart, scanStart + 3000);
const firstForEachIdx = scanSection.indexOf('allEls.forEach');
const secondForEachIdx = scanSection.indexOf('allEls.forEach', firstForEachIdx + 1);
check(firstForEachIdx !== -1 && secondForEachIdx !== -1 && secondForEachIdx > firstForEachIdx,
  'two separate forEach passes still present (snapshot-then-apply, no compounding)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

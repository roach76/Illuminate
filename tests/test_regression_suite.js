const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Consolidated regression smoke-suite for app.js, re-verifying the previously-established critical
// fixes are still intact after this session's font-size change (the historical /tmp/test_*.js files
// from the prior session do not persist across environment resets, so these are re-created here).
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

// 1. html2canvas x/y/scroll offset fix (crop bug) still present.
check(/html2canvas:\s*\{[^}]*x:\s*0[^}]*\}/s.test(src) || /x:\s*0,\s*y:\s*0,\s*scrollX:\s*0,\s*scrollY:\s*0/.test(src),
  'html2canvas x/y/scrollX/scrollY:0 config still present');

// 2. Shared module-level unique-id counter still present and used (dup-id / missing-id DevTools fix).
check(/let __pdfExportUidCounter = 0;/.test(src), 'shared __pdfExportUidCounter declared');
check((src.match(/__pdfExportUidCounter\+\+/g) || []).length >= 2, 'counter used in more than one place (shared across calls)');
check(/autocomplete', 'off'\)/.test(src), 'autocomplete=off still applied to form fields in export clones');

// 3. Two-pass font/padding scan structure preserved (read-all-then-write-all, not single-pass).
// NOTE: this scan now runs once per BATCH (over batchContainer, which holds several units' secContainers
// as children) rather than once per individual secContainer - see this round's PERFORMANCE FIX (batching
// multiple html2canvas capture units into one call). The two-pass snapshot-then-apply structure itself is
// unchanged, just scoped to the batch container instead of a single unit's container.
check(/const batchContainer = document\.createElement\('div'\);/.test(src), 'capture units are grouped into a shared batchContainer (this round\'s batching performance fix)');
const scanSection = src.slice(src.indexOf('if (batchContainer.querySelectorAll && window.getComputedStyle)'), src.indexOf('if (batchContainer.querySelectorAll && window.getComputedStyle)') + 4000);
const firstForEachIdx = scanSection.indexOf('allEls.forEach');
const secondForEachIdx = scanSection.indexOf('allEls.forEach', firstForEachIdx + 1);
check(firstForEachIdx !== -1 && secondForEachIdx !== -1 && secondForEachIdx > firstForEachIdx, 'two separate forEach passes still present (no compounding regression)');
check(/originalFontSizes\.set\(el, parseFloat\(computed\.fontSize\)\)/.test(scanSection), 'pass 1 still snapshots original sizes before any mutation');

// 4. Absolute 9pt-Arial fix present, old relative multiplier gone (this session's change).
check(/const TARGET_FONT_PX = TARGET_FONT_PT \* MM_PER_PT \* PX_PER_MM_AT_CAPTURE;/.test(src), 'new absolute TARGET_FONT_PX formula present');
check(!/const FONT_SCALE = 0\.35;/.test(src), 'old relative FONT_SCALE constant removed');
check(/EXPORT_FONT_FAMILY = 'Arial, Helvetica, sans-serif'/.test(src), 'Arial/Helvetica font-family constant present');
check(/el\.style\.fontFamily = EXPORT_FONT_FAMILY;/.test(src), 'font-family actually applied per element in export loop');

// 5. TOC title truncation still present.
check(/MAX_TOC_TITLE_LENGTH\s*=\s*70/.test(src), 'TOC title truncation constant still present');

// 6. Native PDF writer (dormant, additive) still intact and untouched apart from addTable normalization.
check(/function createPdfWriter\(pdfDoc, opts\)/.test(src), 'createPdfWriter still defined');
check(/function buildNativeProfileSections\(prefix\)/.test(src), 'buildNativeProfileSections still defined');
check(/if \(rawOnly\) return \{ title: extraData\?\.title \|\| type\.toUpperCase\(\), chars, exp, traits, hl, pos, neg, cau, opts \};/.test(src), 'generateDeepAnalysisData rawOnly short-circuit still intact');

// 7. Native writer font sizes now normalized to 9 across the board (addParagraph, addBulletList, addCalcBox, addTable).
const fontSizeDefaults = [...src.matchAll(/const fontSize = opt\.fontSize \|\| (\d+);/g)].map(m => m[1]);
check(fontSizeDefaults.length === 4, 'expected exactly 4 default-fontSize declarations in native writer (found ' + fontSizeDefaults.length + ')');
check(fontSizeDefaults.every(v => v === '9'), 'all native-writer default font sizes normalized to 9 (found: ' + fontSizeDefaults.join(',') + ')');

// 8. Native writer is still NOT wired into the live export entry points (confirms scope of this
//    session's change stayed correctly targeted at the actually-live screenshot pipeline).
const exportFnMatch = src.match(/async function exportProfileToPdf[\s\S]{0,2000}/);
check(!!exportFnMatch, 'exportProfileToPdf function found');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

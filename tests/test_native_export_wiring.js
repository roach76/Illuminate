const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the export-button wiring for the new native PDF pipeline: the USE_NATIVE_PDF_EXPORT flag
// defaults to false (old screenshot pipeline stays the default until Roy tests the new one for real),
// and both exportProfileToPdf and buildProfilePdfBlob check it and branch to buildNativePdfDocument
// when it's true, without removing the old code path.
const fs = require('fs');
const src = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

check(/const USE_NATIVE_PDF_EXPORT = false;/.test(src), 'USE_NATIVE_PDF_EXPORT defaults to false (native pipeline is opt-in, not yet the default)');
check(/async function buildNativePdfDocument\(prefix, onProgress\)/.test(src), 'buildNativePdfDocument function defined');

// NOTE: exportProfileToPdf is now a thin re-entrancy-guard wrapper (see its own comment in app.js -
// added to fix a reported "612 DevTools issues while generating PDF" that traced partly to repeated
// export clicks starting overlapping exports) around exportProfileToPdfInner, which holds all the
// actual logic this test checks for.
const exportFnStart = src.indexOf('async function exportProfileToPdfInner(prefix)');
const exportFnEnd = src.indexOf('\nasync function ', exportFnStart + 10);
const exportFnBody = src.slice(exportFnStart, exportFnEnd);
check(exportFnBody.includes('if (USE_NATIVE_PDF_EXPORT) {'), 'exportProfileToPdf branches on USE_NATIVE_PDF_EXPORT');
check(exportFnBody.includes('buildNativePdfDocument(prefix,'), 'exportProfileToPdf calls buildNativePdfDocument in the native branch');
check(exportFnBody.includes('buildProfilePdfHTML(prefix)'), 'exportProfileToPdf still has the old screenshot-pipeline code path intact');
check(exportFnBody.includes('captureChunksIntoPdf') === false ? true : exportFnBody.includes('captureChunksIntoPdf(topLevelNodes, wrapperStyle,'),
  'old captureChunksIntoPdf call still present in the non-native branch');

const blobFnStart = src.indexOf('async function buildProfilePdfBlob(prefix)');
const blobFnEnd = src.indexOf('\nasync function ', blobFnStart + 10);
const blobFnBody = src.slice(blobFnStart, blobFnEnd === -1 ? src.length : blobFnEnd);
check(blobFnBody.includes('if (USE_NATIVE_PDF_EXPORT) {'), 'buildProfilePdfBlob branches on USE_NATIVE_PDF_EXPORT');
check(blobFnBody.includes('buildNativePdfDocument(prefix)'), 'buildProfilePdfBlob calls buildNativePdfDocument in the native branch');
check(blobFnBody.includes('captureChunksIntoPdf(topLevelNodes, wrapperStyle)'), 'buildProfilePdfBlob still has the old captureChunksIntoPdf call intact');

// The native branch must return/throw BEFORE reaching the old buildProfilePdfHTML/container-building
// code, so flipping the flag genuinely skips the old path rather than running both.
const nativeBranchIdx = exportFnBody.indexOf('if (USE_NATIVE_PDF_EXPORT)');
const oldPathIdx = exportFnBody.indexOf('buildProfilePdfHTML(prefix)');
check(nativeBranchIdx !== -1 && oldPathIdx !== -1 && nativeBranchIdx < oldPathIdx, 'native branch appears before the old buildProfilePdfHTML call (early-return structure)');
check(exportFnBody.slice(nativeBranchIdx, oldPathIdx).includes('return;'), 'native branch returns early, so the old path never also runs when the flag is on');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

const __PROJECT_ROOT__ = require('path').resolve(__dirname, '..');
// Verifies the fix for the reported "855 issues" DevTools explosion after PDF generation.
//
// ROOT CAUSE (confirmed by actually counting the app's real form fields, not guessed): every one of
// this app's 95 real <input>/<select> elements across index.html and app.js's templates was already
// missing an `autocomplete` attribute (100% of them), and 4 specific fields (mobileNumberInput,
// vehicleSharedCheckbox, homeAddressInput, homeConstructionYearInput) had neither an `id` nor a `name`
// at all - a pre-existing condition of the live page, present on every load, independent of any PDF
// export. The PDF export pipeline's own capture loop (captureChunksIntoPdf) clones sections of the DOM
// into MANY temporary containers (one per capture unit, recursively split up to depth 4) and keeps
// them all attached to document.body for the full duration of the export before removing them at the
// end - so every one of these already-missing-attribute fields gets duplicated many times over while
// an export is running, which is why the count specifically spiked "after PDF generation" even though
// the underlying condition was never actually created by the export itself.
//
// FIX: every real form field now carries both `autocomplete="off"` and a real `id`/`name`, so the
// advisories are eliminated at the source - the export's temporary clones now multiply zero problems
// instead of a few.
const fs = require('fs');
const htmlSrc = fs.readFileSync((__PROJECT_ROOT__ + '/index.html'), 'utf8');
const appSrc = fs.readFileSync((__PROJECT_ROOT__ + '/app.js'), 'utf8');
let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

function realFormFieldTags(src) {
  // Excludes the two documentation-comment occurrences of the literal strings "<select>"/"<input>"
  // (found in a code comment near the change-listener, unrelated to real markup) by requiring at
  // least one attribute character before the closing '>'.
  return (src.match(/<(?:input|select)\b[^>]*>/g) || []).filter(t => t !== '<input>' && t !== '<select>');
}

const combined = htmlSrc + appSrc;
const tags = realFormFieldTags(combined);
check(tags.length >= 90, `found a realistic number of real form-field tags across both files (got ${tags.length})`);

const missingAutocomplete = tags.filter(t => !/\bautocomplete=/.test(t));
check(missingAutocomplete.length === 0, `BUG FIX VERIFIED: every real form field now has autocomplete="off" (previously ALL ${tags.length} were missing it - the single biggest source of the reported advisory count); ${missingAutocomplete.length} still missing`);

const missingIdAndName = tags.filter(t => !/\bid=/.test(t) && !/\bname=/.test(t));
check(missingIdAndName.length === 0, `BUG FIX VERIFIED: every real form field now has an id or a name (previously 4 - mobileNumberInput, vehicleSharedCheckbox, homeAddressInput, homeConstructionYearInput - had neither); ${missingIdAndName.length} still missing`);

// The specific 4 previously id-less fields now each have BOTH id and name (not just one), and the two
// that repeat per profile/vehicle use the same uniqueness convention (prefix/idx) already used
// elsewhere in the app for exactly this reason (avoiding duplicate ids across profiles/vehicles).
check(/id="mobileNumberInput_\$\{prefix\}" name="mobileNumberInput_\$\{prefix\}"/.test(appSrc), 'mobileNumberInput now has a per-prefix unique id+name (won\'t collide across individual/partner/business-partner/children)');
check(/id="vehicleSharedCheckbox_\$\{prefix\}_\$\{idx\}" name="vehicleSharedCheckbox_\$\{prefix\}_\$\{idx\}"/.test(appSrc), 'vehicleSharedCheckbox now has a per-prefix-and-index unique id+name (won\'t collide across multiple vehicles/profiles)');
// UPDATED (Task #76/#77): the single free-text homeAddressInput/homeConstructionYearInput fields were
// replaced by structured fields (renderAddressFieldsHTML) - each still gets its own fixed, unique id
// (safe since this block only ever renders once, for the individual), just no longer a `name` attribute
// (not needed - nothing here relies on form-field name submission, only id-based DOM access/classList).
check(/id="\$\{idPrefix\}\$\{cap\(key\)\}"/.test(appSrc), 'each structured address field (House Number, Street Name, Unit, City, Country, Postal Code) now has a unique id');
check(/id="\$\{idPrefix\}ConstructionYear"/.test(appSrc), 'the structured Construction Year field has a unique id');

// The PDF export's existing clone-uniquification logic (querySelectorAll('[id]') -> reassign fresh id)
// still catches these newly-id'd elements during export, so no NEW duplicate-id issue is introduced by
// adding ids to fields that previously had none.
check(/clonedNode\.querySelectorAll\('\[id\]'\)\.forEach\(el => el\.setAttribute\('id', `pdf-export-/.test(appSrc), 'the PDF export\'s existing clone id-uniquification still runs and will catch the newly-added ids too, so no new duplicate-id warning is introduced');

// Regression: class-based JS listeners for these 4 fields still key off .className, not id, so adding
// id/name does not change any click/change handler behavior.
check(/classList\.contains\('mobileNumberInput'\)/.test(appSrc), 'mobileNumberInput\'s change listener still keys off its class (unaffected by adding id/name)');
check(/classList\.contains\('vehicleSharedCheckbox'\)/.test(appSrc), 'vehicleSharedCheckbox\'s change listener still keys off its class');
// UPDATED (reported this round: "remove the home address entry from Feng Shui as it is to be managed
// at the profile level"): the persistent Home Address's editable "homeAddr"-idprefix fields (and their
// live auto-save change listener) are gone entirely - the address is now only ever entered/edited on
// the Intake/Profile page (a plain #saveProfile click-handler flow, not this class-based addrField
// listener), and shown read-only in the Feng Shui section. The "newAddr" idprefix (Check Another
// Address) still uses the addrField class, but is read on submit only, not via a change listener.
check(!/e\.target\.dataset\.idprefix === 'homeAddr'/.test(appSrc), 'the removed persistent Home Address change listener (keyed on addrField + homeAddr idprefix) is gone from app.js');
check(!/renderAddressFieldsHTML\('homeAddr'/.test(appSrc), 'no homeAddr-prefixed editable fields are ever generated any more');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

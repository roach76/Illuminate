# Update Notes & Instructions

This file is updated after every fix or enhancement to the job search
scraper package. Most recent changes are at the top. Entries are
consolidated periodically to stay readable — see "How to use this file"
at the bottom for the standard this file is held to.

---

## 2026-09-15 — Dashboard opened via file:// has unreliable persistence; fixed with a local server

### The problem, and how it was actually found
Manually-added jobs and tracked application statuses were reported
disappearing after a page reload, despite testing that had appeared to
confirm persistence worked. That earlier testing was Node-based
simulation of the storage logic — genuinely valid for catching logic
bugs, but structurally incapable of catching this one, since Node has no
concept of a browser security origin at all.

**Root cause (confirmed against MDN's own documentation):**
`dashboard.html` was designed to be opened by double-clicking the file,
which loads it as a `file://` URL. Per MDN's documentation of
`Window.localStorage`: *"For documents loaded from file: URLs... the
requirements for localStorage behavior are undefined and may vary among
different browsers. In all current browsers, localStorage seems to
return a different object for each file: URL."* In practice, a browser
can treat every `file://` page load as a fresh, isolated storage area —
so a save can succeed perfectly and still appear to vanish the next time
the same file is reopened. This is not a bug in this project's code; it
is undefined behavior in the web platform itself, triggered specifically
by how the file was being opened.

**Fix:** added `serve_dashboard.py`, a small dependency-free local web
server (Python's built-in `http.server` only) that serves the
`job-scraper` folder over `http://localhost:8765`. Opening the dashboard
through this server instead of double-clicking the file gives
`localStorage` its normal, reliable behavior. `README.md` and
`SETUP_GUIDE.md` now recommend this as the standard way to open the
dashboard, explain why plainly, and a troubleshooting entry names this
exact symptom. The earlier "manually-added jobs are permanent" claim in
`README.md` was corrected to state the real, conditional truth
(permanent through the server; unreliable opened directly).

Verified by actually running the server and fetching `dashboard.html`
and its script dependencies over a real `http://localhost` connection
(genuine HTTP 200s, not just reading files from disk), and by confirming
against GitHub's own API documentation that serving from `localhost`
introduces no new restriction on the GitHub auto-fetch feature (GitHub's
REST API sends `Access-Control-Allow-Origin: *`).

### Bugs found and fixed while building persistence for manually-added jobs
This feature went through several rounds before it was solid. In order
of discovery:

1. **No persistence at all, initially.** `loadJobs()` did `currentJobs =
   jobs` — a full wholesale replacement — so loading a new report or
   reloading the page silently discarded any manually-added job. Fixed
   by adding `MANUAL_JOBS_KEY` storage and `mergeManualJobsInto()`,
   called on every load path (page load, GitHub fetch, manual file load)
   so persisted manual jobs are always re-merged in. An explicit
   **Remove** button (confirmation-gated, shown only on manually-added
   rows) was added for intentional removal — "never auto-cleared" was
   never meant to mean "un-removable."

2. **Add-job could silently fail with no error or indication.**
   `saveManualJobs()` called `localStorage.setItem()` with no error
   handling. In real browsers this can throw (storage quota exceeded,
   or private-browsing modes — notably Safari — that allow reads but
   throw on writes); an uncaught throw mid-handler meant the job was
   pushed into memory but the modal never closed and the table never
   re-rendered, since every line after the failing call never ran. This
   was reproduced directly (a synthetic `localStorage` whose `setItem`
   always throws, fed through the real code) before writing the fix, and
   the reproduction matched the reported symptom exactly. Fixed by
   wrapping every `localStorage` write in this project (`saveManualJobs`,
   `saveTracker`) in try/catch, returning success/failure to the caller;
   the visible action (adding to the table, closing the modal,
   re-rendering) now always completes, with a plain warning shown
   separately if persistence itself failed — deliberately not making the
   whole operation atomic, since failing the visible action too would
   mean a storage quirk prevents using the dashboard at all that session.

3. **Excel re-import could create a duplicate row.** The Excel export
   deliberately omits a job's internal `manualId` (to keep the export
   readable), so re-importing a previously-exported `.xlsx` brought a
   manually-added job back with no `manualId` — and the merge logic,
   which only deduplicated by `manualId`, would append the genuine
   persisted copy alongside it. Fixed by also checking each job's
   `trackerKey()` (URL, or title+company) during merge, so a job missing
   its `manualId` is still recognized as the same job.

Each of these was reproduced directly before its fix was written, and
the full existing regression suite (Python compile checks, YAML
validation, `docgen.js` syntax, dashboard HTML/JS structure) was re-run
after every change in this sequence.

### Known limitations
- If storage is unavailable even through the server (rare), persistence
  failure is now visible and honest rather than silent — but there's no
  way for client-side JavaScript to make a genuinely restricted browser
  store data. Use "Export all jobs to Excel" as a manual backup if this
  happens.
- The location filter and "no full JD text" limitations for
  Workday/Eightfold sources (see the 2026-09-14 entry) are unrelated to
  and unaffected by any of the above.

---

## 2026-09-15 — Fixed missing cover letter, real job tailoring, matched CV format, plain-English rewrite

### What was reported
1. Cover letter was missing from the download (only the resume appeared)
2. The generated resume/cover letter weren't actually edited to match
   the target job — reordering bullets wasn't enough
3. The visual format didn't match the real `Roy_Wong_CV_190826.docx`
4. Both should be genuine Word (.docx) files
5. (Follow-up) The new job-specific text should be plain English, no
   jargon, and stay strictly factual to the original resume

### Diagnosis and fixes
The re-uploaded CV was read via `pandoc` and confirmed content-identical
to `resume_data.py` — the resume data was not the problem; all four
issues traced to the document-generation code.

1. **Missing cover letter**: Chrome and other browsers block a second
   automatic download triggered from one click by default. The code was
   generating both files correctly; the second `saveAs()` was being
   silently blocked. **Fixed** with a 600ms delay between the two calls
   (a documented workaround, verified against multiple independent
   sources including FileSaver.js's own issue tracker) — both calls stay
   inside the same click-triggered async function, so this doesn't
   trigger the separate iOS restriction on `saveAs()` escaping the
   original user-gesture context. The status message now tells the
   person what to check if only one file appears.
2. **No real tailoring**: added one genuinely new, job-specific opening
   sentence to both documents, naming the actual target role/company and
   the specific real skills from the resume that the job posting also
   asks for. Every term used is something both the posting and the
   actual resume already state; nothing is invented.
3. **Format mismatch**: the real `.docx` was unzipped and its
   `word/document.xml` read directly for exact values — heading color
   `#1F3864`, Arial throughout, a bottom-border rule under each heading,
   true bulleted Core Competencies items (not one inline paragraph per
   group). `docgen.js` was rebuilt to match, and the cover letter now
   reuses the same header/color/rule treatment as the resume.
4. Word format was already correct; resolved once the download issue
   was fixed.
5. **Plain English (follow-up)**: the new opening sentence had been
   built from internal matching tags directly ("SLA", "GRR", "C-suite").
   Added `PLAIN_ENGLISH_TERMS`, a translation table covering all 77 tags
   used in `resume_data.py` (verified programmatically — 3 missing
   entries were found and added during that check), so the sentence
   reads naturally ("meeting service commitments" instead of "SLA").
   Everything else — every bullet, every competency line, both fixed
   summary sentences — remains completely untouched and byte-for-byte
   identical to the real CV; only the one new sentence was reworded.

Two smaller bugs were caught during this work: a long company name with
a parenthetical qualifier ran into its right-aligned date with no space
(fixed by splitting the parenthetical onto its own line, matching how
the real CV formats it), and the first attempt at right-aligning dates
used docx's `PositionalTab` API, which LibreOffice's renderer (used for
this project's visual verification) didn't honor — switched to a
standard paragraph `tabStops` approach, verified working in an isolated
test before adopting it project-wide.

Verified throughout by generating and visually inspecting rendered PDFs
after each fix, and by re-running the bullet/competency/summary
verbatim-fidelity check to confirm zero change to real resume content.

### Known limitations
- The download-delay fix is a mitigation, not a guarantee — some
  browsers or strict settings may still block a second download.
- Visual verification in this project uses LibreOffice, which is not
  pixel-identical to Microsoft Word (the `PositionalTab` incompatibility
  above is a concrete example of the gap).

---

## 2026-09-15 — Add a job manually; re-evaluated Tier 3 job sites; added Careerjet

### Add a job manually
Added a **+ Add a job manually** button and form (title, company,
location, URL, description) for a role found outside the scraper. On
submit: validated (title/company required, URL format checked, duplicate
URLs rejected with a message naming the colliding job rather than
silently colliding in the tracker), scored with the same
`scoreJobClient()` engine used elsewhere in the dashboard, and given the
identical object shape as a scraped job (with `source: "Manually
added"`) — so tracking, the Applied Jobs split, Review, document
generation, and Excel export all work on it without any of that code
needing to change, since it already operated on `currentJobs` generically.
(Persistence for this feature went through several more fixes — see the
entry above.)

Verified with unit tests for every validation path, a full integration
test feeding a manually-added job through real `docgen.js` document
generation, and confirmation that tracking and Excel export require no
changes since they already operate on the full job list regardless of
origin.

### Re-evaluated LinkedIn, Indeed, Glassdoor, JobStreet — still blocked
Re-checked each from scratch (official docs, current ToS, independent
reporting) rather than repeating the earlier answer from memory. Nothing
improved: LinkedIn's Jobs API has been retired since 2018 and they
actively sue scrapers; Indeed's public Publisher API was shut down in
2023 with no replacement; Glassdoor's API is enterprise-sales-only since
2024; JobStreet/SEEK has a real developer API but it's entirely
employer-side (posting, not searching) and requires SEEK's approval.
None were added — third-party "APIs" for these sites are uniformly
scrapers operating against the platform's own terms.

### Added: Careerjet
Confirmed via Careerjet's own documentation as a genuine, free, self-serve
public API (not a scraper) with a dedicated Singapore market. Added
`fetch_careerjet()` and `CAREERJET_AFFILIATE_ID`/`CAREERJET_LOCALE_CODE`
to `config.py`/`scraper.py`. **Flagged honestly rather than guessed as
confirmed:** the exact `locale_code` for Singapore (`en_SG` is used, the
best inference from the documented format) was not verified against a
live API key, since that requires creating an account. The code fails
gracefully with a clear log message if this guess is wrong, rather than
crashing the run.

### Investigated and rejected: Thermo Fisher (Phenom People)
Live-inspected the real network traffic; the search backend is a
same-origin endpoint with an internal, undocumented payload scheme —
unlike the stable, documented patterns behind Greenhouse/Lever/
Workday/Eightfold. Left unintegrated rather than ship a fragile,
reverse-engineered integration that would break silently on any
vendor-side change.

---

## 2026-09-14 — Workday + Eightfold ATS support; Singapore-only location filter; adjustable threshold; Applied Jobs list

### Expanded ATS coverage
Every candidate company from the target list (Vertiv, ORBCOMM, SATS,
Malvern Panalytical, Visa, Razer, Addepar, Qlik, GovTech Singapore,
Thermo Fisher) was individually checked live in a real browser — network
traffic inspected, APIs test-called directly — rather than assumed from
search results (which proved unreliable, dominated by third-party
scraper-service marketing pages).

**Added:** Workday's undocumented-but-public candidate-experience API
(confirmed working for Malvern Panalytical and Visa, live-tested with
real Singapore results), Eightfold AI's career-hub search API (confirmed
for Qlik), and a corrected Greenhouse slug for Addepar (`addepar1`, not
the obvious guess `addepar` — a general lesson that a company's ATS slug
should never be assumed from its common name).

**Checked, no usable public API found:** Vertiv (Oracle Fusion Cloud
HCM), ORBCOMM (ADP Workforce Now), SATS (SAP SuccessFactors), Razer
(custom portal) — each confirmed via real network inspection.

### Singapore-only location filter
Greenhouse, Lever, Workday, and Eightfold have no location parameter at
all — they return every open role worldwide, which would flood results
from companies with large global boards. Added
`passes_location_filter()`, applied identically to every source
including Adzuna/Jooble/Careerjet as a safety net (aggregators
occasionally return nearby-country results despite their own location
parameter). Deliberate design choice: an ambiguous location string
(e.g. a posting spanning several offices) is **excluded**, not guessed
as a match — conservative over exhaustive.

Verified with a full mocked end-to-end run confirming non-Singapore
postings (Pune, Kuala Lumpur, Eindhoven) were excluded while genuine
Singapore postings from multiple ATS platforms survived correctly.

### Adjustable compatibility threshold + separate Applied Jobs list
Replaced the old fixed 75% highlight with a **Compatibility threshold**
number input (default 75) that now genuinely drives both filtering and
highlighting. The main table shows only "Not applied" jobs; a new
**Applied Jobs** table shows everything else, with status changes moving
a job live between the two — no reload needed. Jobs already marked
Applied/Interview/Offer/Rejected stay visible there regardless of the
current threshold (a job applied to before raising the bar shouldn't
lose visibility).

**A real bug was found shortly after shipping this**: the threshold
control and a separate "Min match % shown" field were disconnected —
the label claimed the threshold set the filter's floor, but that
connection was never implemented, so raising the threshold had no
filtering effect at all. Reproduced with the exact reported numbers
(53.5% and 20% jobs at a 75% threshold, confirmed showing when they
shouldn't) before fixing. **Fixed** by removing the redundant field
entirely, making the threshold the single real control.

**A second regression was caught before delivery**: once the main table
became "Not applied only," the Excel export (which read from that same
filtered function) would have silently dropped every applied job from
the backup. Fixed by having the export always read the full job list
regardless of current filters, and relabeled the button "Export all jobs
to Excel" to make that scope explicit.

### Known limitations
- The location filter is purely text-based against whatever the ATS
  itself reports — no independent way to verify actual office location.
- Workday and Eightfold rows always need manual JD verification, since
  neither source's API returns full description text.
- Thermo Fisher and GovTech Singapore remain unintegrated (see the
  2026-09-15 entry for the Thermo Fisher investigation).

---

## 2026-09-11 — Major rebuild (HTML report, dashboard, doc generation, tracker); GitHub auto-fetch; two edge-case bugs

### Major rebuild
The original brief was revised to require an HTML report (not just
Excel), a dashboard summarizing jobs with compatibility scores, one-click
tailored Word resume/cover letter generation, one-click Excel export, and
a persistent application tracker. Delivered via:
- **`resume_data.py`** — Roy's real resume as structured data; every
  bullet/figure/date checked character-for-character against the actual
  CV. `export_resume_js.py` regenerates `resume_data.js` from it as the
  single source of truth.
- **`docgen.js`** — tailoring by reordering real bullets/competency
  groups by keyword relevance; never rewrites or invents content.
  Verified via an automated check that every tailored bullet is
  byte-for-byte identical to the source data.
- **`dashboard.html`** — the interactive page tying everything together.
- **`match_report.py`** — reworked to produce HTML as the primary output
  (Excel kept as a secondary export); the scoring engine itself was
  unchanged, verified via identical regression scores before/after.
- Removed `viewer.html` (superseded entirely by `dashboard.html`).

Three bugs were caught before delivery: a cover-letter run-on sentence
(caught by visually inspecting a rendered PDF, not just checking the
file opened), a bullet-ranking flaw where generic tags outranked more
diagnostic ones (fixed by weighting specific tags higher), and an
incorrect `docx` CDN URL (corrected to a verified-working jsDelivr
pattern before shipping, not after).

### Automated GitHub fetch
Added the ability to fetch the newest scored report directly from a
private GitHub repo via a read-only, single-repository, fine-grained
personal access token (`gh_config.example.js` as the template, real
config git-ignored) — no manual download step needed. Falls back
gracefully to manual file loading if not configured or if the fetch
fails. Verified against GitHub's actual API docs, tested the base64-decode
logic against a real report with non-ASCII characters, and built a full
mocked-fetch test covering not-configured / success / no-reports-yet /
auth-failure scenarios.

### Two bugs found via deliberate edge-case testing
1. **Attribute-breaking characters**: `escapeAttr()` only escaped single
   quotes, so a double-quote in a job title/URL could break the
   surrounding HTML attribute. Fixed to also escape double quotes and
   backslashes.
2. **Tracker collision for no-URL jobs**: the tracker was keyed solely by
   URL, so two different jobs with no URL would silently share one
   tracked status. Fixed with `trackerKey()` — URL when present, a
   title+company fallback otherwise.

### Known limitations carried forward
- Cannot scrape LinkedIn/Glassdoor/Indeed/JobStreet directly (see the
  2026-09-15 re-evaluation entry — still true).
- The application tracker lives in browser storage only — see the
  2026-09-15 persistence entry for the full, current picture (including
  the `file://` vs server distinction).
- Tailoring reorders real content; it does not insert JD-specific
  phrasing beyond what's already true of the actual resume (later
  extended with one new, factual, plain-English opening sentence — see
  the relevant 2026-09-15 entry).

---

## How to use this file going forward

Every time a fix or enhancement is made to this package, add a new dated
entry above this line (most recent first) covering what changed and why,
any bugs found and how they were caught, what was tested before calling
it done, and any new or changed limitations. Keep entries factual and
specific — cite the actual root cause, not just the symptom — since a
future reader (human or Claude) may need to know exactly what was tried
and why, not just that "it was fixed."

Consolidate periodically once entries pile up: merge same-day or
same-topic entries into one, cut repeated boilerplate (e.g. "re-ran the
regression suite" doesn't need restating in every bullet), correct or
retire superseded claims rather than leaving contradictions, but always
preserve every distinct root cause and every still-true limitation —
those are the parts with real future value.

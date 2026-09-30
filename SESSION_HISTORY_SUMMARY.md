# Illuminate — Session History Summary (as of 2026-09-30 migration to local git/VS Code/Claude Code)

This is a condensed, narrative summary of the engagement to date, written at the point the project moved
from a hosted Claude.ai Project into a local git repository worked on with Claude Code in VS Code. For
the full, dated, blow-by-blow changelog (every bug report, root cause, and fix), see
**`UPDATE_NOTES_AND_INSTRUCTIONS.md`** — this file is a map to that one, not a replacement for it.

## What Illuminate is

A pure client-side JavaScript Progressive Web App combining:
- **Chinese metaphysics:** BaZi (Four Pillars), Zi Wei Dou Shu (14 major + 10 minor stars, full 12-palace
  chart), Qi Men Dun Jia (natal + hourly/daily/monthly/yearly casts), Feng Shui (Ba Zhai + Flying Star),
  I Ching, Chinese Bone Weight, Numerology, Da Yun (10-year luck cycles), Ze Ri (date selection), Tai Yi
  Shen Shu.
- **Western astrology:** full 12-point natal chart (10 classical planets + lunar North/South Node), real
  Ascendant/12-house system (Equal House, from a genuinely computed sidereal-time-based Ascendant),
  natal aspect grid, Annual/Monthly deep transit readings, and real two-person synastry.
- **Compatibility engines** across every one of the above, for Life Partner / Business Partner / children
  / household occupants, plus personal-asset (mobile number, vehicle plate, home/work address)
  compatibility scoring.
- **Singapore Pools 4D/TOTO lottery number prediction**, backed by a real historical draw dataset
  (5,508 4D draws from 1986, 1,810 TOTO draws 2008–2026) and a point-in-time backtested prediction engine
  with no future-data leakage.
- A **live/screenshot-based PDF export pipeline** covering every reading in the app, keyed off the same
  4-tab section registry (`core`/`timing`/`environment`/`more`) the on-screen chart itself renders from.

The owner (Roy) is the sole developer. Development style: evidence-driven — real screenshots, real
console logs, real exported PDFs are supplied and diagnosed from directly, rather than speculative
multi-guess iteration. Bugs are fixed before new features are layered on. A recurring, explicitly-stated
standard throughout this project: **"nothing half-baked — everything must be factual and defensible."**
Fabricated, hardcoded, or merely-plausible-looking results are treated as a serious defect class, and
several past incidents (see `UPDATE_NOTES_AND_INSTRUCTIONS.md`) were specifically about catching and
banning exactly that.

## Timeline (high level — see the changelog for full detail on each)

**Early rounds (2026-09 through ~09-24):** initial hardening pass — memory leak fixes (an app-wide leak
in `renderStandardDeepAnalysis`'s `deepAnalysisRegistry`, never purged across re-renders), a PDF-export
collapse bug (`offsetTop` measuring against the wrong container), a background-PDF-pre-rendering feature
that was silently flooding the local dev server with requests and was disabled, and repeated real,
evidence-driven root-causing of an intermittent "Hourly tab" UI freeze that took several rounds to fully
pin down (final root cause: a `setTimeout(0)` "safety net" fallback that could sit unscheduled in the
browser's timer queue for up to a minute under real-world system load — removed entirely once proven
unnecessary).

**A large structured plan (Phases 0–5)** was then scoped and executed end-to-end: data-model foundation
(household-occupant data, personal-assets collection on every profile type), compatibility engines
(household pairwise compatibility, Feng Shui Kua-vs-Flying-Star reading, address-text compatibility),
reading-depth expansions (completing the 14-star Zi Wei Dou Shu chart including Huo Xing/Ling Xing once a
sourced formula was supplied; 3-year monthly Da Yun and Western-astrology forecasts), PDF export
restructuring, and a full-app audit specifically hunting for half-baked/hardcoded/assumed readings (2
genuine findings, both fixed).

**Western astrology deepened significantly** across several consecutive rounds:
1. A full natal chart (all 12 points, not just the Sun) with a genuine natal reading.
2. Annual (current + 2 years) and Monthly (24 months) deep transit readings on a 5-tier scale, driven by
   real geocentric planetary positions checked against the full natal chart.
3. Deep-reading text upgraded to spell out concrete real-world life-domain impact, not just "which
   planets moved."
4. The full planetary-position engine independently verified against a real ephemeris (prokerala.com)
   for all 10 classical planets.
5. **Real Ascendant-based 12 houses**, built specifically because a supplied photo of a hand-drawn 12-
   house wheel made clear a real Ascendant (needing precise sidereal time AND a birth latitude this app
   had never collected) was wanted over a no-new-data shortcut — the user was asked directly and chose
   the real, harder path. A new `birthLatitude` field was threaded through every profile form,
   auto-populated from country/city selection, and the Equal House system (a specific, disclosed
   convention vs. the more common but formula-heavier Placidus) was wired into the chart wheels, legend,
   and natal reading, with an honest "unavailable" state for any profile without a latitude on file.

**Most recent engagement (2026-09-28 through 2026-09-30 — this session):** a 4-part batch request —
"all compatibility to show %", and 3 requests to have every profile/compatibility/asset reading blend
*all* metaphysics systems (Chinese and Western). Rather than guessing at scope, a direct code audit was
run first, which found compatibility % was already shown almost everywhere except one specific,
then-user-confirmed gap. In order, this session built:

1. **A real synastry engine** (`computeSynastryAspects`/`computeSynastryScore` in
   `engine-metaphysics.js`) — checks all 144 combinations between two people's 12 real natal points using
   the exact same aspect-geometry math already used for the single-chart natal aspect grid, replacing the
   old Sun-Sign-only categorical (which had no % at all) in the "Astrology Compatibility" reading. Uses a
   disclosed, non-fabricated weighting convention (only specific personally-significant conjunction pairs
   are weighted; a conjunction between two people's slow outer planets is deliberately scored 0, since
   it's near-guaranteed for anyone born in the same era and carries no individual significance). Includes
   a real house-overlay note when both people have a birth latitude on file.
2. **Houses fed into the Annual/Monthly Western astrology readings**: transiting-aspect scores are now
   weighted by the aspected natal point's real house (angular houses 1/4/7/10 weighted higher — a
   standard, disclosed astrological convention), and each reading names which house/real-world life area
   is activated. Falls back honestly (no house weighting, no fabricated house data) for any profile
   without a birth latitude.
3. **`calculateTrueCompatibility`'s Western-astrology component deepened** to reuse the new synastry
   engine (previously Sun-Sign-only there too), folding the full synastry score in as one delta against
   its existing 72-point baseline, with an honest fallback when full birth data isn't available for both
   people.
4. **A new "Cross-System Profile Synthesis" reading** — the first reading in this app to cross-reference
   BaZi (Ten Gods), Zi Wei Dou Shu (palace/star placement), Qi Men Dun Jia (Door domains), and Western
   astrology (Sun/Venus sign) side by side for the same 3 real-world domains (Career, Wealth,
   Relationships), reusing only already-verified functions/tables from each system's own dedicated
   section. Explicitly, deliberately does **not** claim the 4 systems "agree" or blend them into one
   score — 4 structurally independent traditions with no established cross-framework equivalence, so
   claiming genuine convergence between them would itself be exactly the kind of fabricated synthesis
   this project's standing quality bar rules out. What it does do: lay each system's own real signal out
   for the person's own cross-reference.
5. **A genuine pre-existing bug caught along the way** (not reported by the user — found by this
   session's own new test suite): `describeMonthlyHighlightMeaning`'s relationship-note text was built by
   calling the bilingual `bt(en, zh)` helper immediately and storing the result in a variable, then later
   reading `.en`/`.zh` off it — but `bt()` returns a plain resolved STRING, not an `{en, zh}` object, so
   those reads were always `undefined`, silently inserting the literal text "undefined" into every single
   Monthly Deep Reading highlight, in both languages, since that feature was first built. Fixed by
   building a real `{en, zh}` pair and resolving it once, at final output — see `CLAUDE.md`'s "Known
   project-specific gotchas" for this bug class, since it's easy to reintroduce.

**Verification for this session's work:** 5 new dedicated test files (`test_astro_synastry_score.js`,
`test_annual_monthly_houses.js`, `test_truecompat_synastry_upgrade.js`, `test_cross_system_synthesis.js`,
plus the natal/annual/monthly test from the prior round), ~152 new checks. Full project regression suite
went from 1830 → 1858 → 1892 → 1906 → 1950 checks across the session's incremental changes, **0 failures
at every step**.

## Migration to local git / VS Code / Claude Code (2026-09-30)

The project was moved out of the hosted Claude.ai Project workspace into a plain git repository so it
can be developed locally in VS Code with Claude Code. What changed as part of the move (not a feature
change to the app itself):

- The regression test suite (106 files, previously living only in an ephemeral session scratchpad that
  was never part of the delivered project files) was recovered, rewritten to resolve the project root
  relative to each file's own location instead of a hardcoded absolute container path, and added to the
  repo under `tests/`, with `npm test` wired up via a new `package.json`. Re-verified from a completely
  different filesystem location: **1950 passed, 0 failed**, identical to the in-container result.
- `CLAUDE.md` added at the repo root — this is the file Claude Code reads automatically for
  project-specific instructions, so the standing "always run the full suite, always update the changelog,
  nothing half-baked" instructions now travel with the repo itself rather than living only in a
  Claude.ai Project's own configuration.
- This file (`SESSION_HISTORY_SUMMARY.md`) was written as an onboarding map into the much longer
  `UPDATE_NOTES_AND_INSTRUCTIONS.md`, which was carried over unchanged as the authoritative changelog.

No application code changed as part of this migration — `app.js`, `engine-core.js`,
`engine-metaphysics.js`, `engine-predictions.js`, `auth.js`, `index.html`, and `styles.css` are byte-for-
byte the same files that were last delivered and verified inside the hosted session.

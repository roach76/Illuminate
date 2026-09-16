"""
config.py — Settings for the job search scraper.

API keys are read from environment variables, NOT hardcoded here — this
keeps them out of the repo entirely, so even if the repo is later made
public or forked, no credentials leak.

Local run:  set them in your shell before running, e.g.
    export ADZUNA_APP_ID="your_id"
    export ADZUNA_APP_KEY="your_key"
    export JOOBLE_API_KEY="your_key"
    export CAREERJET_AFFILIATE_ID="your_key"
  (On Windows PowerShell: $env:ADZUNA_APP_ID="your_id")

GitHub Actions run: set them as encrypted repo Secrets
(Settings -> Secrets and variables -> Actions) with these exact names;
the workflow file injects them as environment variables automatically.
"""

import os

# ---------------------------------------------------------------------------
# API CREDENTIALS  (all free-tier signups — see README.md)
# ---------------------------------------------------------------------------
ADZUNA_APP_ID = os.environ.get("ADZUNA_APP_ID", "")      # https://developer.adzuna.com/
ADZUNA_APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")
JOOBLE_API_KEY = os.environ.get("JOOBLE_API_KEY", "")    # https://jooble.org/api/about

# Careerjet — free self-serve "Publisher" API, register at
# https://www.careerjet.com/partners/register/as-publisher (no cost, no
# approval wait observed during setup). Confirmed genuine self-serve public
# API via their own documentation at https://www.careerjet.com/partners/api
# — NOT a third-party scraper wrapping their site.
CAREERJET_AFFILIATE_ID = os.environ.get("CAREERJET_AFFILIATE_ID", "")

# The Careerjet API requires a locale_code in the form [language]_[COUNTRY],
# e.g. "en_GB", "en_US". Singapore's dedicated market exists at
# careerjet.sg (33,000+ live postings, confirmed by visiting the site) but
# the exact locale_code Careerjet expects for it was not confirmed against
# a live API key during setup — VERIFY THIS after registering (see
# README.md Careerjet section) and correct it here if the API returns
# "Unsupported locale code" for "en_SG".
CAREERJET_LOCALE_CODE = "en_SG"

# ---------------------------------------------------------------------------
# SEARCH PARAMETERS
# ---------------------------------------------------------------------------
COUNTRY_CODE = "sg"          # Adzuna country code (sg = Singapore)
LOCATION = "Singapore"

# Job titles to search for (each run as a separate query against every source)
SEARCH_TITLES = [
    "Regional Director Customer Success",
    "Director Service Delivery",
    "Director Customer Operations",
    "Senior Director Customer Success",
    "Head of Customer Success",
    "Regional Director Service Delivery",
    "VP Customer Success APAC",
    "Director Client Services APAC",
]

# Minimum seniority keywords — a posting's title must contain at least one
# of these (case-insensitive) to be kept. Filters out individual-contributor
# and manager-level noise.
SENIORITY_KEYWORDS = [
    "director", "vp", "vice president", "head of", "senior director",
    "regional director", "chief",
]

# Keywords that, if found in the title, cause a posting to be DROPPED
# (adjust as your search evolves)
EXCLUDE_TITLE_KEYWORDS = [
    "intern", "internship", "junior", "executive assistant", "sales director",
]

# ---------------------------------------------------------------------------
# LOCATION FILTER — applied to every source, not just Adzuna/Jooble
# ---------------------------------------------------------------------------
# Adzuna and Jooble accept a location parameter in the request itself, but
# Greenhouse, Lever, Workday, and Eightfold do not — those APIs return every
# open role at the company worldwide. Without a filter, a single company
# with a large global board (e.g. Addepar's ~100 roles) would flood the
# results with non-Singapore postings. This keyword list is checked against
# each posting's location field AFTER fetching, for every source, so
# "Singapore only" is enforced consistently everywhere.
#
# Kept deliberately broader than the literal string "Singapore" alone,
# since some listings say "Remote, Singapore", "SG - Singapore", or name a
# multi-country posting that includes Singapore among a few named cities.
LOCATION_FILTER_KEYWORDS = [
    "singapore",
    "sg -",     # matches Visa's Workday location format, e.g. "SG - Singapore"
]

# If True, only postings whose location field matches one of the keywords
# above are kept, for EVERY source (Adzuna/Jooble included, as a second
# check on top of their own location parameter, which occasionally returns
# nearby-country results). Set False to disable and see all locations.
RESTRICT_TO_SINGAPORE = True

# ---------------------------------------------------------------------------
# COMPANY CAREER FEEDS (public ATS APIs — no key required)
# ---------------------------------------------------------------------------
# Each entry below was individually verified by inspecting the company's
# real careers page in a browser and confirming a live, working, public,
# unauthenticated API call — not guessed from a URL pattern. See
# UPDATE_NOTES_AND_INSTRUCTIONS.md for the verification log.
#
# Greenhouse public board API: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
# Find a company's slug by checking its careers page URL, e.g.
#   boards.greenhouse.io/qlik       -> slug is "qlik"
#   job-boards.greenhouse.io/addepar1 -> slug is "addepar1" (NOT the company's
#   common name — always confirm the actual slug from the live page, since
#   companies sometimes use a different slug than their domain name)
GREENHOUSE_COMPANY_SLUGS = [
    "addepar1",   # verified 2026-09-14: real jobs, incl. Singapore-based roles
]

# Lever public API: https://api.lever.co/v0/postings/{slug}?mode=json
LEVER_COMPANY_SLUGS = [
    # "some-company",
]

# Workday public "candidate experience" API (undocumented but used by
# Workday's own career-site frontend with no authentication — same data any
# site visitor's browser loads). Very common among large enterprises.
# Find {tenant} and {site} from the company's careers URL, e.g.
#   https://spectris.wd3.myworkdayjobs.com/Malvern_Panalytical_Careers
#     -> tenant = "spectris", site = "Malvern_Panalytical_Careers"
#   https://visa.wd5.myworkdayjobs.com/Visa
#     -> tenant = "visa", site = "Visa"
# The numeric subdomain (wd1, wd3, wd5, ...) varies per company — copy it
# exactly from the real URL, it is NOT always the same as the tenant.
WORKDAY_COMPANIES = [
    {"tenant": "spectris", "wd_host": "wd3", "site": "Malvern_Panalytical_Careers"},
    {"tenant": "visa", "wd_host": "wd5", "site": "Visa"},
]

# Eightfold AI-powered career hubs (a white-labelled candidate portal some
# companies use, e.g. careerhub.qlik.com). Find {domain} from the site's own
# outbound API calls (view Network tab -> look for /api/pcsx/search?domain=...).
EIGHTFOLD_COMPANIES = [
    {"careerhub_host": "careerhub.qlik.com", "domain": "qlik.com"},
]

# ---------------------------------------------------------------------------
# OUTPUT
# ---------------------------------------------------------------------------
OUTPUT_DIR = "output"
SEEN_JOBS_FILE = "seen_jobs.json"   # tracks postings already reported, to avoid duplicate rows across daily runs
DAILY_LOG_FILE = "run_log.txt"

"""
scraper.py — Pulls job postings from legitimate public APIs (no ToS-violating
scraping of LinkedIn/Glassdoor/Indeed/JobStreet pages).

Sources used:
  1. Adzuna Job Search API   — https://developer.adzuna.com/
  2. Jooble Job Search API   — https://jooble.org/api/about
  3. Careerjet Job Search API — https://www.careerjet.com/partners/api
  4. Greenhouse public board API (per-company, no key needed)
  5. Lever public postings API (per-company, no key needed)
  6. Workday public candidate-experience API (per-company, no key needed —
     undocumented but genuinely public; see fetch_workday() docstring)
  7. Eightfold AI career hub public search API (per-company, no key needed)

Every source is filtered to Singapore-only postings after fetching (see
config.RESTRICT_TO_SINGAPORE) since only Adzuna/Jooble accept a location
parameter natively — the company-ATS sources (3-6) return worldwide results
by default and would otherwise flood the output with non-Singapore roles.

Run this daily (via cron / Task Scheduler). It appends new, previously-unseen
postings to a CSV in OUTPUT_DIR and keeps a seen_jobs.json to avoid duplicate
rows across runs, per your "no duplicates" preference.

This script does NOT score postings against a resume — that step is
intentionally separate (see match_report.py) so job descriptions can be
reviewed for accuracy before any percentage match is generated.
"""

import json
import csv
import os
import sys
import time
from datetime import datetime, timezone

import requests

import config


def log(msg):
    line = f"[{datetime.now(timezone.utc).isoformat()}] {msg}"
    print(line)
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    with open(os.path.join(config.OUTPUT_DIR, config.DAILY_LOG_FILE), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_seen_jobs():
    path = os.path.join(config.OUTPUT_DIR, config.SEEN_JOBS_FILE)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_seen_jobs(seen_set):
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    path = os.path.join(config.OUTPUT_DIR, config.SEEN_JOBS_FILE)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(seen_set), f, indent=2)


def passes_title_filters(title):
    t = title.lower()
    if not any(k in t for k in config.SENIORITY_KEYWORDS):
        return False
    if any(k in t for k in config.EXCLUDE_TITLE_KEYWORDS):
        return False
    return True


def fetch_adzuna(query):
    """Adzuna Job Search API — https://developer.adzuna.com/docs/search"""
    if not config.ADZUNA_APP_ID or not config.ADZUNA_APP_KEY:
        log("Adzuna: skipped (no API key set in config.py)")
        return []

    url = f"https://api.adzuna.com/v1/api/jobs/{config.COUNTRY_CODE}/search/1"
    params = {
        "app_id": config.ADZUNA_APP_ID,
        "app_key": config.ADZUNA_APP_KEY,
        "what": query,
        "where": config.LOCATION,
        "results_per_page": 50,
        "content-type": "application/json",
    }
    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        log(f"Adzuna: request failed for '{query}': {e}")
        return []

    results = []
    for job in data.get("results", []):
        results.append({
            "source": "Adzuna",
            "title": job.get("title", "").strip(),
            "company": (job.get("company") or {}).get("display_name", ""),
            "location": (job.get("location") or {}).get("display_name", ""),
            "description": job.get("description", ""),
            "url": job.get("redirect_url", ""),
            "posted_date": job.get("created", ""),
            "salary_min": job.get("salary_min", ""),
            "salary_max": job.get("salary_max", ""),
        })
    return results


def fetch_jooble(query):
    """Jooble Job Search API — https://jooble.org/api/about"""
    if not config.JOOBLE_API_KEY:
        log("Jooble: skipped (no API key set in config.py)")
        return []

    url = f"https://jooble.org/api/{config.JOOBLE_API_KEY}"
    payload = {"keywords": query, "location": config.LOCATION}
    try:
        resp = requests.post(url, json=payload, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        log(f"Jooble: request failed for '{query}': {e}")
        return []

    results = []
    for job in data.get("jobs", []):
        results.append({
            "source": "Jooble",
            "title": job.get("title", "").strip(),
            "company": job.get("company", ""),
            "location": job.get("location", ""),
            "description": job.get("snippet", ""),
            "url": job.get("link", ""),
            "posted_date": job.get("updated", ""),
            "salary_min": "",
            "salary_max": "",
        })
    return results


def fetch_careerjet(query):
    """
    Careerjet Job Search API — https://www.careerjet.com/partners/api
    Confirmed genuine self-serve public API (free registration at
    careerjet.com/partners/register/as-publisher), not a third-party
    scraper. Uses HTTP Basic auth: the affiliate ID as the username, an
    empty password. Requires user_ip and user_agent params per their spec
    — since this scraper has no real end-user, a generic placeholder is
    sent (see note below); this matches how a server-side batch job would
    reasonably use this API, as opposed to a live per-visitor website.
    """
    if not config.CAREERJET_AFFILIATE_ID:
        log("Careerjet: skipped (no affiliate ID set in config.py)")
        return []

    url = "https://search.api.careerjet.net/v4/query"
    auth = (config.CAREERJET_AFFILIATE_ID, "")  # Basic auth: key as username, blank password
    params = {
        "locale_code": config.CAREERJET_LOCALE_CODE,
        "keywords": query,
        "location": config.LOCATION,
        "page_size": 50,
        "sort": "date",
        # Careerjet's API requires these two fields to attribute the
        # request to an end user; this scraper runs as an unattended
        # batch job with no real visitor, so a generic placeholder is
        # used rather than fabricating a fake individual's identity.
        "user_ip": "0.0.0.0",
        "user_agent": "job-search-scraper/1.0 (batch job, not a live website visitor)",
    }
    try:
        resp = requests.get(url, params=params, auth=auth, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        log(f"Careerjet: request failed for '{query}': {e}")
        return []

    if data.get("type") == "LOCATIONS":
        # Careerjet couldn't resolve config.LOCATION to a single match —
        # either "no matching location found" or "multiple locations
        # found". Either way, no jobs were returned for this query.
        log(f"Careerjet: location lookup issue for '{query}': {data.get('message')}")
        return []

    results = []
    for job in data.get("jobs", []):
        results.append({
            "source": "Careerjet",
            "title": job.get("title", "").strip(),
            "company": job.get("company", ""),
            "location": job.get("locations", ""),
            "description": job.get("description", ""),
            "url": job.get("url", ""),
            "posted_date": job.get("date", ""),
            "salary_min": job.get("salary_min", ""),
            "salary_max": job.get("salary_max", ""),
        })
    return results


def fetch_greenhouse(company_slug):
    """Greenhouse public board API — no key required."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{company_slug}/jobs"
    try:
        resp = requests.get(url, params={"content": "true"}, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        log(f"Greenhouse: request failed for '{company_slug}': {e}")
        return []

    results = []
    for job in data.get("jobs", []):
        location = (job.get("location") or {}).get("name", "")
        results.append({
            "source": f"Greenhouse:{company_slug}",
            "title": job.get("title", "").strip(),
            "company": company_slug,
            "location": location,
            "description": job.get("content", ""),  # HTML; stripped later if needed
            "url": job.get("absolute_url", ""),
            "posted_date": job.get("updated_at", ""),
            "salary_min": "",
            "salary_max": "",
        })
    return results


def fetch_lever(company_slug):
    """Lever public postings API — no key required."""
    url = f"https://api.lever.co/v0/postings/{company_slug}"
    try:
        resp = requests.get(url, params={"mode": "json"}, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        log(f"Lever: request failed for '{company_slug}': {e}")
        return []

    results = []
    for job in data:
        location = (job.get("categories") or {}).get("location", "")
        results.append({
            "source": f"Lever:{company_slug}",
            "title": job.get("text", "").strip(),
            "company": company_slug,
            "location": location,
            "description": (job.get("descriptionPlain") or job.get("description") or ""),
            "url": job.get("hostedUrl", ""),
            "posted_date": job.get("createdAt", ""),
            "salary_min": "",
            "salary_max": "",
        })
    return results


def fetch_workday(tenant, wd_host, site):
    """
    Workday public candidate-experience API. Undocumented but genuinely
    public and unauthenticated — this is the exact same endpoint the
    company's own careers page JavaScript calls to render job listings for
    any site visitor. Verified working 2026-09-14 against Malvern
    Panalytical and Visa (see UPDATE_NOTES_AND_INSTRUCTIONS.md).

    Uses config.LOCATION as a free-text search term, since Workday's API
    takes a searchText parameter rather than a structured location filter.
    The location-keyword filter in run() is still applied afterward as a
    safety net, since Workday's free-text search can occasionally return
    loosely-related results.
    """
    url = f"https://{tenant}.{wd_host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
    payload = {"appliedFacets": {}, "limit": 20, "offset": 0, "searchText": config.LOCATION}
    try:
        resp = requests.post(url, json=payload, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        log(f"Workday: request failed for '{tenant}/{site}': {e}")
        return []

    results = []
    for job in data.get("jobPostings", []):
        # Workday returns a relative path; build the full posting URL.
        external_path = job.get("externalPath", "")
        full_url = f"https://{tenant}.{wd_host}.myworkdayjobs.com/{site}{external_path}" if external_path else ""
        results.append({
            "source": f"Workday:{tenant}",
            "title": job.get("title", "").strip(),
            "company": tenant,
            "location": job.get("locationsText", ""),
            "description": "",  # Workday's list endpoint doesn't include full JD text;
                                 # would need a second call per job to fetch it — skipped
                                 # for now to keep this a single request per company.
            "url": full_url,
            "posted_date": job.get("postedOn", ""),
            "salary_min": "",
            "salary_max": "",
        })
    return results


def fetch_eightfold(careerhub_host, domain):
    """
    Eightfold AI-powered career hub public search API. Verified working
    2026-09-14 against Qlik's careerhub.qlik.com (see
    UPDATE_NOTES_AND_INSTRUCTIONS.md). No API key required — this is the
    same endpoint the career hub page itself calls.
    """
    url = f"https://{careerhub_host}/api/pcsx/search"
    params = {"domain": domain, "query": config.LOCATION, "location": config.LOCATION, "start": 0}
    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        log(f"Eightfold: request failed for '{careerhub_host}': {e}")
        return []

    results = []
    positions = (data.get("data") or {}).get("positions", [])
    for pos in positions:
        locations = pos.get("locations") or []
        position_url = pos.get("positionUrl", "")
        full_url = f"https://{careerhub_host}{position_url}" if position_url else ""
        results.append({
            "source": f"Eightfold:{domain}",
            "title": pos.get("name", "").strip(),
            "company": domain,
            "location": ", ".join(locations),
            "description": "",  # search endpoint doesn't include full JD text;
                                 # a second call per job would be needed for that
            "url": full_url,
            "posted_date": "",  # Eightfold returns a Unix timestamp (postedTs) rather
                                 # than a formatted date; left blank rather than
                                 # guessing a format conversion that might be wrong
            "salary_min": "",
            "salary_max": "",
        })
    return results


def passes_location_filter(location_text):
    """
    Checks a posting's location field against config.LOCATION_FILTER_KEYWORDS.
    Applied to every source when config.RESTRICT_TO_SINGAPORE is True, since
    Greenhouse/Lever/Workday/Eightfold have no native location parameter and
    return worldwide results by default.
    """
    if not config.RESTRICT_TO_SINGAPORE:
        return True
    loc = (location_text or "").lower()
    return any(kw in loc for kw in config.LOCATION_FILTER_KEYWORDS)


def make_job_id(job):
    """Stable dedup key: URL if present, else title+company."""
    if job.get("url"):
        return job["url"]
    return f"{job.get('title','')}::{job.get('company','')}"


def run():
    log("=== Daily job scrape started ===")
    all_jobs = []

    # 1. Aggregator APIs — one call per search title
    for title_query in config.SEARCH_TITLES:
        all_jobs.extend(fetch_adzuna(title_query))
        time.sleep(1)  # be polite to rate limits
        all_jobs.extend(fetch_jooble(title_query))
        time.sleep(1)
        all_jobs.extend(fetch_careerjet(title_query))
        time.sleep(1)

    # 2. Company ATS feeds — one call per company, covers all their open roles
    for slug in config.GREENHOUSE_COMPANY_SLUGS:
        all_jobs.extend(fetch_greenhouse(slug))
        time.sleep(1)
    for slug in config.LEVER_COMPANY_SLUGS:
        all_jobs.extend(fetch_lever(slug))
        time.sleep(1)
    for wd in config.WORKDAY_COMPANIES:
        all_jobs.extend(fetch_workday(wd["tenant"], wd["wd_host"], wd["site"]))
        time.sleep(1)
    for ef in config.EIGHTFOLD_COMPANIES:
        all_jobs.extend(fetch_eightfold(ef["careerhub_host"], ef["domain"]))
        time.sleep(1)

    log(f"Fetched {len(all_jobs)} raw postings before filtering")

    # 3. Filter by seniority/title keywords
    filtered = [j for j in all_jobs if passes_title_filters(j["title"])]
    log(f"{len(filtered)} postings passed title/seniority filters")

    # 3b. Filter by location — applied to every source, since only
    # Adzuna/Jooble accept a location parameter natively (see
    # config.RESTRICT_TO_SINGAPORE and config.LOCATION_FILTER_KEYWORDS)
    before_location_filter = len(filtered)
    filtered = [j for j in filtered if passes_location_filter(j.get("location", ""))]
    log(f"{len(filtered)} of {before_location_filter} postings passed the Singapore location filter")

    # 4. Dedup against previously-seen jobs (across all runs, per your
    #    "no duplicates" preference) AND within this run
    seen = load_seen_jobs()
    new_jobs = []
    seen_this_run = set()
    for job in filtered:
        job_id = make_job_id(job)
        if job_id in seen or job_id in seen_this_run:
            continue
        seen_this_run.add(job_id)
        new_jobs.append(job)

    log(f"{len(new_jobs)} new postings (not seen in prior runs)")

    if not new_jobs:
        log("No new postings today. Exiting.")
        save_seen_jobs(seen | seen_this_run)
        return

    # 5. Write dated CSV
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    out_path = os.path.join(config.OUTPUT_DIR, f"jobs_{date_str}.csv")

    fieldnames = ["source", "title", "company", "location", "posted_date",
                  "salary_min", "salary_max", "url", "description"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for job in new_jobs:
            writer.writerow({k: job.get(k, "") for k in fieldnames})

    log(f"Wrote {len(new_jobs)} new postings to {out_path}")

    # 6. Update seen-jobs registry
    save_seen_jobs(seen | seen_this_run)
    log("=== Daily job scrape finished ===")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        log(f"FATAL ERROR: {e}")
        sys.exit(1)

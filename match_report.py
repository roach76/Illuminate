"""
match_report.py — Scores scraped job postings against Roy Wong's resume
profile and writes a detailed HTML report (primary output) plus an Excel
report (secondary/legacy CLI output — the dashboard also offers Excel
export directly from the browser via a button, so this CLI Excel path is
kept for convenience but is no longer the main deliverable).

WHY THIS IS SEPARATE FROM scraper.py:
Match scoring against thin/aggregator descriptions can be misleading.
Run this only on postings where the "description" field in the CSV
contains a real, substantial job description (Greenhouse/Lever postings
and most Adzuna results qualify; short Jooble snippets may not).
The script flags low-confidence rows (short description) so you don't
mistake a shallow match for a validated one.

Usage:
    python match_report.py output/jobs_2026-09-07.csv

Output:
    output/match_report_2026-09-07.html   (primary — open in any browser)
    output/match_report_2026-09-07.xlsx   (secondary — quick Excel export)
"""

import csv
import html
import json
import os
import re
import sys
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------------------
# RESUME KEYWORD PROFILE
# Built from Roy Wong's CV (Roy_Wong_CV_190826.docx). Grouped by category so
# the score reflects breadth of fit, not just raw keyword count.
# Update this if the resume changes.
# ---------------------------------------------------------------------------
RESUME_PROFILE = {
    "core_titles": [
        "customer success", "service delivery", "regional operations",
        "customer experience", "professional services",
    ],
    "seniority": [
        "director", "head of", "regional director", "senior director", "vp",
    ],
    "domain_skills": [
        "sla", "kpi", "escalation", "renewal", "retention", "churn",
        "customer health", "ebr", "qbr", "voc", "customer advocacy",
        "onboarding", "time-to-value", "adoption", "csat", "nps",
        "gross revenue retention", "net revenue retention", "grr", "nrr",
        "service governance", "operating model", "risk management",
        "continuous improvement", "contract renewal", "forecasting",
        "account expansion", "stakeholder management",
    ],
    "leadership_scope": [
        "asean", "apac", "cross-functional", "multi-country", "regional team",
        "p&l", "executive stakeholder", "c-suite", "cio", "cmio",
    ],
    "tools": [
        "salesforce", "servicemax", "visio", "gainsight", "bi", "reporting tools",
    ],
    "industry": [
        "healthcare", "healthcare it", "hcis", "medtech", "imaging",
        "health it", "digital health",
    ],
}

# Weight per category (must sum to 1.0) — reflects what matters most for
# ATS keyword match and genuine role fit.
CATEGORY_WEIGHTS = {
    "core_titles": 0.25,
    "seniority": 0.15,
    "domain_skills": 0.30,
    "leadership_scope": 0.15,
    "tools": 0.05,
    "industry": 0.10,
}

MATCH_THRESHOLD = 75  # percent — only rows at/above this get highlighted
LOW_CONFIDENCE_DESC_LENGTH = 200  # characters; below this, flag as low-confidence


def clean_text(text):
    """Strip HTML tags (Greenhouse/Lever descriptions are often HTML) and lowercase."""
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", text)
    return text.lower().strip()


def score_job(title, description):
    """
    Returns (overall_pct, category_breakdown_dict, matched_keywords_list).

    This mirrors how ATS keyword matching actually works: it looks at which
    of the JD's OWN requirement terms are present in Roy's resume profile —
    not the reverse. Scoring "% of Roy's full skill list mentioned in one
    JD" would unfairly punish every real posting, since no single JD ever
    restates an entire 15-year skill inventory.

    Method:
      1. Extract candidate requirement terms from the JD by checking, per
         category, which of Roy's known keywords appear in the JD text.
         (Roy's keyword list acts as the recognized-vocabulary the JD is
         scanned against — a proxy for "if the JD wants this and Roy has
         it, that's a match".)
      2. Category score = coverage of the JD's mentioned terms in that
         category that Roy's resume covers. Since Roy's resume covers 100%
         of its own listed keywords by construction, this collapses to:
         category score = 100% if the JD mentions >=1 term in that
         category, scaled by how many distinct terms the JD mentions
         relative to a realistic single-JD ceiling (capped, not the full
         category length).
    """
    full_text = clean_text(title + " " + description)

    # Realistic ceiling: how many keywords a well-written single JD would
    # plausibly mention from a category, before treating the category as
    # "fully addressed" for that posting.
    CATEGORY_CEILING = {
        "core_titles": 1,
        "seniority": 1,
        "domain_skills": 5,
        "leadership_scope": 2,
        "tools": 1,
        "industry": 1,
    }

    breakdown = {}
    matched_all = []
    for category, keywords in RESUME_PROFILE.items():
        found = [kw for kw in keywords if kw in full_text]
        matched_all.extend(found)
        ceiling = CATEGORY_CEILING.get(category, len(keywords))
        pct = min((len(found) / ceiling) * 100, 100) if ceiling else 0
        breakdown[category] = round(pct, 1)

    overall = sum(breakdown[cat] * CATEGORY_WEIGHTS[cat] for cat in RESUME_PROFILE)
    return round(overall, 1), breakdown, matched_all


def build_scored_data(jobs):
    """
    Scores all jobs and returns a list of dicts (JSON-serializable) sorted
    by match % descending. This is the shared data structure used by both
    the HTML report and the dashboard's embedded dataset.
    """
    scored = []
    for job in jobs:
        title = job.get("title", "")
        description = job.get("description", "")
        overall, breakdown, matched = score_job(title, description)
        is_low_conf = len(clean_text(description)) < LOW_CONFIDENCE_DESC_LENGTH
        scored.append({
            "match_pct": overall,
            "confidence": "LOW" if is_low_conf else "OK",
            "title": job.get("title", ""),
            "company": job.get("company", ""),
            "location": job.get("location", ""),
            "source": job.get("source", ""),
            "posted_date": job.get("posted_date", ""),
            "url": job.get("url", ""),
            "description": description,
            "breakdown": breakdown,
            "matched_keywords": sorted(set(matched)),
        })
    scored.sort(key=lambda r: r["match_pct"], reverse=True)
    return scored


def build_html_report(scored_jobs, out_path, generated_label):
    """
    Writes a self-contained HTML report: a detailed table (all postings,
    sorted by match %, 75%+ highlighted) plus the same data embedded as
    JSON so this file can also be opened directly as a lightweight
    dashboard. For the full dashboard experience (resume/cover letter
    generation, application tracking), use dashboard.html instead — this
    report is the "detailed report" deliverable on its own.
    """
    total = len(scored_jobs)
    high_conf_75 = sum(1 for j in scored_jobs if j["match_pct"] >= MATCH_THRESHOLD and j["confidence"] == "OK")
    low_conf_75 = sum(1 for j in scored_jobs if j["match_pct"] >= MATCH_THRESHOLD and j["confidence"] == "LOW")

    rows_html = []
    for j in scored_jobs:
        is_high = j["match_pct"] >= MATCH_THRESHOLD and j["confidence"] == "OK"
        conf_label = "LOW (thin JD text)" if j["confidence"] == "LOW" else "OK"
        conf_class = "conf-low" if j["confidence"] == "LOW" else ""
        row_class = "high-match" if is_high else ""
        matched_kw = ", ".join(j["matched_keywords"]) if j["matched_keywords"] else "—"
        url = html.escape(j["url"]) if j["url"] else ""
        link_html = f'<a href="{url}" target="_blank" rel="noopener">Open posting</a>' if url else "—"
        rows_html.append(f"""
        <tr class="{row_class}">
          <td class="match-pct">{j['match_pct']}%</td>
          <td class="{conf_class}">{html.escape(conf_label)}</td>
          <td>{html.escape(j['title'])}</td>
          <td>{html.escape(j['company'])}</td>
          <td>{html.escape(j['location'])}</td>
          <td>{html.escape(j['source'])}</td>
          <td>{html.escape(str(j['posted_date']))}</td>
          <td class="small">{html.escape(matched_kw)}</td>
          <td>{link_html}</td>
        </tr>""")

    embedded_json = json.dumps(scored_jobs, indent=2)

    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Job Match Report — {html.escape(generated_label)}</title>
<style>
  body {{ font-family: Georgia, 'Times New Roman', serif; background: #fbfaf7; color: #1c2b33; margin: 0; padding: 2.5rem 3rem; }}
  h1 {{ font-size: 1.5rem; margin-bottom: 0.2rem; }}
  p.meta {{ color: #5b5346; font-size: 0.9rem; margin-top: 0; }}
  .summary {{ display: flex; gap: 2rem; margin: 1.5rem 0 2rem; flex-wrap: wrap; }}
  .stat {{ background: #fff; border: 1px solid #d8d3c8; padding: 0.8rem 1.2rem; min-width: 160px; }}
  .stat .num {{ font-size: 1.6rem; font-weight: 700; display: block; }}
  .stat .label {{ font-size: 0.8rem; color: #5b5346; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.88rem; background: #fff; }}
  th, td {{ padding: 0.5rem 0.65rem; border-bottom: 1px solid #d8d3c8; text-align: left; vertical-align: top; }}
  th {{ background: #1c2b33; color: #fff; font-weight: 500; position: sticky; top: 0; }}
  tr.high-match td {{ background: #dcecdf; }}
  td.match-pct {{ font-weight: 700; white-space: nowrap; }}
  td.conf-low {{ color: #8a8378; font-style: italic; }}
  td.small {{ font-size: 0.8rem; max-width: 28ch; }}
  a {{ color: #2f5d50; }}
  .note {{ font-size: 0.82rem; color: #5b5346; margin-top: 2rem; max-width: 70ch; line-height: 1.5; }}
</style>
</head>
<body>
<h1>Job Match Report</h1>
<p class="meta">Generated {html.escape(generated_label)} · Scored against Roy Wong's resume profile · Threshold: {MATCH_THRESHOLD}%+</p>

<div class="summary">
  <div class="stat"><span class="num">{total}</span><span class="label">Total postings scored</span></div>
  <div class="stat"><span class="num">{high_conf_75}</span><span class="label">At {MATCH_THRESHOLD}%+ (high confidence)</span></div>
  <div class="stat"><span class="num">{low_conf_75}</span><span class="label">At {MATCH_THRESHOLD}%+ (LOW confidence)</span></div>
</div>

<table>
  <thead>
    <tr>
      <th>Match %</th><th>Confidence</th><th>Title</th><th>Company</th>
      <th>Location</th><th>Source</th><th>Posted</th><th>Matched Keywords</th><th>Link</th>
    </tr>
  </thead>
  <tbody>
    {''.join(rows_html)}
  </tbody>
</table>

<p class="note">
  Rows marked "LOW (thin JD text)" were scored on a short description or
  snippet rather than a full job posting — treat that score as a lead to
  investigate, not a verified match. Open the posting and read the full
  text before relying on the number. For a full interactive dashboard
  with tailored resume/cover letter generation and an application
  tracker, open <code>dashboard.html</code> and load this same data.
</p>

<script id="job-data" type="application/json">
{embedded_json}
</script>
</body>
</html>
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html_doc)
    return total, high_conf_75, low_conf_75


def load_jobs_csv(path):
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build_excel_report(scored_jobs, out_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Job Match Report"

    headers = [
        "Match %", "Confidence", "Title", "Company", "Location", "Source",
        "Posted Date", "Core Title Match %", "Seniority Match %",
        "Domain Skills Match %", "Leadership Scope Match %", "Tools Match %",
        "Industry Match %", "Matched Keywords", "URL",
    ]
    ws.append(headers)

    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for col_idx, _ in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    high_match_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    low_conf_font = Font(italic=True, color="808080")

    for j in scored_jobs:
        is_low_conf = j["confidence"] == "LOW"
        confidence = "LOW (thin JD text)" if is_low_conf else "OK"
        breakdown = j["breakdown"]
        row = [
            j["match_pct"],
            confidence,
            j["title"],
            j["company"],
            j["location"],
            j["source"],
            j["posted_date"],
            breakdown.get("core_titles", 0),
            breakdown.get("seniority", 0),
            breakdown.get("domain_skills", 0),
            breakdown.get("leadership_scope", 0),
            breakdown.get("tools", 0),
            breakdown.get("industry", 0),
            ", ".join(j["matched_keywords"]),
            j["url"],
        ]
        ws.append(row)
        r = ws.max_row
        if j["match_pct"] >= MATCH_THRESHOLD and not is_low_conf:
            for c in range(1, len(headers) + 1):
                ws.cell(row=r, column=c).fill = high_match_fill
        if is_low_conf:
            ws.cell(row=r, column=2).font = low_conf_font

    # Column widths
    widths = [10, 18, 38, 20, 18, 16, 14, 12, 12, 14, 14, 10, 12, 45, 45]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws.freeze_panes = "A2"

    # Summary sheet
    summary = wb.create_sheet("Summary")
    total = len(scored_jobs)
    high_conf_75 = sum(1 for j in scored_jobs if j["match_pct"] >= MATCH_THRESHOLD and j["confidence"] == "OK")
    low_conf_75 = sum(1 for j in scored_jobs if j["match_pct"] >= MATCH_THRESHOLD and j["confidence"] == "LOW")
    summary.append(["Job Match Report Summary"])
    summary.append(["Generated", datetime.now().strftime("%Y-%m-%d %H:%M")])
    summary.append(["Total postings scored", total])
    summary.append([f"Postings at {MATCH_THRESHOLD}%+ match (high confidence)", high_conf_75])
    summary.append([f"Postings at {MATCH_THRESHOLD}%+ match (LOW confidence — thin JD)", low_conf_75])
    summary.append([])
    summary.append(["Note: Low-confidence rows scored on a short description/snippet."])
    summary.append(["Open the job's URL and re-run scoring with the full JD pasted in"])
    summary.append(["before treating that score as reliable."])
    summary["A1"].font = Font(bold=True, size=14)
    for row in range(2, 9):
        summary.cell(row=row, column=1).font = Font(size=11)
    summary.column_dimensions["A"].width = 60

    wb.save(out_path)
    return total, high_conf_75, low_conf_75


def main():
    if len(sys.argv) < 2:
        print("Usage: python match_report.py <path_to_jobs_csv>")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        sys.exit(1)

    jobs = load_jobs_csv(csv_path)
    scored_jobs = build_scored_data(jobs)

    date_str = datetime.now().strftime("%Y-%m-%d")
    generated_label = datetime.now().strftime("%Y-%m-%d %H:%M")
    out_dir = os.path.dirname(csv_path) or "."

    html_out_path = os.path.join(out_dir, f"match_report_{date_str}.html")
    xlsx_out_path = os.path.join(out_dir, f"match_report_{date_str}.xlsx")

    total, high, low = build_html_report(scored_jobs, html_out_path, generated_label)
    build_excel_report(scored_jobs, xlsx_out_path)

    print(f"Scored {total} postings.")
    print(f"  {high} at {MATCH_THRESHOLD}%+ (high confidence)")
    print(f"  {low} at {MATCH_THRESHOLD}%+ (LOW confidence — verify JD before acting)")
    print(f"HTML report (primary):  {html_out_path}")
    print(f"Excel report (export):  {xlsx_out_path}")


if __name__ == "__main__":
    main()

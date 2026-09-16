"""
export_resume_js.py — Converts resume_data.py into resume_data.js so the
dashboard (a static HTML file, no build step) can use the exact same
resume content without duplicating it by hand.

Run this once after any change to resume_data.py:
    python3 export_resume_js.py

It regenerates resume_data.js in place. Commit both files together.
"""

import json
import resume_data as rd


def build_export():
    return {
        "candidateInfo": rd.CANDIDATE_INFO,
        "baseSummary": rd.BASE_SUMMARY,
        "baseSummaryLine2": rd.BASE_SUMMARY_LINE_2,
        "coreCompetencies": rd.CORE_COMPETENCIES,
        "experience": rd.EXPERIENCE,
        "education": rd.EDUCATION,
    }


def main():
    data = build_export()
    js_content = (
        "// AUTO-GENERATED from resume_data.py — do not hand-edit.\n"
        "// Regenerate with: python3 export_resume_js.py\n"
        "const RESUME_DATA = " + json.dumps(data, indent=2) + ";\n"
    )
    with open("resume_data.js", "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Wrote resume_data.js ({len(js_content)} bytes)")


if __name__ == "__main__":
    main()

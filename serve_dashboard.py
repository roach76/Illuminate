"""
serve_dashboard.py — Runs a tiny local web server so dashboard.html loads
over http://localhost instead of file://.

WHY THIS EXISTS: browsers treat localStorage under a file:// URL (i.e.
double-clicking dashboard.html directly) as officially UNDEFINED
behavior per the web standard itself (see MDN's own documentation on
Window.localStorage) — in practice this means manually-added jobs and
tracked application statuses can silently fail to persist across a page
reload, even though the exact same code works completely reliably when
served over a real http:// URL. This script is the fix: it serves the
job-scraper folder on localhost, so opening the dashboard at
http://localhost:8765/dashboard.html (instead of double-clicking the
file) gives localStorage its normal, standards-defined, actually-
persistent behavior.

Usage:
    python3 serve_dashboard.py
    (then open the printed http://localhost:8765/dashboard.html link)

Stop it with Ctrl+C when done. No installation needed — this only uses
Python's built-in http.server module, already required for this project.
"""

import http.server
import socketserver
import os
import webbrowser

PORT = 8765


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = http.server.SimpleHTTPRequestHandler

    try:
        with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
            url = f"http://localhost:{PORT}/dashboard.html"
            print(f"Serving this folder at http://localhost:{PORT}")
            print(f"Open the dashboard at: {url}")
            print("(This is the fix for manually-added jobs not persisting —")
            print(" localStorage is unreliable when a page is opened by double-")
            print(" clicking the file directly. Opening it through this server")
            print(" instead gives it normal, reliable browser storage.)")
            print("\nPress Ctrl+C to stop the server when you're done.\n")
            try:
                webbrowser.open(url)
            except Exception:
                pass  # not fatal if this fails — the person can still click the printed link
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Port {PORT} is already in use — either the server is already")
            print(f"running (just open http://localhost:{PORT}/dashboard.html),")
            print("or another program is using that port. Edit PORT at the top")
            print("of this file to use a different one, e.g. 8766.")
        else:
            raise


if __name__ == "__main__":
    main()

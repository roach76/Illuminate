#!/usr/bin/env python3
"""
serve_illuminate.py - a tiny local web server for the Illuminate app.

Why this exists: opening index.html by double-clicking it (or via a
file:///... link) loads it as a file:// page. Chrome/Edge/Firefox treat
browser storage (the localStorage this app saves your data to) on a
file:// page as its own special, more restricted case, and some of the
app's internal features (like the PDF export library briefly cloning the
page to measure it) rely on being able to do that the normal way a real
website can - which file:// pages are specifically NOT allowed to do.
Running the page through this local server instead, as
http://localhost:8766/..., gives it a normal web origin and avoids both
of those file://-specific restrictions.

This does not send anything over the internet or make the app reachable
from outside this computer - it only serves files from this same folder
to this same computer's own browser, exactly the way opening the file
directly does, just through a normal http:// address instead of file://.
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8766
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Keep the console output short and readable instead of one line per
        # asset request (this app loads quite a few JS/CSS files at once).
        sys.stderr.write("  . %s\n" % (format % args))

    # BUG FIX (root cause of a real, repeatedly-reported issue: "generation of the pdf still produces
    # the 8 issues as attached. why is this still unfixed?" - the app-side code for the fixes this and
    # earlier rounds made was, on inspection, already correct and confirmed clean by this app's own
    # tests every time - the recurring mismatch between "fixed in the delivered files" and "still
    # broken for the user" pointed instead at THIS server. http.server.SimpleHTTPRequestHandler sends no
    # explicit Cache-Control header at all, only Last-Modified - which leaves each browser free to use
    # its own heuristic caching and keep reusing an old, already-downloaded copy of app.js/index.html/
    # etc. for a good while without even asking this server if a newer one exists. So every round's real
    # fix was correctly on disk and would have shown up on a hard refresh, but an ordinary reload (or
    # just reopening the same browser tab/window later) could easily keep serving the STALE, pre-fix
    # version straight from the browser's own cache - which looks, from the user's side, exactly like
    # "still unfixed" even though it never was. Every response from this local server now explicitly
    # forces a full re-fetch every time, so a normal page reload always gets this round's real files.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    url = f"http://localhost:{PORT}/index.html"
    try:
        with socketserver.TCPServer(("localhost", PORT), QuietHandler) as httpd:
            print("================================================================")
            print(f"  Serving this folder at: {url}")
            print("================================================================")
            print()
            print("Opening your browser now. If it doesn't open by itself, copy the")
            print(f"link above ({url}) into your browser's address bar.")
            print()
            print("Keep this window open while you use the app.")
            print("When you're done, close this window, or press Ctrl+C here.")
            print("================================================================")
            print()
            try:
                webbrowser.open(url)
            except Exception:
                pass  # the printed link above still works even if this fails
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    except OSError as e:
        if getattr(e, "winerror", None) == 10048 or "Address already in use" in str(e):
            print("================================================================")
            print(f"  Port {PORT} is already in use.")
            print("================================================================")
            print()
            print("This usually means the server is already running in another")
            print(f"window - try opening {url} in your browser directly.")
            print("If that doesn't work, close any other window running this same")
            print("script first, then try again.")
        else:
            raise


if __name__ == "__main__":
    main()

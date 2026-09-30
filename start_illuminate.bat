@echo off
REM start_illuminate.bat — Opens Illuminate correctly.
REM
REM Double-click this file (instead of index.html) whenever you want to
REM use the app. This window stays open and shows the server's own log
REM while it's running — that's intentional, not a bug, so you can see
REM what it's doing and close it yourself when you're done.
REM
REM TO STOP THE SERVER: either close this window (click the X, same as
REM any other window), or click inside it and press Ctrl+C, then press
REM Y and Enter if asked to confirm. Either way is fine.
REM
REM WHY THIS EXISTS: opening index.html by double-clicking the file
REM directly loads it as a file:// page. Chrome/Edge/Firefox treat a
REM file:// page's storage and some of its browser features as a more
REM restricted special case than a normal website - this app's saved
REM data (localStorage) and its PDF-export step can both be affected.
REM Running the page through this local server instead (as
REM http://localhost:8766/index.html) gives it a normal web origin and
REM avoids both of those file://-specific restrictions.

title Illuminate - local server

REM Explicitly set to your file location
cd /d "C:\Users\roywl\Roach\Personal\Illuminate"

echo ================================================================
echo   Illuminate - local server
echo ================================================================
echo.
echo Starting the server. Once you see a "Serving this folder..." line
echo below, your browser should open automatically to the app.
echo.
echo If it doesn't open by itself, copy this link into your browser:
echo     http://localhost:8766/index.html
echo.
echo Keep THIS WINDOW OPEN while you use the app.
echo When you're done, just close this window, or press Ctrl+C here.
echo ================================================================
echo.

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python3 serve_illuminate.py
    goto :end
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python serve_illuminate.py
    goto :end
)

echo.
echo ================================================================
echo   ERROR: Python was not found on this computer.
echo ================================================================
echo.
echo Neither "python3" nor "python" is recognized as a command. This
echo usually means Python isn't installed, or wasn't added to PATH
echo during installation.
echo.
echo Install Python from https://www.python.org/downloads/ and, on the
echo first setup screen, make sure "Add python.exe to PATH" is checked
echo before clicking Install. Then double-click this file again.
echo.

:end
echo.
echo ================================================================
echo Server has stopped. This window will stay open so you can read
echo any messages above. Close this window whenever you're ready, or
echo press any key to close it now.
echo ================================================================
pause >nul

@echo off
setlocal
title Growth Garden

rem ------------------------------------------------------------------
rem  Growth Garden - one-click launcher
rem    1. Finds Python on your computer
rem    2. Creates a virtual environment   (first run only)
rem    3. Installs the dependencies        (first run only)
rem    4. Starts the server and opens your browser
rem ------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   ==========================================
echo      Growth Garden - starting up...
echo   ==========================================
echo.

rem ---- 1. Find Python ---------------------------------------
set "PY="
python --version >nul 2>nul
if not errorlevel 1 set "PY=python"

if not defined PY (
    py --version >nul 2>nul
    if not errorlevel 1 set "PY=py -3"
)

if not defined PY (
    echo   [ERROR] Python was not found on this computer.
    echo.
    echo   Please install Python 3 from:
    echo       https://www.python.org/downloads/
    echo.
    echo   IMPORTANT: during installation, tick
    echo       "Add Python to PATH"
    echo   Then run this file again.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('%PY% --version 2^>nul') do echo   Found %%v

rem ---- 2. Create virtual environment (first run only) --------
if not exist ".venv\Scripts\python.exe" (
    echo   First run: creating virtual environment...
    %PY% -m venv .venv
    if errorlevel 1 (
        echo   [ERROR] Could not create the virtual environment.
        echo           Make sure Python was installed with "Add Python to PATH".
        pause
        exit /b 1
    )
)

rem ---- 3. Install dependencies (first run only) ---------------
".venv\Scripts\python.exe" -c "import flask, flask_sqlalchemy, flask_wtf" >nul 2>nul
if errorlevel 1 (
    echo   Installing dependencies - this happens only once, please wait...
    ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
    if errorlevel 1 (
        echo   [ERROR] Dependency installation failed.
        echo           Check your internet connection and run this file again.
        pause
        exit /b 1
    )
)

rem ---- 4. Start the server and open the browser ---------------
echo.
echo   ==============================================
echo     Your garden is ready!
echo.
echo       Address : http://127.0.0.1:5000
echo       Your browser will open in a moment.
echo.
echo     KEEP THIS WINDOW OPEN while using the app.
echo     Closing this window stops the server.
echo   ==============================================
echo.

start "" /min cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:5000"

".venv\Scripts\python.exe" app.py

echo.
echo   Garden closed. Thanks for visiting!
pause

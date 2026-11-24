@echo off
cd /d "%~dp0"
set PY=
set PYW=
for %%V in (3.13 3.12 3.11 3.10) do if "%PY%"=="" py -%%V --version >nul 2>&1 && set PY=py -%%V&& set PYW=pyw -%%V
if "%PY%"=="" python --version >nul 2>&1 && set PY=python&& set PYW=pythonw
if "%PY%"=="" (
  echo Python 3.10-3.13 not found. Install Python 3.13 from python.org and try again.
  pause
  exit /b 1
)
rem Install the libraries only when something is missing (first run), then start the app without a console window.
%PY% -c "import webview, demoparser2, pandas, zstandard" >nul 2>&1
if errorlevel 1 (
  echo First run: installing the required libraries, please wait...
  %PY% -m pip install pywebview demoparser2 pandas zstandard awpy
)
start "" %PYW% cs_coach_app.py
exit

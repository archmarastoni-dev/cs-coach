@echo off
cd /d "%~dp0"
set PY=
for %%V in (3.13 3.12 3.11 3.10) do if "%PY%"=="" py -%%V --version >nul 2>&1 && set PY=py -%%V
if "%PY%"=="" python --version >nul 2>&1 && set PY=python
if "%PY%"=="" (
  echo Python 3.10-3.13 not found. Install Python 3.13 from python.org and try again.
  pause
  exit /b 1
)
echo Using: %PY%
%PY% --version
%PY% -m pip install pywebview demoparser2 pandas zstandard awpy >nul 2>&1
start "" %PY% cs_coach_app.py

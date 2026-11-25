@echo off
chcp 65001 >nul
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
echo Installing the required tools (one time only)...
%PY% -m pip install --upgrade pip
%PY% -m pip install pywebview pyinstaller demoparser2 pandas zstandard
if errorlevel 1 goto err
echo Building the application...
%PY% -m PyInstaller --noconfirm --clean --onedir --windowed --icon icona_statistiche.ico --name CSCoach ^
  --add-data "dashboard_template.html;." --add-data "icona_statistiche.ico;." ^
  --hidden-import cs_parser --hidden-import cs_coach ^
  --collect-all demoparser2 --collect-all webview --collect-submodules zstandard ^
  cs_coach_app.py
if errorlevel 1 goto err
if exist config.json copy /y config.json dist\CSCoach\config.json >nul
if exist cs_data.json copy /y cs_data.json dist\CSCoach\cs_data.json >nul
echo.
echo DONE. The application is in: %~dp0dist\CSCoach\CSCoach.exe
echo To share it, zip the whole dist\CSCoach folder.
pause
exit /b 0
:err
echo.
echo Something went wrong. Copy the message above and open an issue on GitHub.
pause

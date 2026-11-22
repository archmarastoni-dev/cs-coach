@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PY=
for %%V in (3.13 3.12 3.11 3.10) do if "%PY%"=="" py -%%V --version >nul 2>&1 && set PY=py -%%V
if "%PY%"=="" python --version >nul 2>&1 && set PY=python
if "%PY%"=="" (
  echo Non trovo Python 3.10-3.13. Installa Python 3.13 da python.org e riprova.
  pause
  exit /b 1
)
echo Uso: %PY%
%PY% --version
echo Installo gli strumenti necessari (una volta sola)...
%PY% -m pip install --upgrade pip
%PY% -m pip install pywebview pyinstaller demoparser2 pandas zstandard
if errorlevel 1 goto err
echo Creo l'applicazione...
%PY% -m PyInstaller --noconfirm --clean --onedir --windowed --icon icona.ico --name CSCoach ^
  --add-data "dashboard_template.html;." --add-data "icona.ico;." ^
  --hidden-import cs_parser --hidden-import cs_coach ^
  --collect-all demoparser2 --collect-all webview --collect-submodules zstandard ^
  cs_coach_app.py
if errorlevel 1 goto err
if exist config.json copy /y config.json dist\CSCoach\config.json >nul
if exist cs_data.json copy /y cs_data.json dist\CSCoach\cs_data.json >nul
echo.
echo FATTO. L'applicazione e' in: %~dp0dist\CSCoach\CSCoach.exe
echo Per condividerla comprimi in zip l'intera cartella dist\CSCoach.
pause
exit /b 0
:err
echo.
echo Qualcosa non ha funzionato. Copia il messaggio qui sopra e mandalo a Claude.
pause

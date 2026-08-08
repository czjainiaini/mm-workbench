@echo off
title MM Workbench Launcher
set PORT=8793
rem 可移植：自动定位到脚本所在目录，解压到任何位置都能用
cd /d "%~dp0"

rem ============ if already running, just open the page ============
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if %errorlevel%==0 goto open

echo Starting MM Workbench server (port %PORT%) ...
start "MM-Workbench-Server" /min cmd /c "set PORT=8793 && node server.js"

rem ============ wait for server (max 15s) ============
set /a tries=0
:waitloop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if %errorlevel%==0 goto open
set /a tries+=1
if %tries% geq 15 goto fail
goto waitloop

:open
start "" "http://localhost:%PORT%/wb/workbench.html"
echo.
echo Workbench opened in your browser.
echo The service runs in the minimized window [MM-Workbench-Server].
echo To stop the workbench, close that minimized window.
timeout /t 3 /nobreak >nul
exit /b 0

:fail
echo.
echo [ERROR] Server failed to start. Please make sure Node.js is installed (run: node -v).
pause
exit /b 1

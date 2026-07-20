@echo off
echo Starting Berbera Smart House Numbering System...

set TARGET_DIR=%~dp0

echo Starting backend...
cd /d "%TARGET_DIR%backend"
start "Backend Server" cmd /k "npm run dev"

echo Starting frontend...
cd /d "%TARGET_DIR%frontend"
start "Frontend Server" cmd /k "npm run dev"

echo Waiting for servers to initialize...
timeout /t 5 /nobreak

echo Opening application in the default browser...
start http://localhost:3002

echo Done!

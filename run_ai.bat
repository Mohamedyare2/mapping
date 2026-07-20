@echo off
echo Starting AI Pipeline for Berbera Building Detection...

cd /d "%~dp0ai-pipeline"

if exist "venv\Scripts\python.exe" (
    echo Using Python from virtual environment...
    venv\Scripts\python.exe detect.py --zoom 16
) else (
    echo Virtual environment not found, using global Python...
    python detect.py --zoom 16
)

echo.
echo AI Pipeline finished! You can now check your dashboard for the detected buildings.
pause

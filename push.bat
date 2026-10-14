@echo off
title Auto-Push Changes to GitHub
echo ===================================================================
echo   Syncing and Pushing All Changes to GitHub Repository
echo   Target: https://github.com/gouthmpro-hub/Haniya.git
echo ===================================================================
echo.

cd /d "%~dp0"

echo [1/3] Staging changes...
git add .

echo.
echo [2/3] Committing changes...
git commit -m "Update code: %date% %time%"
if %errorlevel% neq 0 (
    echo.
    echo No new changes detected to commit! Everything is already up to date.
    echo.
    pause
    exit /b 0
)

echo.
echo [3/3] Pushing to GitHub...
git push origin main
if %errorlevel% equ 0 (
    echo.
    echo ===================================================================
    echo   SUCCESS! All changes are now live on GitHub!
    echo ===================================================================
) else (
    echo.
    echo [ERROR] Push failed. Please check your internet connection or git status.
)

echo.
pause

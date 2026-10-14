@echo off
title Live Git Auto-Sync Watcher
echo Starting Live Git Auto-Sync...
powershell -ExecutionPolicy Bypass -File "%~dp0auto-sync.ps1"
pause

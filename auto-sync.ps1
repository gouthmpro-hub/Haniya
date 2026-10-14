# ===================================================================
# Live Auto-Sync Watcher for Git Repository
# Automatically detects saved file changes and pushes to GitHub
# ===================================================================

$RepoDir = "D:\Haniya Project"
Set-Location $RepoDir

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  LIVE GIT AUTO-SYNC ACTIVE" -ForegroundColor Green
Write-Host "  Watching for file changes in: $RepoDir" -ForegroundColor Yellow
Write-Host "  Any saved change will automatically push to GitHub!" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop auto-sync." -ForegroundColor Gray
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$LastPushTime = [DateTime]::MinValue

while ($true) {
    Start-Sleep -Seconds 5
    
    # Check if there are any modified, untracked, or deleted files
    $status = git status --porcelain
    if ($status) {
        $now = Get-Date
        Write-Host "[$($now.ToString('HH:mm:ss'))] Changes detected! Syncing to GitHub..." -ForegroundColor Yellow
        
        git add .
        $commitMsg = "Live auto-sync update: $($now.ToString('yyyy-MM-dd HH:mm:ss'))"
        git commit -m $commitMsg
        
        $pushResult = git push origin main 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$($now.ToString('HH:mm:ss'))] Successfully pushed to GitHub!" -ForegroundColor Green
        } else {
            Write-Host "[$($now.ToString('HH:mm:ss'))] Push failed: $pushResult" -ForegroundColor Red
        }
        Write-Host ""
    }
}

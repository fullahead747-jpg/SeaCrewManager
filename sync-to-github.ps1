# SeaCrewManager - One-Click GitHub Sync
# This script commits all changes and pushes them to GitHub safely.

Write-Host "============================"
Write-Host "Syncing to GitHub..."
Write-Host "============================"

# 1. Add all changes
git add .

# 2. Check if there are changes to commit
$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes to sync. Everything is up to date."
    exit 0
}

# 3. Commit with timestamp
$message = "Sync from Local: $timestamp (Persistent Object Storage Implementation)"
git commit -m $message

# 4. Push to GitHub
Write-Host "Pushing to GitHub (origin main)..."
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================"
    Write-Host "SYNC COMPLETE!"
    Write-Host "Next step: Go to Replit and 'Pull' the changes."
    Write-Host "============================"
}
else {
    Write-Host "FAILED to push to GitHub. Please check your internet or Git credentials."
}

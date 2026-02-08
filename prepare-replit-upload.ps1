# SeaCrewManager - Replit Upload Preparation Script
# This script creates a clean folder with only the files needed for Replit deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SeaCrewManager - Replit Upload Prep" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define paths
$sourceDir = "d:\SeaCrewManager"
$uploadDir = "C:\SeaCrewManager_Upload"

# Check if source directory exists
if (-not (Test-Path $sourceDir)) {
    Write-Host "ERROR: Source directory not found: $sourceDir" -ForegroundColor Red
    exit 1
}

# Create upload directory (remove if exists)
if (Test-Path $uploadDir) {
    Write-Host "Removing existing upload directory..." -ForegroundColor Yellow
    Remove-Item -Path $uploadDir -Recurse -Force
}

Write-Host "Creating upload directory: $uploadDir" -ForegroundColor Green
New-Item -Path $uploadDir -ItemType Directory -Force | Out-Null

Write-Host ""
Write-Host "Copying essential files..." -ForegroundColor Cyan
Write-Host ""

# Copy folders
$folders = @("client", "server", "shared")
foreach ($folder in $folders) {
    $sourcePath = Join-Path $sourceDir $folder
    $destPath = Join-Path $uploadDir $folder
    
    if (Test-Path $sourcePath) {
        Write-Host "  [FOLDER] Copying $folder/..." -ForegroundColor Green
        Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
    }
    else {
        Write-Host "  [SKIP] $folder/ not found" -ForegroundColor Yellow
    }
}

# Copy individual files
$files = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "drizzle.config.ts",
    "tailwind.config.ts",
    "postcss.config.js",
    "components.json",
    "capacitor.config.ts",
    ".replit",
    "replit.nix",
    "eng.traineddata",
    "README.md"
)

foreach ($file in $files) {
    $sourcePath = Join-Path $sourceDir $file
    $destPath = Join-Path $uploadDir $file
    
    if (Test-Path $sourcePath) {
        Write-Host "  [FILE] Copying $file" -ForegroundColor Green
        Copy-Item -Path $sourcePath -Destination $destPath -Force
    }
    else {
        Write-Host "  [SKIP] $file not found" -ForegroundColor Yellow
    }
}

# Copy public folder if exists
$publicPath = Join-Path $sourceDir "public"
if (Test-Path $publicPath) {
    Write-Host "  [FOLDER] Copying public/..." -ForegroundColor Green
    Copy-Item -Path $publicPath -Destination (Join-Path $uploadDir "public") -Recurse -Force
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Preparation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Calculate size
$uploadSize = (Get-ChildItem -Path $uploadDir -Recurse | Measure-Object -Property Length -Sum).Sum
$uploadSizeMB = [math]::Round($uploadSize / 1MB, 2)

Write-Host "Upload folder created at: $uploadDir" -ForegroundColor White
Write-Host "Total size: $uploadSizeMB MB" -ForegroundColor White
Write-Host ""

# List contents
Write-Host "Contents:" -ForegroundColor Cyan
Get-ChildItem -Path $uploadDir | ForEach-Object {
    if ($_.PSIsContainer) {
        Write-Host "  [DIR]  $($_.Name)/" -ForegroundColor Yellow
    }
    else {
        $sizeMB = [math]::Round($_.Length / 1MB, 2)
        if ($sizeMB -gt 0.01) {
            Write-Host "  [FILE] $($_.Name) ($sizeMB MB)" -ForegroundColor White
        }
        else {
            $sizeKB = [math]::Round($_.Length / 1KB, 2)
            Write-Host "  [FILE] $($_.Name) ($sizeKB KB)" -ForegroundColor White
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Go to replit.com and login" -ForegroundColor White
Write-Host "2. Open your existing project" -ForegroundColor White
Write-Host "3. Delete all old files in Replit Shell:" -ForegroundColor White
Write-Host "   rm -rf * " -ForegroundColor Yellow -NoNewline
Write-Host "&&" -ForegroundColor White -NoNewline
Write-Host " rm -rf .[^.]*" -ForegroundColor Yellow
Write-Host "4. Drag and drop contents from:" -ForegroundColor White
Write-Host "   $uploadDir" -ForegroundColor Cyan
Write-Host "5. In Replit Shell, run:" -ForegroundColor White
Write-Host "   npm install" -ForegroundColor Yellow
Write-Host "   npm run db:push" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening upload folder..." -ForegroundColor Green
Start-Process explorer.exe $uploadDir

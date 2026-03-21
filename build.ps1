# BlackjackML - Windows PowerShell Build Script
# Run from project root: .\build.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$SrcDir      = "$ProjectRoot\app\static\components"
$BuildDir    = "$ProjectRoot\build-src"
$OutDir      = "$BuildDir\out"
$BundleJs    = "$ProjectRoot\app\static\bundle.js"
$BundleMin   = "$ProjectRoot\app\static\bundle.min.js"

Write-Host "BlackjackML Build Starting..." -ForegroundColor Cyan

# Step 1 - Sync sources
Write-Host "Step 1: Syncing sources..." -ForegroundColor Yellow
$BuildSrc = "$BuildDir\src"
if (-not (Test-Path $BuildSrc)) { New-Item -ItemType Directory -Path $BuildSrc | Out-Null }

# Clean out the src folder completely before every build.
# This prevents "file already exists" errors when .jsx files were
# previously renamed to .tsx and the old .tsx is still sitting there.
Get-ChildItem "$BuildSrc\*" | Remove-Item -Force -ErrorAction SilentlyContinue

# Copy fresh sources in
Get-ChildItem "$SrcDir\*.js","$SrcDir\*.jsx" | Copy-Item -Destination $BuildSrc -Force

# Rename .jsx to .tsx so tsc handles the JSX transform
Get-ChildItem "$BuildSrc\*.jsx" | ForEach-Object {
    $newName = $_.FullName -replace '\.jsx$', '.tsx'
    # Remove target if it already exists before renaming
    if (Test-Path $newName) { Remove-Item $newName -Force }
    Rename-Item $_.FullName $newName -Force
}

# Add // @ts-nocheck to every file (suppresses type errors, keeps JSX transform)
Get-ChildItem "$BuildSrc\*.js","$BuildSrc\*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    if ($content -notmatch '@ts-nocheck') {
        Set-Content $_.FullName ("// @ts-nocheck`n" + $content) -Encoding UTF8
    }
}

# Step 2 - Compile JSX to plain JS
Write-Host "Step 2: Compiling JSX..." -ForegroundColor Yellow
Push-Location $BuildDir
try { & tsc --project tsconfig.json 2>&1 | Out-Null } catch { }
Pop-Location

# Step 3 - Bundle all compiled files in load order
Write-Host "Step 3: Bundling files..." -ForegroundColor Yellow

$loadOrder = @(
    "constants","utils","Widget","TopBar","ActionPanel","BettingPanel",
    "SideBetPanel","HandDisplay","CardGrid","StrategyRefTable",
    "ShoePanel","EdgeMeter","SessionStats","ShuffleTracker",
    "CountHistory","I18Panel","LiveOverlayPanel","CenterToolBar",
    "SplitHandPanel","SideCountPanel","CasinoRiskMeter","StopAlerts","App"
)

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$allLines = New-Object System.Collections.Generic.List[string]
$allLines.Add("/* BlackjackML bundle compiled $timestamp */")

foreach ($name in $loadOrder) {
    $file = "$OutDir\$name.js"
    if (Test-Path $file) {
        $allLines.Add("/* $name */")
        $allLines.Add((Get-Content $file -Raw -Encoding UTF8))
        $allLines.Add("")
    } else {
        Write-Warning "Missing: $name.js"
    }
}

[System.IO.File]::WriteAllText($BundleJs, ($allLines -join "`n"), [System.Text.Encoding]::UTF8)

# Step 4 - Fix duplicate hook declarations via Node.js
# Each component declares `const { useState } = React` at the top.
# Fine in separate script tags but a SyntaxError in one concatenated file.
# fix_hooks.js converts them all to `var` which allows redeclaration.
Write-Host "Step 4: Fixing hook declarations..." -ForegroundColor Yellow
& node "$BuildDir\fix_hooks.js"

# Step 5 - Minify
Write-Host "Step 5: Minifying..." -ForegroundColor Yellow
& node "$BuildDir\minify.js"

# Step 6 - Syntax check
Write-Host "Step 6: Checking syntax..." -ForegroundColor Yellow
$check = & node --check $BundleMin 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Syntax error in bundle" -ForegroundColor Red
    Write-Host $check -ForegroundColor Red
    exit 1
}

$sizeKB = [math]::Round((Get-Item $BundleMin).Length / 1024)
Write-Host ""
Write-Host "Build complete!  bundle.min.js = $sizeKB KB" -ForegroundColor Green
Write-Host "Refresh your browser to see changes." -ForegroundColor Gray
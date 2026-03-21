# BlackjackML - Watch Mode for Windows PowerShell
# Watches app/static/components/ and rebuilds automatically on every save.
#
# Usage (from project root):
#   Unblock-File .\watch.ps1
#   .\watch.ps1
#
# Press Ctrl+C to stop watching.

$ProjectRoot = $PSScriptRoot
$WatchDir    = "$ProjectRoot\app\static\components"
$BuildScript = "$ProjectRoot\build.ps1"

Write-Host ""
Write-Host "BlackjackML Watch Mode" -ForegroundColor Cyan
Write-Host "Watching: $WatchDir" -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

# Run the build once immediately on start
& "$BuildScript"

# Set up a FileSystemWatcher on the components folder
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path                  = $WatchDir
$watcher.Filter                = "*.*"
$watcher.IncludeSubdirectories = $false
$watcher.NotifyFilter          = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName
$watcher.EnableRaisingEvents   = $true

# Track last build time so rapid saves don't trigger multiple builds
$script:lastBuild = [DateTime]::MinValue

$onChange = {
    $now = [DateTime]::UtcNow
    # Only rebuild if at least 1.5 seconds have passed since the last build
    if (($now - $script:lastBuild).TotalSeconds -gt 1.5) {
        $script:lastBuild = $now
        $name = $Event.SourceEventArgs.Name
        Write-Host ""
        Write-Host "Changed: $name -- rebuilding..." -ForegroundColor Yellow
        & "$using:BuildScript"
    }
}

# Register events for file changes, creations, and renames
Register-ObjectEvent $watcher "Changed" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Created" -Action $onChange | Out-Null
Register-ObjectEvent $watcher "Renamed" -Action $onChange | Out-Null

Write-Host "Watching for changes..." -ForegroundColor Green

try {
    # Keep the script alive until Ctrl+C
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    Get-EventSubscriber | Unregister-Event
    Write-Host "Watcher stopped." -ForegroundColor DarkGray
}
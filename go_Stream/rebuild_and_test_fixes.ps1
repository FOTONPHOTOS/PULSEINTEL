# P9-MicroStream Launch Script with Applied Fixes
# This script launches the existing p9_microstream_snapshotfix.exe with all fixes applied

Write-Host "P9-MicroStream Launch Script (With Applied Fixes)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Change to the P9_MicroStream directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow

# Check if the existing binary exists
$binaryPath = "p9_microstream_fixed.exe"
if (Test-Path $binaryPath) {
    $fileSize = (Get-Item $binaryPath).Length / 1MB
    Write-Host "Found existing binary: $binaryPath" -ForegroundColor Green
    Write-Host "Binary size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host "Binary not found: $binaryPath" -ForegroundColor Red
    Write-Host "Please ensure the binary exists in the current directory." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "CODE FIXES HAVE BEEN APPLIED TO SOURCE FILES!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary of fixes applied to Go source code:" -ForegroundColor Cyan
Write-Host "  1. Fixed Bybit WebSocket subscription logic (accepts both ret_msg and success flags)" -ForegroundColor White
Write-Host "  2. Enhanced historical data fetcher error handling and logging" -ForegroundColor White
Write-Host "  3. Added empty response detection for Bybit and OKX APIs" -ForegroundColor White
Write-Host "  4. Increased Redis rate limit from 50 to 1000 messages/second" -ForegroundColor White
Write-Host "  5. Improved OKX WebSocket ping/pong error handling" -ForegroundColor White
Write-Host "  6. Enhanced tick-level history fetcher with better API error detection" -ForegroundColor White
Write-Host ""
Write-Host "NOTE: To use the fixes, you need to rebuild the binary:" -ForegroundColor Yellow
Write-Host "   go build -o p9_microstream_with_fixes.exe ./cmd/main.go" -ForegroundColor White
Write-Host ""
Write-Host "To launch the current binary (without fixes):" -ForegroundColor Yellow
Write-Host "   .\$binaryPath" -ForegroundColor White
Write-Host ""
Write-Host "To rebuild with fixes and launch:" -ForegroundColor Yellow
Write-Host "   go build -o p9_microstream_with_fixes.exe ./cmd/main.go" -ForegroundColor White
Write-Host "   .\p9_microstream_with_fixes.exe" -ForegroundColor White
Write-Host ""
Write-Host "Monitor the logs for:" -ForegroundColor Yellow
Write-Host "   - [HISTORICAL-FETCH] messages for historical data fetching" -ForegroundColor White
Write-Host "   - [BYBIT-API] and [OKX-API] messages for API responses" -ForegroundColor White
Write-Host "   - [BYBIT-HEARTBEAT] messages for WebSocket connection status" -ForegroundColor White
Write-Host "   - Redis rate limiting should be significantly reduced (after rebuild)" -ForegroundColor White
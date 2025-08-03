# Frontend Environment Setup for Ngrok URLs
# Run this after starting your ngrok tunnels

Write-Host "🔧 PulseIntel Frontend Environment Setup" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Please provide your ngrok tunnel URLs:" -ForegroundColor Yellow
Write-Host "(Check the ngrok windows that opened)" -ForegroundColor Gray

# Get WebSocket URL
Write-Host ""
$wsUrl = Read-Host "WebSocket Service URL (e.g., https://abc123.ngrok.io)"
if (-not $wsUrl.StartsWith("https://")) {
    $wsUrl = "https://" + $wsUrl.TrimStart("http://").TrimStart("https://")
}

# Get API URL
$apiUrl = Read-Host "API Service URL (e.g., https://def456.ngrok.io)"
if (-not $apiUrl.StartsWith("https://")) {
    $apiUrl = "https://" + $apiUrl.TrimStart("http://").TrimStart("https://")
}

# Create .env.local file with both REACT_APP and VITE prefixes for compatibility
$envContent = @"
# PulseIntel Local Development Environment Variables
# Generated on $(Get-Date)

# React App Environment Variables
REACT_APP_WEBSOCKET_URL=$wsUrl
REACT_APP_API_URL=$apiUrl

# Vite Environment Variables (for compatibility)
VITE_WEBSOCKET_URL=$wsUrl
VITE_API_URL=$apiUrl

# Development Features
REACT_APP_ENV=development
REACT_APP_DEBUG=true

# Mobile Optimization
REACT_APP_MOBILE_OPTIMIZED=true
"@

# Write to frontend/.env.local
$envPath = "frontend\.env.local"
$envContent | Out-File -FilePath $envPath -Encoding UTF8

Write-Host ""
Write-Host "✅ Environment file created!" -ForegroundColor Green
Write-Host "📁 Location: $envPath" -ForegroundColor White
Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  WebSocket URL: $wsUrl" -ForegroundColor White
Write-Host "  API URL: $apiUrl" -ForegroundColor White

Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start the frontend:" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Expose frontend with ngrok:" -ForegroundColor White
Write-Host "   ngrok http 3000" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Access your app at the ngrok URL!" -ForegroundColor White

Write-Host ""
Write-Host "💡 Pro Tip: If you change ngrok URLs, just run this script again!" -ForegroundColor Cyan
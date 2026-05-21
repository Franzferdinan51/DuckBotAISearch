$ErrorActionPreference = "Stop"

Write-Host "Starting DuckBotSearch local stack..."

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

Write-Host "Starting SearXNG container..."
docker compose -f ".\searxng\docker-compose.yml" up -d

Write-Host "Starting search API server on port 3005..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD'; npm run search:start" -WindowStyle Hidden

Write-Host "Starting Vite web UI on port 3002..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PWD'; npm run dev -- --host 0.0.0.0 --port 3002" -WindowStyle Hidden

Write-Host "DuckBotSearch stack launch requested."
Write-Host "UI: http://localhost:3002"
Write-Host "Search API: http://localhost:3005/health"
Write-Host "SearXNG: http://localhost:8888"

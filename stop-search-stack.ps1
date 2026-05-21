$ErrorActionPreference = "Continue"

Write-Host "Stopping DuckBotSearch search stack..."

Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match "search-server/server\.ts" -or $_.CommandLine -match "vite" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

docker compose -f ".\searxng\docker-compose.yml" down

Write-Host "DuckBotSearch stack stopped."

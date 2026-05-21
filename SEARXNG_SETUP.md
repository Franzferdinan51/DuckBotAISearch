# SearXNG Setup Guide for DuckBotSearch

This guide explains how to set up SearXNG as the search backend for DuckBotSearch's Perplexity-style search functionality.

## What is SearXNG?

SearXNG is a privacy-focused, open-source metasearch engine that aggregates results from multiple search engines (Google, Bing, Wikipedia, DuckDuckGo, etc.) without tracking users.

## Quick Start with Docker

### 1. Install SearXNG via Docker

```bash
# Pull and run SearXNG
docker run -d \
  --name searxng \
  -p 8888:8888 \
  -e SEARXNG_BASE_URL=http://localhost:8888/ \
  -v ./searxng:/etc/searxng \
  searxng/searxng:latest
```

### 2. Configure SearXNG

Create `searxng/settings.yml`:

```yaml
use_default_settings: true

general:
  instance_name: "DuckBotSearch"
  privacypolicy_url: false
  donation_url: false
  contact_url: false
  enable_metrics: false

search:
  safe_search: 0
  autocomplete: ""
  default_lang: "en"
  formats:
    - html
    - json

server:
  secret_key: "change-this-to-a-random-string-in-production"
  bind_address: "0.0.0.0"
  port: 8888
  limiter: false
  public_instance: true

engines:
  - name: google
    engine: google
    shortcut: g
  - name: bing
    engine: bing
    shortcut: b
  - name: wikipedia
    engine: wikipedia
    shortcut: w
  - name: duckduckgo
    engine: duckduckgo
    shortcut: ddg
```

### 3. Access SearXNG

- Web UI: http://localhost:8888
- API (JSON): http://localhost:8888/search?q=test&format=json

## Alternative: Production Installation

### Ubuntu/Debian

```bash
# Install SearXNG
sudo add-apt-repository ppa:searxng/releases
sudo apt update
sudo apt install searxng

# Configure
sudo nano /etc/searxng/settings.yml

# Start service
sudo systemctl enable searxng
sudo systemctl start searxng
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name search.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## DuckBotSearch Configuration

### Set Environment Variable

```bash
# In your .env file
SEARXNG_URL=http://localhost:8888
```

### Configure Search Engines

In `search-service/searchConfig.ts`, you can modify the default engines:

```typescript
export const SEARCH_CONFIG = {
  SEARXNG_URL: process.env.SEARXNG_URL || 'http://localhost:8888',
  DEFAULT_ENGINES: ['google', 'bing', 'wikipedia'],
  MAX_RESULTS: 20,
  RESULT_TIMEOUT: 10000,
};
```

## Testing SearXNG

### Web UI Test

Open http://localhost:8888 and perform a test search.

### API Test

```bash
# JSON format
curl "http://localhost:8888/search?q=AI+news&format=json&engines=google,bing"

# Verify response structure
{
  "results": [...],
  "query": "AI news",
  "number_of_results": 10,
  "processing_time": 0.5
}
```

## Troubleshooting

### Connection Refused

- Ensure SearXNG container/service is running: `docker ps | grep searxng`
- Check logs: `docker logs searxng`

### CORS Errors

- If accessing from a different origin, enable CORS in SearXNG settings or use a proxy.

### Timeout Errors

- Increase `RESULT_TIMEOUT` in searchConfig.ts
- Reduce `MAX_RESULTS`
- Check network connectivity to search engines

### No Results

- Verify engines are enabled in settings.yml
- Check SearXNG logs for engine errors
- Some engines may require API keys (e.g., Google Custom Search)

## Using with AI Agent Swarms

DuckBotSearch uses SearXNG in combination with AI Agent Swarms:

1. **Query Analysis** (search-analyst agent) - Determines best engines
2. **Search Execution** - SearXNG fetches from multiple sources
3. **Result Processing** (result-synthesizer, fact-checker agents) - Analyzes results
4. **Answer Synthesis** (research-lead agent) - Generates cited answer

The swarm orchestration provides:
- Parallel search across engines
- Fact-checking and verification
- Intelligent citation formatting
- Source diversity analysis

## Production Considerations

1. **Rate Limiting**: Enable SearXNG's built-in limiter for public instances
2. **API Keys**: Some engines (Google, Bing) require API keys for higher quotas
3. **Caching**: Enable result caching to reduce external API calls
4. **Metrics**: Disable metrics endpoint in production for privacy
5. **Security**: Use a strong `secret_key` and consider authentication

## Resources

- [SearXNG GitHub](https://github.com/searxng/searxng)
- [Documentation](https://docs.searxng.org/)
- [Engine List](https://github.com/searxng/searxng/blob/master/searxng/data/engines.json)
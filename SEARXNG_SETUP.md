# SearXNG Setup for DuckBotAISearch

DuckBotAISearch expects a SearXNG instance that exposes the official `/search` API with `format=json` enabled.

## Included local setup

This repo now includes a local container setup in [`searxng/docker-compose.yml`](./searxng/docker-compose.yml) and [`searxng/config/settings.yml`](./searxng/config/settings.yml).

Start just SearXNG:

```powershell
npm run searxng:up
```

Stop it:

```powershell
npm run searxng:down
```

The default local URL is:

```text
http://localhost:8888
```

## Why the port mapping is `8888:8080`

The current official SearXNG container documentation uses the container’s internal port `8080` and maps that to a host port such as `8888`. This repo follows that layout so the local instance is reachable at `http://localhost:8888`.

## Environment

The search service reads:

```text
SEARXNG_URL=http://localhost:8888
```

from `.env` when present.

## API shape DuckBotAISearch uses

DuckBotAISearch calls:

- `GET /search?q=...&format=json&engines=...`

The search client no longer assumes undocumented `/health` or `/engines` endpoints. Health is checked by making a lightweight JSON search request, and engine discovery falls back to the SearXNG preferences page or the repo’s default engine list.

## Quick verification

With SearXNG running:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:8888/search?q=searxng&format=json"
```

You should get a JSON response containing fields like:

- `results`
- `query`
- `number_of_results`
- `answers`

## If Docker is installed but not running

If `docker compose up` fails because the Docker daemon is unavailable, start Docker Desktop first and rerun:

```powershell
npm run searxng:up
```

## Source references

- Official SearXNG container installation guide: https://docs.searxng.org/admin/installation-docker
- Official SearXNG search API reference: https://docs.searxng.org/dev/search_api.html

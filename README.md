# DuckBotAISearch

DuckBotAISearch is a Perplexity-style search app that combines Google-style retrieval with AI swarm post-processing. It uses SearXNG as the primary metasearch backend, and also supports direct Brave Search and Tavily backends. On top of retrieval, a multi-stage search swarm analyzes intent, ranks and deduplicates results, checks corroboration, formats citations, and synthesizes the final answer.

The implementation in this repo is informed by:

- `AI-Bot-Council-Concensus` for the existing council/specialist orchestration surface
- `Agent-Teams` for multi-agent execution patterns
- `Vane` for the cited answer/search UX direction
- `searxng` for privacy-friendly metasearch retrieval

## Search architecture

DuckBotAISearch now separates two concerns:

### Search backends

You can choose one of these search providers in the search UI:

- `SearXNG`
- `Brave Search`
- `Tavily`

### AI synthesis providers

After retrieval, the swarm can finish the answer using:

- Built-in heuristic swarm synthesis
- `LM Studio` as the final AI provider

LM Studio is configurable with:

- endpoint
- model id
- optional API key

## Key files

- `search-server/`
  - Express API for search requests, history, and backend health
- `search-service/`
  - provider adapters for SearXNG, Brave, and Tavily
  - swarm orchestration and citation generation
  - optional LM Studio final synthesis
- `components/SearchInterface.tsx`
  - search-first UI with provider selection, API-key entry, and LM Studio controls
- `searxng/`
  - repo-owned Docker Compose setup for local SearXNG

## Local startup

1. Install dependencies:

```powershell
npm install
```

2. Copy the example environment if you do not already have one:

```powershell
Copy-Item .env.example .env
```

3. Start the local stack:

```powershell
npm run stack:start
```

That startup path is intended to launch:

- SearXNG on `http://localhost:8888`
- Search API on `http://localhost:3005`
- Web UI on `http://localhost:3002`

To stop the stack:

```powershell
npm run stack:stop
```

## Manual commands

If you prefer to run the layers yourself:

```powershell
npm run searxng:up
npm run search:start
npm run dev -- --host 0.0.0.0 --port 3002
```

## Search provider setup

### SearXNG

Default local URL:

```text
http://localhost:8888
```

Setup details are in [SEARXNG_SETUP.md](./SEARXNG_SETUP.md).

### Brave Search

Enter your Brave Search API key directly in the search UI when `Brave Search` is selected as the backend.

### Tavily

Enter your Tavily API key directly in the search UI when `Tavily` is selected as the backend.

### LM Studio

Enter your LM Studio settings in the search UI when `LM Studio` is selected as the AI provider:

- endpoint
- optional API key
- model id

The same LM Studio credentials are also available in the main settings panel.

## Verification

Typecheck:

```powershell
npm run typecheck
```

Build:

```powershell
npm run build
```

Search API health:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3005/health
```

## Notes

- The SearXNG client targets the official `/search` API and uses the preferences page as a best-effort engine discovery fallback.
- Search mode renders a dedicated search UI rather than the older debate-only council flow.
- If Docker Desktop is installed but not running, the SearXNG container will not start until the Docker daemon is available.

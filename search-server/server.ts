/**
 * DuckBotSearch API Server
 * Handles search requests and coordinates with SearXNG
 */

import express from 'express';
import cors from 'cors';
import { searchService } from '../search-service/searchService';

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    const health = await searchService.healthCheck();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message || 'Health check failed' });
  }
});

// Main search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query, engines } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const response = await searchService.search(query, engines);

    res.json(response);
  } catch (error: any) {
    console.error('Search API error:', error);
    res.status(500).json({ error: error.message || 'Search failed' });
  }
});

// Streaming search endpoint (SSE)
app.get('/api/search/stream', async (req, res) => {
  const { q, engines } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection event
  res.write('event: connected\ndata: {"status": "connected"}\n\n');

  // Stream search results
  const parsedEngines = Array.isArray(engines)
    ? engines.flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean)
    : typeof engines === 'string'
      ? engines.split(',').map((value) => value.trim()).filter(Boolean)
      : undefined;

  const streamGenerator = searchService.streamSearch(q, parsedEngines);

  const sendEvent = (type: string, data: any) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    for await (const event of streamGenerator) {
      sendEvent(event.type, event.data);

      if (event.type === 'complete' || event.type === 'error') {
        break;
      }
    }
  } catch (error: any) {
    sendEvent('error', { message: error.message });
  }

  res.end();
});

// Search history endpoint
app.get('/api/search/history', (req, res) => {
  const history = searchService.getHistory();
  res.json(history);
});

// Clear search history
app.delete('/api/search/history', (req, res) => {
  searchService.clearHistory();
  res.json({ success: true });
});

// Get available engines
app.get('/api/search/engines', async (req, res) => {
  try {
    const engines = await searchService.getAvailableEngines();
    res.json({ engines });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search status/health
app.get('/api/search/status', async (req, res) => {
  const health = await searchService.healthCheck();
  res.json(health);
});

// Start server
app.listen(PORT, () => {
  console.log(`DuckBotSearch API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Search endpoint: POST http://localhost:${PORT}/api/search`);
});

export default app;

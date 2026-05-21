/**
 * DuckBotSearch - Perplexity-style Search with AI Agent Swarms
 *
 * Architecture:
 * 1. SearXNG handles the actual web search (privacy-focused metasearch)
 * 2. Agent Swarms process, verify, and synthesize search results
 * 3. React frontend provides Perplexity-style streaming UI
 */

export const SEARCH_CONFIG = {
  // SearXNG server URL - change to your SearXNG instance
  SEARXNG_URL: process.env.SEARXNG_URL || 'http://localhost:8888',

  // Search settings
  DEFAULT_ENGINES: ['google', 'bing', 'duckduckgo', 'wikipedia'],
  MAX_RESULTS: 20,
  RESULT_TIMEOUT: 10000,
  STREAM_TOKEN_DELAY_MS: 14,

  // Agent swarm settings
  SWARM_COUNT: 5,
  SWARM_DOMAIN: 'research',

  // Streaming
  SSE_RECONNECT_DELAY: 3000,
};

// Search engine configurations
export const SEARCH_ENGINES = {
  google: { name: 'Google', weight: 1.0, enabled: true },
  bing: { name: 'Bing', weight: 0.8, enabled: true },
  wikipedia: { name: 'Wikipedia', weight: 0.7, enabled: true },
  duckduckgo: { name: 'DuckDuckGo', weight: 0.9, enabled: true },
  brave: { name: 'Brave', weight: 0.85, enabled: true },
  qwant: { name: 'Qwant', weight: 0.72, enabled: true },
};

export const SEARCH_ENGINE_NAMES = Object.keys(SEARCH_ENGINES);

// Agent roles for search processing
export const SEARCH_AGENTS = {
  QUERY_ANALYZER: 'search-analyst',
  RESULT_SYNTHESIZER: 'research-lead',
  FACT_CHECKER: 'security-lead',
  CITATION_FORMATTER: 'technical-writer',
  ANSWER_ARCHITECT: 'solutions-architect',
};

export default SEARCH_CONFIG;

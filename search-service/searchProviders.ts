import { SearchProvider, SearchResult } from './SearchResult';
import { SEARCH_CONFIG } from './searchConfig';
import { searxngClient } from './searxngClient';

export interface SearchExecutionOptions {
  provider: SearchProvider;
  query: string;
  engines?: string[];
  apiKey?: string;
  maxResults: number;
  intent?: 'general' | 'news' | 'technical' | 'academic' | 'comparison' | 'local';
}

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  meta_url?: {
    favicon?: string;
  };
}

interface BraveResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
  answer?: string;
}

export async function executeSearch(options: SearchExecutionOptions): Promise<SearchResult[]> {
  switch (options.provider) {
    case 'brave':
      return searchWithBrave(options);
    case 'tavily':
      return searchWithTavily(options);
    case 'searxng':
    default:
      return searxngClient.search(options.query, options.engines, options.maxResults);
  }
}

function normalizeResult(
  provider: SearchProvider,
  index: number,
  title: string,
  url: string,
  snippet: string,
  publishedDate?: string,
  favicon?: string,
  relevanceScore?: number
): SearchResult {
  return {
    id: `${provider}-${Date.now()}-${index}`,
    title: title || 'Untitled',
    url,
    snippet: snippet || '',
    engine: provider,
    favicon,
    publishedDate,
    relevanceScore: relevanceScore ?? Math.max(0.1, 1 - index * 0.05),
  };
}

async function searchWithBrave(options: SearchExecutionOptions): Promise<SearchResult[]> {
  if (!options.apiKey?.trim()) {
    throw new Error('Brave Search requires an API key.');
  }

  const params = new URLSearchParams({
    q: options.query,
    count: String(Math.min(options.maxResults, 20)),
    safesearch: 'moderate',
    result_filter: options.intent === 'news' ? 'news,web' : 'web',
  });

  if (options.intent === 'news') {
    params.set('freshness', 'pd');
  }

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': options.apiKey,
    },
    signal: AbortSignal.timeout(SEARCH_CONFIG.RESULT_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`Brave Search failed: ${response.status}`);
  }

  const data = (await response.json()) as BraveResponse;
  const results = data.web?.results ?? [];

  return results
    .filter((result) => result.url)
    .slice(0, options.maxResults)
    .map((result, index) =>
      normalizeResult(
        'brave',
        index,
        result.title || 'Untitled',
        result.url || '',
        result.description || '',
        result.age,
        result.meta_url?.favicon,
        Math.max(0.12, 1 - index * 0.05)
      )
    );
}

async function searchWithTavily(options: SearchExecutionOptions): Promise<SearchResult[]> {
  if (!options.apiKey?.trim()) {
    throw new Error('Tavily requires an API key.');
  }

  const topic = options.intent === 'news' ? 'news' : 'general';
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      query: options.query,
      topic,
      search_depth: topic === 'news' ? 'advanced' : 'basic',
      max_results: Math.min(options.maxResults, 10),
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(SEARCH_CONFIG.RESULT_TIMEOUT),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = (await response.json()) as TavilyResponse;
  const results = data.results ?? [];

  return results
    .filter((result) => result.url)
    .slice(0, options.maxResults)
    .map((result, index) =>
      normalizeResult(
        'tavily',
        index,
        result.title || 'Untitled',
        result.url || '',
        result.content || '',
        result.published_date,
        undefined,
        typeof result.score === 'number'
          ? Math.max(0.1, Math.min(1, result.score))
          : Math.max(0.12, 1 - index * 0.05)
      )
    );
}

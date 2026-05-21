/**
 * SearXNG API Client for DuckBotSearch
 * Handles communication with SearXNG metasearch engine
 */

import { SearchResult, SearchQuery, Citation } from './SearchResult';
import { SEARCH_CONFIG } from './searchConfig';

interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  img_src?: string;
  publishedDate?: string;
  thumbnail?: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
  query: string;
  number_of_results: number;
  processing_time: number;
}

export class SearXNGClient {
  private baseUrl: string;
  private secretKey: string;

  constructor(baseUrl?: string, secretKey?: string) {
    this.baseUrl = baseUrl || SEARCH_CONFIG.SEARXNG_URL;
    this.secretKey = secretKey || '';
  }

  /**
   * Perform a search query against SearXNG
   */
  async search(query: string, engines?: string[], count: number = 10): Promise<SearchResult[]> {
    const searchEngines = engines || SEARCH_CONFIG.DEFAULT_ENGINES;

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      engines: searchEngines.join(','),
      limit: count.toString(),
    });

    if (this.secretKey) {
      params.append('secret', this.secretKey);
    }

    const url = `${this.baseUrl}/search?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(SEARCH_CONFIG.RESULT_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`SearXNG search failed: ${response.status}`);
      }

      const data: SearXNGResponse = await response.json();

      return this.parseResults(data.results);
    } catch (error) {
      console.error('SearXNG search error:', error);
      throw error;
    }
  }

  /**
   * Parse SearXNG results into our format
   */
  private parseResults(results: SearXNGResult[]): SearchResult[] {
    return results.map((result, index) => ({
      id: `result-${Date.now()}-${index}`,
      title: result.title || 'Untitled',
      url: result.url || '',
      snippet: result.content || '',
      engine: result.engine || 'unknown',
      favicon: this.getFaviconUrl(result.url),
      publishedDate: result.publishedDate,
      relevanceScore: 1 - (index * 0.05), // Decrease score by 5% per position
      thumbnail: result.thumbnail || result.img_src,
    }));
  }

  /**
   * Get favicon URL for a domain
   */
  private getFaviconUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
      return '';
    }
  }

  /**
   * Stream search results using SSE
   */
  async *streamSearch(query: string, engines?: string[], count: number = 10): AsyncGenerator<SearchResult> {
    const searchEngines = engines || SEARCH_CONFIG.DEFAULT_ENGINES;

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      engines: searchEngines.join(','),
      limit: count.toString(),
    });

    if (this.secretKey) {
      params.append('secret', this.secretKey);
    }

    const url = `${this.baseUrl}/search?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(SEARCH_CONFIG.RESULT_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`SearXNG search failed: ${response.status}`);
      }

      const data: SearXNGResponse = await response.json();

      for (const result of this.parseResults(data.results)) {
        yield result;
      }
    } catch (error) {
      console.error('SearXNG stream error:', error);
      throw error;
    }
  }

  /**
   * Check if SearXNG is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available search engines
   */
  async getEngines(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/engines`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return data.engines || [];
      }
      return [];
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const searxngClient = new SearXNGClient();

export default SearXNGClient;
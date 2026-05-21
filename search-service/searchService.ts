/**
 * Search Service - Main interface for DuckBotSearch
 * Handles search requests from the frontend
 */

import { SearchExecutionRequest, SearchOrchestrator } from './searchOrchestrator';
import { SearchResponse } from './SearchResult';
import { searxngClient } from './searxngClient';

export class SearchService {
  private orchestrator: SearchOrchestrator;
  private searchHistory: SearchResponse[] = [];
  private maxHistory: number = 50;

  constructor() {
    this.orchestrator = new SearchOrchestrator();
  }

  /**
   * Perform a search query
   */
  async search(query: string, request: SearchExecutionRequest = {}): Promise<SearchResponse> {
    try {
      const response = await this.orchestrator.search(query, request);

      // Add to history
      this.addToHistory(response);

      return response;
    } catch (error) {
      console.error('Search error:', error);
      throw this.handleSearchError(error);
    }
  }

  /**
   * Stream search results
   */
  async *streamSearch(query: string, request: SearchExecutionRequest = {}): AsyncGenerator<any> {
    try {
      yield* this.orchestrator.streamSearch(query, request);
    } catch (error) {
      console.error('Stream search error:', error);
      yield { type: 'error', data: this.handleSearchError(error).message };
    }
  }

  /**
   * Get search history
   */
  getHistory(): SearchResponse[] {
    return this.searchHistory;
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.searchHistory = [];
  }

  /**
   * Get a specific search from history
   */
  getSearchById(query: string): SearchResponse | undefined {
    return this.searchHistory.find(h => h.query.toLowerCase() === query.toLowerCase());
  }

  /**
   * Add search to history
   */
  private addToHistory(response: SearchResponse): void {
    // Remove duplicates
    this.searchHistory = this.searchHistory.filter(
      h => h.query.toLowerCase() !== response.query.toLowerCase()
    );

    // Add to front
    this.searchHistory.unshift(response);

    // Trim history
    if (this.searchHistory.length > this.maxHistory) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistory);
    }
  }

  /**
   * Handle search errors
   */
  private handleSearchError(error: any): Error {
    if (error.message?.includes('requires an API key')) {
      return new Error(error.message);
    }
    if (error.message?.includes('fetch')) {
      return new Error('Cannot connect to the selected search backend. Please check your configuration.');
    }
    if (error.message?.includes('timeout')) {
      return new Error('Search timed out. Please try a simpler query.');
    }
    return new Error(`Search failed: ${error.message || 'Unknown error'}`);
  }

  /**
   * Check if SearXNG is available
   */
  async healthCheck(): Promise<{ status: string; searxng: boolean }> {
    const searxngOk = await searxngClient.healthCheck();

    return {
      status: searxngOk ? 'healthy' : 'degraded',
      searxng: searxngOk,
    };
  }

  /**
   * Get available search engines
   */
  async getAvailableEngines(): Promise<string[]> {
    return await searxngClient.getEngines();
  }
}

// Export singleton instance
export const searchService = new SearchService();

export default SearchService;

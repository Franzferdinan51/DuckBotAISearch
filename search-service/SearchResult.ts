/**
 * Search Result Types for DuckBotSearch
 */

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  engine: string;
  favicon?: string;
  publishedDate?: string;
  relevanceScore: number;
  cachedUrl?: string;
  thumbnail?: string;
}

export interface Citation {
  id: number;
  title: string;
  url: string;
  snippet: string;
  engine: string;
  relevanceScore: number;
  publishedDate?: string;
}

export interface SearchAgentTrace {
  agentId: string;
  agentName: string;
  role: string;
  summary: string;
}

export interface SearchProfile {
  intent: 'general' | 'news' | 'technical' | 'academic' | 'comparison' | 'local';
  reasoning: string;
  recommendedEngines: string[];
  safeSearch: boolean;
  freshness?: 'day' | 'week' | 'month';
}

export interface SearchQuery {
  query: string;
  engines: string[];
  count: number;
  safeSearch: boolean;
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

export interface SearchResponse {
  query: string;
  answer: string;
  citations: Citation[];
  sources: SearchResult[];
  relatedQuestions: string[];
  totalResults: number;
  searchTime: number;
  agentsUsed: string[];
  agentTrace: SearchAgentTrace[];
  profile: SearchProfile;
}

export interface SearchStreamEvent {
  type: 'token' | 'citation' | 'source' | 'status' | 'complete' | 'error' | 'agent' | 'profile';
  data:
    | string
    | Citation
    | SearchResult
    | SearchAgentTrace
    | SearchProfile
    | SearchResponse;
  agentId?: string;
}

export default SearchResult;

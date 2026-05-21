/**
 * Search Orchestrator for DuckBotSearch
 * Coordinates a multi-stage "agent swarm" over multiple search backends.
 */

import {
  Citation,
  SearchAgentTrace,
  SearchProfile,
  SearchProvider,
  SearchResponse,
  SearchResult,
  SearchStreamEvent,
} from './SearchResult';
import { SEARCH_SWARM_AGENTS } from './searchAgents';
import { SEARCH_CONFIG } from './searchConfig';
import { synthesizeWithLmStudio } from './lmStudioSynthesis';
import { executeSearch } from './searchProviders';

export interface SearchExecutionRequest {
  provider?: SearchProvider;
  engines?: string[];
  apiKey?: string;
  synthesisProvider?: 'heuristic' | 'lmstudio';
  lmStudioEndpoint?: string;
  lmStudioApiKey?: string;
  lmStudioModel?: string;
}

type RankedResult = SearchResult & {
  normalizedTitle: string;
  domain: string;
  relevanceScore: number;
  corroborationScore: number;
  freshnessScore: number;
  detailScore: number;
};

const AGENT_SEQUENCE = [
  'search-analyst',
  'result-processor',
  'fact-checker',
  'citation-formatter',
  'answer-architect',
] as const;

export class SearchOrchestrator {
  async search(query: string, request: SearchExecutionRequest = {}): Promise<SearchResponse> {
    const startedAt = Date.now();
    const provider = request.provider ?? 'searxng';
    const profile = this.analyzeQuery(query, request.engines, provider);
    const agentTrace: SearchAgentTrace[] = [];

    agentTrace.push(
      this.buildTrace(
        'search-analyst',
        `Intent classified as ${profile.intent}; provider ${this.providerLabel(provider)}; engines ${profile.recommendedEngines.join(', ')}.`
      )
    );

    const rawResults = await executeSearch({
      provider,
      query,
      engines: profile.recommendedEngines,
      apiKey: request.apiKey,
      maxResults: SEARCH_CONFIG.MAX_RESULTS,
      intent: profile.intent,
    });

    const rankedResults = this.rankResults(query, rawResults, profile);
    agentTrace.push(
      this.buildTrace(
        'result-processor',
        `Ranked ${rankedResults.length} sources after deduplication and cross-provider scoring.`
      )
    );

    const factCheck = this.crossCheckResults(query, rankedResults, profile);
    agentTrace.push(this.buildTrace('fact-checker', factCheck.summary));

    const citations = this.formatCitations(rankedResults);
    agentTrace.push(
      this.buildTrace(
        'citation-formatter',
        `Prepared ${citations.length} citations with source metadata and ranking signals.`
      )
    );

    const answer = await this.generateAnswer(query, rankedResults, citations, factCheck, profile, provider, request);
    const relatedQuestions = this.generateRelatedQuestions(query, rankedResults, profile);
    agentTrace.push(
      this.buildTrace(
        'answer-architect',
        `${request.synthesisProvider === 'lmstudio' ? 'LM Studio' : 'Heuristic'} synthesis completed with ${relatedQuestions.length} follow-up questions.`
      )
    );

    return {
      query,
      provider,
      answer,
      citations,
      sources: rankedResults,
      relatedQuestions,
      totalResults: rankedResults.length,
      searchTime: Date.now() - startedAt,
      agentsUsed: [...AGENT_SEQUENCE],
      agentTrace,
      profile,
    };
  }

  async *streamSearch(query: string, request: SearchExecutionRequest = {}): AsyncGenerator<SearchStreamEvent> {
    const response = await this.search(query, request);

    yield { type: 'profile', data: response.profile, agentId: 'search-analyst' };
    for (const trace of response.agentTrace) {
      yield { type: 'agent', data: trace, agentId: trace.agentId };
    }
    for (const source of response.sources.slice(0, 10)) {
      yield { type: 'source', data: source, agentId: 'result-processor' };
    }
    for (const citation of response.citations) {
      yield { type: 'citation', data: citation, agentId: 'citation-formatter' };
    }
    for (const token of this.tokenize(response.answer)) {
      yield { type: 'token', data: token, agentId: 'answer-architect' };
    }
    yield { type: 'complete', data: response, agentId: 'answer-architect' };
  }

  private analyzeQuery(query: string, selectedEngines: string[] | undefined, provider: SearchProvider): SearchProfile {
    const normalized = query.toLowerCase();
    const explicitEngines = selectedEngines?.filter(Boolean) ?? [];

    let intent: SearchProfile['intent'] = 'general';
    let freshness: SearchProfile['freshness'];

    if (/\b(latest|today|current|recent|news|update)\b/.test(normalized)) {
      intent = 'news';
      freshness = 'day';
    } else if (/\b(compare|vs|difference|best|better|tradeoff)\b/.test(normalized)) {
      intent = 'comparison';
    } else if (/\b(api|sdk|typescript|react|python|error|docs|implementation)\b/.test(normalized)) {
      intent = 'technical';
    } else if (/\b(study|paper|research|journal|citation|academic)\b/.test(normalized)) {
      intent = 'academic';
    } else if (/\b(near me|local|restaurant|weather in|around me)\b/.test(normalized)) {
      intent = 'local';
      freshness = 'week';
    }

    const recommendedEngines = explicitEngines.length > 0
      ? explicitEngines
      : this.defaultEnginesForIntent(intent, provider);

    return {
      intent,
      reasoning: this.intentReasoning(intent, query, provider),
      recommendedEngines,
      safeSearch: true,
      freshness,
    };
  }

  private defaultEnginesForIntent(intent: SearchProfile['intent'], provider: SearchProvider): string[] {
    if (provider !== 'searxng') {
      return [provider];
    }

    switch (intent) {
      case 'news':
        return ['google', 'bing', 'duckduckgo'];
      case 'technical':
        return ['google', 'duckduckgo', 'wikipedia'];
      case 'academic':
        return ['google', 'wikipedia', 'bing'];
      case 'comparison':
        return ['google', 'bing', 'duckduckgo', 'wikipedia'];
      case 'local':
        return ['google', 'bing'];
      default:
        return SEARCH_CONFIG.DEFAULT_ENGINES;
    }
  }

  private intentReasoning(intent: SearchProfile['intent'], query: string, provider: SearchProvider): string {
    const providerText = this.providerLabel(provider);
    switch (intent) {
      case 'news':
        return `The query "${query}" includes freshness cues, so the swarm prioritizes recent coverage from ${providerText}.`;
      case 'technical':
        return `The query "${query}" looks implementation-focused, so the swarm favors documentation-heavy sources from ${providerText}.`;
      case 'academic':
        return `The query "${query}" appears research-oriented, so the swarm emphasizes citation-friendly sources surfaced by ${providerText}.`;
      case 'comparison':
        return `The query "${query}" asks for tradeoffs, so the swarm aims for source diversity in ${providerText} results.`;
      case 'local':
        return `The query "${query}" appears location-sensitive, so the swarm narrows to sources that usually rank local pages well in ${providerText}.`;
      default:
        return `The query "${query}" is treated as a general search and balanced within ${providerText}.`;
    }
  }

  private rankResults(query: string, results: SearchResult[], profile: SearchProfile): RankedResult[] {
    const deduped = new Map<string, RankedResult>();
    const queryTerms = this.extractTerms(query);
    const domainCounts = this.countDomains(results);

    results.forEach((result, index) => {
      if (!result.url) {
        return;
      }

      const domain = this.getDomain(result.url);
      const normalizedTitle = result.title.toLowerCase().trim();
      const key = `${normalizedTitle}::${domain}`;

      const titleHits = this.countMatches(normalizedTitle, queryTerms);
      const snippetHits = this.countMatches(result.snippet.toLowerCase(), queryTerms);
      const detailScore = Math.min(1, result.snippet.length / 240);
      const freshnessScore = this.scoreFreshness(result.publishedDate, profile.freshness);
      const corroborationScore = Math.min(1, (domainCounts.get(domain) ?? 1) / 3);

      const weightedScore =
        titleHits * 0.4 +
        snippetHits * 0.28 +
        detailScore * 0.12 +
        freshnessScore * 0.12 +
        corroborationScore * 0.08 -
        index * 0.015;

      const ranked: RankedResult = {
        ...result,
        normalizedTitle,
        domain,
        detailScore,
        freshnessScore,
        corroborationScore,
        relevanceScore: Number(Math.max(0.05, Math.min(1, weightedScore)).toFixed(3)),
      };

      const existing = deduped.get(key);
      if (!existing || ranked.relevanceScore > existing.relevanceScore) {
        deduped.set(key, ranked);
      }
    });

    return [...deduped.values()]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, SEARCH_CONFIG.MAX_RESULTS);
  }

  private crossCheckResults(
    query: string,
    results: RankedResult[],
    profile: SearchProfile
  ): { verified: boolean; confidence: number; warnings: string[]; summary: string } {
    if (results.length === 0) {
      return {
        verified: false,
        confidence: 0,
        warnings: ['No sources available to cross-check.'],
        summary: `No corroboration was possible for "${query}" because the result set was empty.`,
      };
    }

    const uniqueDomains = new Set(results.slice(0, 8).map((result) => result.domain));
    const topScores = results.slice(0, 5).map((result) => result.relevanceScore);
    const averageScore = topScores.reduce((sum, score) => sum + score, 0) / topScores.length;
    const confidence = Number(
      Math.min(0.97, averageScore * 0.7 + Math.min(uniqueDomains.size / 6, 1) * 0.3).toFixed(2)
    );

    const warnings: string[] = [];
    if (uniqueDomains.size < 2) {
      warnings.push('Most top results came from the same domain.');
    }
    if (profile.intent === 'news' && !results.some((result) => result.publishedDate)) {
      warnings.push('Few sources exposed publication dates, so freshness is weaker than ideal.');
    }
    if (averageScore < 0.38) {
      warnings.push('Query-to-source relevance is weak; consider refining the search.');
    }

    const summary = warnings.length > 0
      ? `Cross-check confidence ${confidence}. ${warnings.join(' ')}`
      : `Cross-check confidence ${confidence} across ${uniqueDomains.size} distinct domains.`;

    return {
      verified: confidence >= 0.45,
      confidence,
      warnings,
      summary,
    };
  }

  private formatCitations(results: RankedResult[]): Citation[] {
    return results.slice(0, 8).map((result, index) => ({
      id: index + 1,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      engine: result.engine,
      relevanceScore: result.relevanceScore,
      publishedDate: result.publishedDate,
    }));
  }

  private async generateAnswer(
    query: string,
    results: RankedResult[],
    citations: Citation[],
    factCheck: { verified: boolean; confidence: number; warnings: string[] },
    profile: SearchProfile,
    provider: SearchProvider,
    request: SearchExecutionRequest
  ): Promise<string> {
    if (results.length === 0) {
      return `I couldn't find enough usable results for "${query}". Check the selected search provider and try a narrower query.`;
    }

    if (request.synthesisProvider === 'lmstudio') {
      try {
        return await synthesizeWithLmStudio({
          endpoint: request.lmStudioEndpoint || '',
          apiKey: request.lmStudioApiKey,
          model: request.lmStudioModel || 'local-model',
          query,
          profile,
          results,
          citations,
        });
      } catch (error) {
        console.warn('LM Studio synthesis failed, falling back to heuristic answer.', error);
      }
    }

    const top = results.slice(0, 3);
    const opening = this.profileOpening(profile.intent, query, factCheck.confidence);

    const bullets = top.map((result, index) => {
      const citationId = citations.find((citation) => citation.url === result.url)?.id ?? index + 1;
      const snippet = this.truncate(result.snippet || 'No summary available.', 180);
      return `- ${result.title} [${citationId}]: ${snippet}`;
    });

    const sourceMix = [...new Set(top.map((result) => result.domain))].join(', ');
    const warningText = factCheck.warnings.length > 0
      ? `\n\nCaveats: ${factCheck.warnings.join(' ')}`
      : '';

    return [
      opening,
      '',
      ...bullets,
      '',
      `The strongest sources came from ${sourceMix}. The swarm searched via ${this.providerLabel(provider)} and then ranked the results for relevance, diversity, and corroboration.`,
      warningText,
    ].filter(Boolean).join('\n');
  }

  private profileOpening(intent: SearchProfile['intent'], query: string, confidence: number): string {
    switch (intent) {
      case 'news':
        return `For "${query}", the highest-signal recent coverage points to these takeaways. Cross-source confidence is ${confidence}.`;
      case 'technical':
        return `For "${query}", the most useful technical sources cluster around the following implementation details. Cross-source confidence is ${confidence}.`;
      case 'academic':
        return `For "${query}", the evidence base is best summarized by the sources below. Cross-source confidence is ${confidence}.`;
      case 'comparison':
        return `For "${query}", the search swarm found these recurring comparison points. Cross-source confidence is ${confidence}.`;
      case 'local':
        return `For "${query}", the most relevant locally oriented results look like this. Cross-source confidence is ${confidence}.`;
      default:
        return `For "${query}", the clearest answer from the indexed web results is below. Cross-source confidence is ${confidence}.`;
    }
  }

  private generateRelatedQuestions(query: string, results: RankedResult[], profile: SearchProfile): string[] {
    const leadingTerms = this.extractTerms(query).slice(0, 2);
    const topDomain = results[0]?.domain;

    const suggestions = new Set<string>();
    suggestions.add(`Latest updates about ${leadingTerms.join(' ') || query}`);
    suggestions.add(`Best sources to verify ${leadingTerms.join(' ') || query}`);

    if (profile.intent === 'technical') {
      suggestions.add(`How to implement ${leadingTerms.join(' ') || query}`);
    } else if (profile.intent === 'comparison') {
      suggestions.add(`Pros and cons of ${leadingTerms.join(' ') || query}`);
    } else if (profile.intent === 'news') {
      suggestions.add(`What changed recently about ${leadingTerms.join(' ') || query}`);
    } else {
      suggestions.add(`Explain ${leadingTerms.join(' ') || query} in simple terms`);
    }

    if (topDomain) {
      suggestions.add(`More results from ${topDomain}`);
    }

    return [...suggestions].slice(0, 4);
  }

  private buildTrace(agentId: string, summary: string): SearchAgentTrace {
    const agent = SEARCH_SWARM_AGENTS[agentId];
    return {
      agentId,
      agentName: agent?.name ?? agentId,
      role: agent?.role ?? 'Search agent',
      summary,
    };
  }

  private providerLabel(provider: SearchProvider): string {
    switch (provider) {
      case 'brave':
        return 'Brave Search';
      case 'tavily':
        return 'Tavily';
      default:
        return 'SearXNG';
    }
  }

  private tokenize(text: string): string[] {
    return text.split(/(\s+)/).filter(Boolean);
  }

  private extractTerms(query: string): string[] {
    return query
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((term) => term.length > 2);
  }

  private countMatches(text: string, queryTerms: string[]): number {
    if (queryTerms.length === 0) {
      return 0.2;
    }

    let hits = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) {
        hits += 1;
      }
    }

    return hits / queryTerms.length;
  }

  private countDomains(results: SearchResult[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const result of results) {
      const domain = this.getDomain(result.url);
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
    return counts;
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  private scoreFreshness(publishedDate?: string, preference?: SearchProfile['freshness']): number {
    if (!publishedDate) {
      return preference ? 0.2 : 0.45;
    }

    const timestamp = Date.parse(publishedDate);
    if (Number.isNaN(timestamp)) {
      return 0.35;
    }

    const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    if (!preference) {
      return ageDays < 30 ? 0.8 : ageDays < 180 ? 0.55 : 0.3;
    }
    if (preference === 'day') {
      return ageDays <= 2 ? 1 : ageDays <= 7 ? 0.75 : 0.35;
    }
    if (preference === 'week') {
      return ageDays <= 7 ? 1 : ageDays <= 30 ? 0.7 : 0.35;
    }
    return ageDays <= 31 ? 1 : ageDays <= 120 ? 0.65 : 0.3;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 3).trim()}...`;
  }
}

export const searchOrchestrator = new SearchOrchestrator();

export default SearchOrchestrator;

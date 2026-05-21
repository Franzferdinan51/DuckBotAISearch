/**
 * Search Agent definitions for DuckBotSearch
 * Uses the existing agent-swarm-system framework
 */

export interface SearchAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  tier: number;
  domain: string;
  taskDescription: string;
}

// Search-specific agents for the swarm
export const SEARCH_SWARM_AGENTS: Record<string, SearchAgent> = {
  'search-analyst': {
    id: 'search-analyst',
    name: 'Search Analyst',
    role: 'Analyzes search queries and selects optimal engines',
    model: 'minimax-portal/MiniMax-M2.7',
    tier: 1,
    domain: 'research',
    taskDescription: 'Analyze the user query to determine search intent, select appropriate engines, and optimize search parameters. Consider factors like query complexity, temporal relevance, and information type (news, academic, general).',
  },
  'result-processor': {
    id: 'result-processor',
    name: 'Result Processor',
    role: 'Processes and ranks raw search results',
    model: 'minimax-portal/MiniMax-M2.7',
    tier: 2,
    domain: 'research',
    taskDescription: 'Process raw search results, remove duplicates, assess relevance, and rank by quality. Extract key information from snippets and prepare results for synthesis.',
  },
  'fact-checker': {
    id: 'fact-checker',
    name: 'Fact Checker',
    role: 'Verifies claims and cross-references information',
    model: 'minimax-portal/MiniMax-M2.7',
    tier: 2,
    domain: 'research',
    taskDescription: 'Cross-reference claims in search results with multiple sources. Identify potential misinformation, verify dates and statistics, and flag inconsistencies for the final answer.',
  },
  'citation-formatter': {
    id: 'citation-formatter',
    name: 'Citation Formatter',
    role: 'Formats citations and source attributions',
    model: 'minimax-portal/MiniMax-M2.7',
    tier: 2,
    domain: 'general',
    taskDescription: 'Format search results into proper citations with clear attributions. Ensure each claim in the final answer is properly linked to its source. Generate inline citations [1][2][3] format.',
  },
  'answer-architect': {
    id: 'answer-architect',
    name: 'Answer Architect',
    role: 'Synthesizes final answer with citations',
    model: 'minimax-portal/MiniMax-M2.7',
    tier: 1,
    domain: 'research',
    taskDescription: 'Synthesize all search results and agent outputs into a coherent, well-structured answer. Organize information logically, maintain factual accuracy, and ensure proper citation formatting throughout.',
  },
};

// Task templates for each agent
export const SEARCH_TASK_TEMPLATES = {
  analyzeQuery: (query: string) => `
As the Search Analyst: Analyze the following query and provide a structured analysis.

Query: "${query}"

Output your response as a structured JSON object with these fields:
{
  "intent": "What the user is trying to find",
  "engines": ["recommended search engines"],
  "parameters": {"safeSearch": boolean, "timeRange": string},
  "complexity": "simple|moderate|complex",
  "reasoning": "Why you selected these engines"
}
`,

  processResults: (query: string, results: string) => `
As the Result Processor: Analyze and rank the following search results for the query: "${query}"

Results:
${results}

Output your response as a structured JSON object with these fields:
{
  "processedResults": [{"id": string, "relevanceScore": number, "keyInsights": string[]}],
  "deduplication": {"removed": number, "reason": string},
  "topResults": ["id1", "id2", "id3"],
  "qualityAssessment": string
}
`,

  factCheck: (claim: string, sources: string) => `
As the Fact Checker: Verify the following claim using the provided sources.

Claim: "${claim}"

Sources:
${sources}

Output your response as a structured JSON object with these fields:
{
  "verified": boolean,
  "confidence": number (0-1),
  "contradictions": ["any conflicting information"],
  "supportingSources": ["source IDs that support the claim"],
  "recommendation": "include|exclude|flag"
}
`,

  formatCitations: (results: string) => `
As the Citation Formatter: Format the following search results into proper citations.

Results:
${results}

Output your response as a structured JSON array:
[{"id": number, "citation": "[1] Title - URL", "inlineFormat": "[1]"}]
`,

  synthesizeAnswer: (query: string, processedResults: string, citations: string) => `
As the Answer Architect: Create a comprehensive, well-structured answer for the query.

Query: "${query}"

Processed Results:
${processedResults}

Citations:
${citations}

Output your response with:
1. A clear, informative answer that directly addresses the query
2. Inline citations in [1][2][3] format throughout the text
3. A sources section at the bottom listing all references

Format the answer in plain text with proper citations.
`,
};

export default SEARCH_SWARM_AGENTS;
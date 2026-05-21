import { Citation, SearchProfile, SearchResult } from './SearchResult';

export interface LmStudioSynthesisOptions {
  endpoint: string;
  apiKey?: string;
  model: string;
  query: string;
  profile: SearchProfile;
  results: SearchResult[];
  citations: Citation[];
}

export async function synthesizeWithLmStudio(options: LmStudioSynthesisOptions): Promise<string> {
  const endpoint = options.endpoint?.trim();
  if (!endpoint) {
    throw new Error('LM Studio synthesis requires an endpoint.');
  }

  const topSources = options.results.slice(0, 6).map((result, index) => {
    const citationId = options.citations.find((citation) => citation.url === result.url)?.id ?? index + 1;
    return `[${citationId}] ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet}\n`;
  }).join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a search synthesis agent. Produce a concise factual answer using only the provided sources. Use inline citations like [1] and do not invent sources.',
        },
        {
          role: 'user',
          content: [
            `Query: ${options.query}`,
            `Intent: ${options.profile.intent}`,
            `Reasoning: ${options.profile.reasoning}`,
            'Sources:',
            topSources,
            'Answer format:',
            '- Start with a direct answer.',
            '- Use inline citations like [1][2].',
            '- Mention uncertainty if the sources conflict.',
          ].join('\n\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio synthesis failed: ${response.status}`);
  }

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('LM Studio synthesis returned an empty answer.');
  }

  return content;
}

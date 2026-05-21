import React, { useEffect, useRef, useState } from 'react';
import {
  Citation,
  SearchAgentTrace,
  SearchProfile,
  SearchResponse,
  SearchResult,
} from '../search-service/SearchResult';
import SearchResults from './SearchResults';

interface SearchInterfaceProps {
  onModeChange?: (mode: 'search' | 'council') => void;
}

type SearchState = {
  answer: string;
  citations: Citation[];
  sources: SearchResult[];
  relatedQuestions: string[];
  agentTrace: SearchAgentTrace[];
  profile: SearchProfile | null;
  status: string;
};

const DEFAULT_STATE: SearchState = {
  answer: '',
  citations: [],
  sources: [],
  relatedQuestions: [],
  agentTrace: [],
  profile: null,
  status: 'Ready',
};

const SearchInterface: React.FC<SearchInterfaceProps> = ({ onModeChange }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableEngines, setAvailableEngines] = useState<string[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<string[]>(['google', 'bing', 'duckduckgo']);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'degraded'>('checking');
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [engineResponse, healthResponse] = await Promise.all([
          fetch('/search-api/api/search/engines'),
          fetch('/search-api/health'),
        ]);

        if (engineResponse.ok) {
          const engineData = await engineResponse.json();
          const engines = Array.isArray(engineData.engines) ? engineData.engines.filter(Boolean) : [];
          if (engines.length > 0) {
            setAvailableEngines(engines);
            setSelectedEngines((current) => current.filter((engine) => engines.includes(engine)).length > 0
              ? current.filter((engine) => engines.includes(engine))
              : engines.slice(0, 4));
          }
        }

        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          setBackendStatus(healthData.searxng ? 'healthy' : 'degraded');
        } else {
          setBackendStatus('degraded');
        }
      } catch {
        setBackendStatus('degraded');
      }
    };

    loadMetadata();
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const toggleEngine = (engine: string) => {
    setSelectedEngines((current) => {
      if (current.includes(engine)) {
        return current.length === 1 ? current : current.filter((value) => value !== engine);
      }
      return [...current, engine];
    });
  };

  const finalizeFromResponse = (response: SearchResponse) => {
    setResults({
      answer: response.answer,
      citations: response.citations,
      sources: response.sources,
      relatedQuestions: response.relatedQuestions,
      agentTrace: response.agentTrace,
      profile: response.profile,
      status: 'Complete',
    });
  };

  const handleSearch = (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return;
    }

    eventSourceRef.current?.close();
    setIsSearching(true);
    setError(null);
    setResults({
      ...DEFAULT_STATE,
      status: 'Analyzing query...',
    });

    const params = new URLSearchParams({
      q: trimmedQuery,
      engines: selectedEngines.join(','),
    });

    const source = new EventSource(`/search-api/api/search/stream?${params.toString()}`);
    eventSourceRef.current = source;

    source.addEventListener('status', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as string;
      setResults((current) => ({
        ...(current ?? DEFAULT_STATE),
        status: payload,
      }));
    });

    source.addEventListener('profile', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as SearchProfile;
      setResults((current) => ({
        ...(current ?? DEFAULT_STATE),
        profile: payload,
      }));
    });

    source.addEventListener('source', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as SearchResult;
      setResults((current) => {
        const previous = current ?? DEFAULT_STATE;
        if (previous.sources.some((sourceItem) => sourceItem.url === payload.url)) {
          return previous;
        }
        return {
          ...previous,
          sources: [...previous.sources, payload],
        };
      });
    });

    source.addEventListener('citation', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as Citation;
      setResults((current) => {
        const previous = current ?? DEFAULT_STATE;
        if (previous.citations.some((citation) => citation.id === payload.id)) {
          return previous;
        }
        return {
          ...previous,
          citations: [...previous.citations, payload],
        };
      });
    });

    source.addEventListener('agent', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as SearchAgentTrace;
      setResults((current) => {
        const previous = current ?? DEFAULT_STATE;
        return {
          ...previous,
          agentTrace: [...previous.agentTrace, payload],
        };
      });
    });

    source.addEventListener('token', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as string;
      setResults((current) => ({
        ...(current ?? DEFAULT_STATE),
        answer: `${current?.answer ?? ''}${payload}`,
      }));
    });

    source.addEventListener('complete', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as SearchResponse;
      finalizeFromResponse(payload);
      setQuery(trimmedQuery);
      setIsSearching(false);
      source.close();
    });

    source.addEventListener('error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { message?: string } | string;
        setError(typeof payload === 'string' ? payload : payload.message ?? 'Search failed.');
      } catch {
        setError('Search failed.');
      }
      setIsSearching(false);
      source.close();
    });

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        return;
      }
      setError('Search stream disconnected. Check that the search API and SearXNG server are running.');
      setIsSearching(false);
      source.close();
    };
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,#020617_0%,#020617_30%,#08111f_100%)] text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950/85 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.3fr_0.7fr] md:px-8">
            <div>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">DuckBotSearch</p>
                  <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
                    Perplexity-style search powered by SearXNG and swarm analysis
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => onModeChange?.('council')}
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-700 hover:text-white"
                >
                  Council Mode
                </button>
              </div>

              <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                Google-style retrieval comes from your SearXNG instance, while the search swarm ranks,
                cross-checks, cites, and synthesizes the answer in real time.
              </p>

              <form
                className="mt-8 rounded-[28px] border border-slate-800 bg-slate-900/80 p-4 shadow-inner shadow-black/30"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSearch(query);
                }}
              >
                <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
                  Search Prompt
                </label>
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask a question, compare products, or run a research prompt..."
                  rows={3}
                  disabled={isSearching}
                  className="mt-3 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-600"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  {(availableEngines.length > 0 ? availableEngines : ['google', 'bing', 'duckduckgo', 'wikipedia']).map((engine) => {
                    const selected = selectedEngines.includes(engine);
                    return (
                      <button
                        key={engine}
                        type="button"
                        onClick={() => toggleEngine(engine)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          selected
                            ? 'border-cyan-600 bg-cyan-500/10 text-cyan-300'
                            : 'border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {engine}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span
                      className={`rounded-full px-2.5 py-1 ${
                        backendStatus === 'healthy'
                          ? 'bg-emerald-950/70 text-emerald-300'
                          : backendStatus === 'degraded'
                            ? 'bg-amber-950/70 text-amber-300'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      backend: {backendStatus}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      engines: {selectedEngines.join(', ')}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isSearching ? 'Searching...' : 'Launch Search Swarm'}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Search Modes</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="font-semibold text-white">Query Analyst</p>
                  <p>Selects the best SearXNG engines for the search intent.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="font-semibold text-white">Result Processor</p>
                  <p>Ranks, deduplicates, and diversifies the raw search graph.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="font-semibold text-white">Fact Checker</p>
                  <p>Measures corroboration and flags weak freshness or source diversity.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="font-semibold text-white">Answer Architect</p>
                  <p>Builds a cited answer plus follow-up prompts from the ranked results.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-rose-900/80 bg-rose-950/40 px-5 py-4 text-sm text-rose-200">
            {error}
          </section>
        )}

        {!results && !error && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/75 p-6 text-sm leading-7 text-slate-300">
            Try prompts like “latest AI agent framework releases”, “compare SearXNG vs Tavily”, or
            “how to self-host SearXNG on Windows”.
          </section>
        )}

        {results && (
          <SearchResults
            answer={results.answer}
            citations={results.citations}
            sources={results.sources}
            status={results.status}
            query={query}
            relatedQuestions={results.relatedQuestions}
            agentTrace={results.agentTrace}
            profile={results.profile}
            onQuestionSelect={(question) => {
              setQuery(question);
              handleSearch(question);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SearchInterface;

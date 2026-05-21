import React, { useEffect, useState } from 'react';
import { Settings } from '../types';
import {
  Citation,
  SearchAgentTrace,
  SearchProfile,
  SearchProvider,
  SearchResponse,
  SearchResult,
} from '../search-service/SearchResult';
import SearchResults from './SearchResults';

interface SearchInterfaceProps {
  onModeChange?: (mode: 'search' | 'council') => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

type SearchState = {
  answer: string;
  citations: Citation[];
  sources: SearchResult[];
  relatedQuestions: string[];
  agentTrace: SearchAgentTrace[];
  profile: SearchProfile | null;
  provider: SearchProvider;
  status: string;
};

const DEFAULT_STATE: SearchState = {
  answer: '',
  citations: [],
  sources: [],
  relatedQuestions: [],
  agentTrace: [],
  profile: null,
  provider: 'searxng',
  status: 'Ready',
};

const SearchInterface: React.FC<SearchInterfaceProps> = ({ onModeChange, settings, onSettingsChange }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableEngines, setAvailableEngines] = useState<string[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<string[]>(['google', 'bing', 'duckduckgo']);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'degraded'>('checking');
  const [searchProvider, setSearchProvider] = useState<SearchProvider>('searxng');
  const [synthesisProvider, setSynthesisProvider] = useState<'heuristic' | 'lmstudio'>('heuristic');
  const [lmStudioModel, setLmStudioModel] = useState('local-model');

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
  }, []);

  const updateProviderSetting = (field: keyof Settings['providers'], value: string) => {
    onSettingsChange({
      ...settings,
      providers: {
        ...settings.providers,
        [field]: value,
      },
    });
  };

  const toggleEngine = (engine: string) => {
    setSelectedEngines((current) => {
      if (current.includes(engine)) {
        return current.length === 1 ? current : current.filter((value) => value !== engine);
      }
      return [...current, engine];
    });
  };

  const currentSearchApiKey =
    searchProvider === 'brave'
      ? settings.providers.braveSearchApiKey || ''
      : searchProvider === 'tavily'
        ? settings.providers.tavilyApiKey || ''
        : '';

  const handleSearch = async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults({
      ...DEFAULT_STATE,
      provider: searchProvider,
      status: 'Dispatching search swarm...',
    });

    try {
      const response = await fetch('/search-api/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmedQuery,
          provider: searchProvider,
          engines: searchProvider === 'searxng' ? selectedEngines : undefined,
          apiKey: currentSearchApiKey || undefined,
          synthesisProvider,
          lmStudioEndpoint: synthesisProvider === 'lmstudio' ? settings.providers.lmStudioEndpoint : undefined,
          lmStudioApiKey: synthesisProvider === 'lmstudio' ? settings.providers.lmStudioApiKey : undefined,
          lmStudioModel: synthesisProvider === 'lmstudio' ? lmStudioModel : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Search failed.');
      }

      const data = payload as SearchResponse;
      setResults({
        answer: data.answer,
        citations: data.citations,
        sources: data.sources,
        relatedQuestions: data.relatedQuestions,
        agentTrace: data.agentTrace,
        profile: data.profile,
        provider: data.provider,
        status: 'Complete',
      });
    } catch (searchError: any) {
      setError(searchError.message || 'Search failed.');
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,#020617_0%,#020617_30%,#08111f_100%)] text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950/85 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.25fr_0.75fr] md:px-8">
            <div>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">DuckBotAISearch</p>
                  <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
                    Perplexity-style search with selectable backends and swarm synthesis
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
                Choose a search backend from SearXNG, Brave Search, or Tavily. Then let the search swarm rank, cross-check,
                cite, and optionally use LM Studio as the final synthesis provider.
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

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">Search Backend</label>
                    <select
                      value={searchProvider}
                      onChange={(event) => setSearchProvider(event.target.value as SearchProvider)}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="searxng">SearXNG</option>
                      <option value="brave">Brave Search</option>
                      <option value="tavily">Tavily</option>
                    </select>

                    {searchProvider === 'searxng' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
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
                    ) : (
                      <div className="mt-3">
                        <label className="text-xs text-slate-400">
                          {searchProvider === 'brave' ? 'Brave Search API Key' : 'Tavily API Key'}
                        </label>
                        <input
                          type="password"
                          value={currentSearchApiKey}
                          onChange={(event) => updateProviderSetting(searchProvider === 'brave' ? 'braveSearchApiKey' : 'tavilyApiKey', event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                          placeholder="Enter API key"
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">AI Provider</label>
                    <select
                      value={synthesisProvider}
                      onChange={(event) => setSynthesisProvider(event.target.value as 'heuristic' | 'lmstudio')}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="heuristic">Built-in Swarm Heuristic</option>
                      <option value="lmstudio">LM Studio</option>
                    </select>

                    {synthesisProvider === 'lmstudio' && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-slate-400">LM Studio Endpoint</label>
                          <input
                            type="text"
                            value={settings.providers.lmStudioEndpoint}
                            onChange={(event) => updateProviderSetting('lmStudioEndpoint', event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                            placeholder="http://localhost:1234/v1/chat/completions"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">LM Studio API Key</label>
                          <input
                            type="password"
                            value={settings.providers.lmStudioApiKey || ''}
                            onChange={(event) => updateProviderSetting('lmStudioApiKey', event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                            placeholder="optional"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">LM Studio Model</label>
                          <input
                            type="text"
                            value={lmStudioModel}
                            onChange={(event) => setLmStudioModel(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                            placeholder="local-model"
                          />
                        </div>
                      </div>
                    )}
                  </div>
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
                      search api: {backendStatus}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      backend: {searchProvider}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1">
                      ai: {synthesisProvider === 'lmstudio' ? 'LM Studio' : 'Built-in'}
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
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Swarm Layout</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="font-semibold text-white">Search Providers</p>
                  <p>SearXNG for metasearch, Brave Search for API search, and Tavily for research-oriented retrieval.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="font-semibold text-white">Agent Swarm</p>
                  <p>Query analyst, result processor, fact checker, citation formatter, and answer architect.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="font-semibold text-white">AI Provider</p>
                  <p>Use the built-in synthesis path or hand the final synthesis to LM Studio with an endpoint, model, and optional key.</p>
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
            Try prompts like "latest AI agent framework releases", "compare SearXNG vs Tavily", or "how to self-host SearXNG on Windows".
          </section>
        )}

        {results && (
          <SearchResults
            answer={results.answer}
            citations={results.citations}
            sources={results.sources}
            status={`${results.status} via ${results.provider}`}
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

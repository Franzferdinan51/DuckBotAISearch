import React, { useEffect, useMemo, useState } from 'react';
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

type FocusMode = 'web' | 'news' | 'technical' | 'academic' | 'compare';

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

const FOCUS_PRESETS: Record<FocusMode, { label: string; description: string; engines: string[] }> = {
  web: {
    label: 'Web',
    description: 'Balanced web results with broad coverage',
    engines: ['google', 'bing', 'duckduckgo'],
  },
  news: {
    label: 'News',
    description: 'Fresh reporting and current-event coverage',
    engines: ['google', 'bing', 'duckduckgo'],
  },
  technical: {
    label: 'Technical',
    description: 'Docs, references, and implementation details',
    engines: ['google', 'duckduckgo', 'wikipedia'],
  },
  academic: {
    label: 'Academic',
    description: 'Research-heavy retrieval with reference bias',
    engines: ['google', 'wikipedia', 'duckduckgo'],
  },
  compare: {
    label: 'Compare',
    description: 'Product and tool comparison mode',
    engines: ['google', 'bing', 'duckduckgo'],
  },
};

const STARTER_PROMPTS = [
  'Compare SearXNG vs Tavily vs Brave Search for an AI search app',
  'Best way to self-host SearXNG on Windows with Docker',
  'What changed in the latest OpenAI Responses API docs',
  'Compare LM Studio and Ollama for local model serving',
];

const getProviderMeta = (provider: SearchProvider) => {
  switch (provider) {
    case 'brave':
      return {
        label: 'Brave Search',
        blurb: 'Direct API results with fast commercial web coverage.',
      };
    case 'tavily':
      return {
        label: 'Tavily',
        blurb: 'Research-oriented API retrieval with structured snippets.',
      };
    default:
      return {
        label: 'SearXNG',
        blurb: 'Metasearch through your own backend with engine control.',
      };
  }
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
  const [focusMode, setFocusMode] = useState<FocusMode>('web');
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

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
            setSelectedEngines((current) => {
              const existing = current.filter((engine) => engines.includes(engine));
              if (existing.length > 0) {
                return existing;
              }
              return FOCUS_PRESETS.web.engines.filter((engine) => engines.includes(engine)).slice(0, 4);
            });
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

    const savedQueries = localStorage.getItem('duckbot_recent_queries');
    if (savedQueries) {
      try {
        const parsed = JSON.parse(savedQueries);
        if (Array.isArray(parsed)) {
          setRecentQueries(parsed.filter((value) => typeof value === 'string').slice(0, 6));
        }
      } catch {
        // ignore malformed local state
      }
    }

    loadMetadata();
  }, []);

  useEffect(() => {
    localStorage.setItem('duckbot_recent_queries', JSON.stringify(recentQueries.slice(0, 6)));
  }, [recentQueries]);

  const providerMeta = useMemo(() => getProviderMeta(searchProvider), [searchProvider]);

  const updateProviderSetting = (field: keyof Settings['providers'], value: string) => {
    onSettingsChange({
      ...settings,
      providers: {
        ...settings.providers,
        [field]: value,
      },
    });
  };

  const applyFocusMode = (mode: FocusMode) => {
    setFocusMode(mode);
    const available = availableEngines.length > 0 ? availableEngines : ['google', 'bing', 'duckduckgo', 'wikipedia'];
    const nextEngines = FOCUS_PRESETS[mode].engines.filter((engine) => available.includes(engine));
    if (nextEngines.length > 0) {
      setSelectedEngines(nextEngines);
    }
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

  const rememberQuery = (value: string) => {
    setRecentQueries((current) => [value, ...current.filter((item) => item !== value)].slice(0, 6));
  };

  const handleSearch = async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return;
    }

    setIsSearching(true);
    setError(null);
    rememberQuery(trimmedQuery);
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4efe3_0%,#efe8da_24%,#e5decf_100%)] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-5 md:px-8 md:py-8">
        <section className="overflow-hidden rounded-[32px] border border-black/10 bg-[linear-gradient(135deg,#17231d_0%,#111827_58%,#1f3b33_100%)] text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
          <div className="grid gap-10 px-6 py-7 md:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-emerald-200/80">
                <span className="rounded-full border border-white/15 px-3 py-1">DuckBotAISearch</span>
                <span className="rounded-full border border-white/15 px-3 py-1">Perplexity-style research UI</span>
                <span className="rounded-full border border-white/15 px-3 py-1">SearXNG + Swarm Synthesis</span>
              </div>

              <h1
                className="mt-6 max-w-4xl text-4xl leading-[1.02] tracking-tight text-white md:text-6xl"
                style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
              >
                Source-first AI search with a live research thread, not a council landing page.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200/85 md:text-lg">
                Run Google-style search through SearXNG, Brave, or Tavily, then let a swarm of query analysts, rankers,
                fact-checkers, and synthesizers turn the result set into a cited answer you can keep drilling into.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {Object.entries(FOCUS_PRESETS).map(([key, preset]) => {
                  const selected = focusMode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyFocusMode(key as FocusMode)}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        selected
                          ? 'bg-[#efe8da] text-slate-900 shadow-lg'
                          : 'border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <form
                className="mt-8 rounded-[28px] border border-white/12 bg-black/20 p-4 backdrop-blur md:p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSearch(query);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Ask DuckBot Search</p>
                    <p className="mt-1 text-sm text-slate-300/80">{FOCUS_PRESETS[focusMode].description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onModeChange?.('council')}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                  >
                    Council Mode
                  </button>
                </div>

                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask a question, compare tools, investigate a topic, or continue a research thread..."
                  rows={4}
                  disabled={isSearching}
                  className="mt-4 w-full resize-none rounded-[24px] border border-white/12 bg-[#efe8da] px-5 py-5 text-[17px] leading-7 text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-emerald-700"
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setQuery(prompt)}
                      className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-slate-100 transition hover:bg-white/10"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-300/80">
                    <span className={`rounded-full px-3 py-1 ${backendStatus === 'healthy' ? 'bg-emerald-400/20 text-emerald-100' : backendStatus === 'degraded' ? 'bg-amber-300/20 text-amber-100' : 'bg-white/10 text-slate-100'}`}>
                      Search API {backendStatus}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1">{providerMeta.label}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      {synthesisProvider === 'lmstudio' ? 'LM Studio Synthesis' : 'Swarm Heuristic'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="rounded-full bg-[#c6ff5b] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-900 transition hover:bg-[#d7ff87] disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                  >
                    {isSearching ? 'Searching' : 'Launch Search'}
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Search Routing</p>
                <div className="mt-4 grid gap-3">
                  {(['searxng', 'brave', 'tavily'] as SearchProvider[]).map((provider) => {
                    const selected = searchProvider === provider;
                    const meta = getProviderMeta(provider);
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => setSearchProvider(provider)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-[#c6ff5b] bg-[#c6ff5b]/12'
                            : 'border-white/12 bg-black/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{meta.label}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${selected ? 'bg-[#c6ff5b] text-slate-900' : 'bg-white/10 text-slate-200'}`}>
                            {selected ? 'Active' : 'Available'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-200/80">{meta.blurb}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/12 bg-white/8 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Synthesis Provider</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { id: 'heuristic', label: 'Built-in Swarm' },
                    { id: 'lmstudio', label: 'LM Studio' },
                  ].map((option) => {
                    const selected = synthesisProvider === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSynthesisProvider(option.id as 'heuristic' | 'lmstudio')}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          selected
                            ? 'bg-[#efe8da] text-slate-900'
                            : 'border border-white/12 bg-black/10 text-slate-100 hover:bg-white/10'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {searchProvider === 'searxng' ? (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Engine Mix</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(availableEngines.length > 0 ? availableEngines : ['google', 'bing', 'duckduckgo', 'wikipedia']).map((engine) => {
                        const selected = selectedEngines.includes(engine);
                        return (
                          <button
                            key={engine}
                            type="button"
                            onClick={() => toggleEngine(engine)}
                            className={`rounded-full px-3 py-1.5 text-sm transition ${
                              selected
                                ? 'bg-white text-slate-900'
                                : 'border border-white/12 bg-black/10 text-slate-100 hover:bg-white/10'
                            }`}
                          >
                            {engine}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <label className="text-xs uppercase tracking-[0.18em] text-slate-300">
                      {searchProvider === 'brave' ? 'Brave Search API Key' : 'Tavily API Key'}
                    </label>
                    <input
                      type="password"
                      value={currentSearchApiKey}
                      onChange={(event) => updateProviderSetting(searchProvider === 'brave' ? 'braveSearchApiKey' : 'tavilyApiKey', event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/12 bg-[#efe8da] px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
                      placeholder="Enter API key"
                    />
                  </div>
                )}

                {synthesisProvider === 'lmstudio' && (
                  <div className="mt-5 space-y-3">
                    <div>
                      <label className="text-xs uppercase tracking-[0.18em] text-slate-300">LM Studio Endpoint</label>
                      <input
                        type="text"
                        value={settings.providers.lmStudioEndpoint}
                        onChange={(event) => updateProviderSetting('lmStudioEndpoint', event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/12 bg-[#efe8da] px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
                        placeholder="http://localhost:1234/v1/chat/completions"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.18em] text-slate-300">LM Studio API Key</label>
                      <input
                        type="password"
                        value={settings.providers.lmStudioApiKey || ''}
                        onChange={(event) => updateProviderSetting('lmStudioApiKey', event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/12 bg-[#efe8da] px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.18em] text-slate-300">LM Studio Model</label>
                      <input
                        type="text"
                        value={lmStudioModel}
                        onChange={(event) => setLmStudioModel(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/12 bg-[#efe8da] px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
                        placeholder="local-model"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-white/12 bg-white/8 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Recent Searches</p>
                <div className="mt-4 space-y-2">
                  {recentQueries.length === 0 ? (
                    <p className="text-sm leading-6 text-slate-200/70">Your search thread will accumulate here as you investigate topics.</p>
                  ) : (
                    recentQueries.map((recentQuery) => (
                      <button
                        key={recentQuery}
                        type="button"
                        onClick={() => {
                          setQuery(recentQuery);
                          handleSearch(recentQuery);
                        }}
                        className="block w-full rounded-2xl border border-white/12 bg-black/10 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/10"
                      >
                        {recentQuery}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-[28px] border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-900 shadow-sm">
            {error}
          </section>
        )}

        {!results && !error && (
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-black/10 bg-white/75 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">What This UI Adds</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-[#f8f4ec] p-5">
                  <p className="text-sm font-semibold text-slate-900">Research Thread</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Search like a running investigation, not a single-shot form submission.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-[#f8f4ec] p-5">
                  <p className="text-sm font-semibold text-slate-900">Source-First Answering</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Answer canvas, source strip, and citation depth are separated cleanly.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-[#f8f4ec] p-5">
                  <p className="text-sm font-semibold text-slate-900">Backend Control</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Switch between SearXNG, Brave, and Tavily without burying provider state.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-[#f8f4ec] p-5">
                  <p className="text-sm font-semibold text-slate-900">AI Routing</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Keep heuristic synthesis or hand off the final pass to LM Studio.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/10 bg-[#17231d] p-6 text-slate-100 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">Focus Modes</p>
              <div className="mt-5 space-y-3">
                {Object.entries(FOCUS_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyFocusMode(key as FocusMode)}
                    className={`block w-full rounded-3xl border px-5 py-4 text-left transition ${
                      focusMode === key
                        ? 'border-[#c6ff5b] bg-[#c6ff5b]/12'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{preset.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
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

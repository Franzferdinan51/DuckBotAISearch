import React from 'react';
import {
  Citation,
  SearchAgentTrace,
  SearchProfile,
  SearchResult,
} from '../search-service/SearchResult';
import CitationCard from './CitationCard';

interface SearchResultsProps {
  answer: string;
  citations: Citation[];
  sources: SearchResult[];
  status: string;
  query: string;
  relatedQuestions: string[];
  agentTrace: SearchAgentTrace[];
  profile: SearchProfile | null;
  onQuestionSelect: (question: string) => void;
}

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

const SearchResults: React.FC<SearchResultsProps> = ({
  answer,
  citations,
  sources,
  status,
  query,
  relatedQuestions,
  agentTrace,
  profile,
  onQuestionSelect,
}) => {
  const renderAnswerWithCitations = (text: string) => {
    const parts = text.split(/(\[\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) {
        return <React.Fragment key={index}>{part}</React.Fragment>;
      }

      const citation = citations[Number(match[1]) - 1];
      if (!citation) {
        return <React.Fragment key={index}>{part}</React.Fragment>;
      }

      return (
        <button
          key={index}
          type="button"
          title={citation.title}
          onClick={() => window.open(citation.url, '_blank', 'noopener,noreferrer')}
          className="mx-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-900 transition hover:bg-emerald-100"
        >
          {match[1]}
        </button>
      );
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-black/10 bg-white/75 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] md:p-5">
        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200 bg-[#f8f4ec] p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Research Thread</p>
            <h2
              className="mt-3 text-3xl leading-tight text-slate-950"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
            >
              {query}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-slate-600">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">{status}</span>
              {profile && <span className="rounded-full bg-slate-200 px-3 py-1">Intent {profile.intent}</span>}
              <span className="rounded-full bg-slate-200 px-3 py-1">{sources.length} sources ranked</span>
              <span className="rounded-full bg-slate-200 px-3 py-1">{citations.length} citations</span>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-[#17231d] p-5 text-slate-100">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Search Snapshot</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Top Domains</p>
                <p className="mt-2 text-sm leading-6 text-white">
                  {[...new Set(sources.slice(0, 3).map((source) => getDomain(source.url)))].join(', ') || 'Waiting for results'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Swarm Agents</p>
                <p className="mt-2 text-sm leading-6 text-white">{agentTrace.length || 0} active roles</p>
              </div>
            </div>
            {profile && (
              <p className="mt-4 text-sm leading-7 text-slate-300">
                {profile.reasoning}
              </p>
            )}
          </div>
        </div>
      </section>

      {sources.length > 0 && (
        <section className="rounded-[30px] border border-black/10 bg-[#17231d] p-5 text-slate-100 shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Source Strip</p>
              <p className="mt-1 text-sm text-slate-300">The highest-ranked pages driving the answer.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {sources.slice(0, 4).map((source, index) => (
              <button
                key={source.id}
                type="button"
                onClick={() => window.open(source.url, '_blank', 'noopener,noreferrer')}
                className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#c6ff5b] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-900">
                    Source {index + 1}
                  </span>
                  <span className="text-xs uppercase tracking-[0.14em] text-slate-300">{source.engine}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-white">{source.title}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{source.snippet}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-emerald-200">{getDomain(source.url)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-black/10 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Answer</p>
                <p className="mt-1 text-sm text-slate-500">Synthesized from the ranked source set.</p>
              </div>
            </div>

            <div className="mt-5 whitespace-pre-wrap text-[16px] leading-8 text-slate-800">
              {answer ? renderAnswerWithCitations(answer) : (
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                  The swarm is still composing the answer.
                </span>
              )}
            </div>
          </section>

          {relatedQuestions.length > 0 && (
            <section className="rounded-[30px] border border-black/10 bg-[#f8f4ec] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Continue The Thread</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {relatedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onQuestionSelect(question)}
                    className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left text-sm leading-6 text-slate-800 transition hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </section>
          )}

          {citations.length > 0 && (
            <section className="rounded-[30px] border border-black/10 bg-white/80 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Citations</p>
                  <p className="mt-1 text-sm text-slate-500">Direct evidence cards behind the answer.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {citations.map((citation) => (
                  <CitationCard key={citation.id} citation={citation} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {profile && (
            <section className="rounded-[30px] border border-black/10 bg-[#17231d] p-5 text-slate-100 shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Search Profile</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Intent</p>
                  <p className="mt-2 text-sm font-semibold text-white">{profile.intent}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Recommended Engines</p>
                  <p className="mt-2 text-sm leading-6 text-white">{profile.recommendedEngines.join(', ') || 'Not specified'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300">Safety</p>
                  <p className="mt-2 text-sm leading-6 text-white">{profile.safeSearch ? 'Safe search on' : 'Safe search off'}</p>
                </div>
              </div>
            </section>
          )}

          {agentTrace.length > 0 && (
            <section className="rounded-[30px] border border-black/10 bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Swarm Timeline</p>
              <div className="mt-4 space-y-3">
                {agentTrace.map((trace) => (
                  <div
                    key={`${trace.agentId}-${trace.summary}`}
                    className="rounded-[24px] border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{trace.agentName}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-emerald-700">{trace.role}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-600">
                        {trace.agentId}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{trace.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sources.length > 0 && (
            <section className="rounded-[30px] border border-black/10 bg-white/80 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">All Ranked Sources</p>
              <div className="mt-4 space-y-3">
                {sources.slice(0, 8).map((source, index) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => window.open(source.url, '_blank', 'noopener,noreferrer')}
                    className="block w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-6 text-slate-900">{source.title}</p>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{source.snippet}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                          <span>{getDomain(source.url)}</span>
                          <span>{source.engine}</span>
                          <span>{Math.round(source.relevanceScore * 100)} relevance</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>
    </div>
  );
};

export default SearchResults;

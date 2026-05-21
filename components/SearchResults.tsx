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
          className="mx-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-semibold text-cyan-900 transition hover:bg-cyan-200"
        >
          {match[1]}
        </button>
      );
    });
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl shadow-cyan-950/20">
        <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-cyan-950/40 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Search Question</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{query}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-emerald-900/60 bg-emerald-950/60 px-2.5 py-1 text-emerald-300">
              {status}
            </span>
            {profile && (
              <>
                <span className="rounded-full border border-slate-700 px-2.5 py-1">
                  intent: {profile.intent}
                </span>
                <span className="rounded-full border border-slate-700 px-2.5 py-1">
                  engines: {profile.recommendedEngines.join(', ')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-500">Answer</p>
            <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-100">
              {answer ? renderAnswerWithCitations(answer) : (
                <span className="inline-flex items-center gap-2 text-slate-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                  The swarm is still synthesizing the answer.
                </span>
              )}
            </div>
          </div>

          {profile && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Swarm Analysis</p>
              <p className="text-sm leading-6 text-slate-300">{profile.reasoning}</p>
            </div>
          )}

          {agentTrace.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="mb-4 text-xs uppercase tracking-[0.25em] text-slate-500">Agent Swarm</p>
              <div className="grid gap-3 md:grid-cols-2">
                {agentTrace.map((trace) => (
                  <div
                    key={`${trace.agentId}-${trace.summary}`}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">{trace.agentName}</h3>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                        {trace.agentId}
                      </span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-400">{trace.role}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{trace.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {citations.length > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/85 p-6 shadow-xl shadow-slate-950/20">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Citations</h3>
          <div className="grid gap-3">
            {citations.map((citation) => (
              <CitationCard key={citation.id} citation={citation} />
            ))}
          </div>
        </section>
      )}

      {sources.length > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/85 p-6 shadow-xl shadow-slate-950/20">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Source Graph</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {sources.slice(0, 8).map((source, index) => (
              <button
                key={source.id}
                type="button"
                onClick={() => window.open(source.url, '_blank', 'noopener,noreferrer')}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-cyan-700 hover:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-cyan-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-white">{source.title}</p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{source.snippet}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>{source.engine}</span>
                      <span>{Math.round(source.relevanceScore * 100)}% relevance</span>
                      {source.publishedDate && <span>{source.publishedDate}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {relatedQuestions.length > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-950/85 p-6 shadow-xl shadow-slate-950/20">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Follow-Up Questions</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {relatedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onQuestionSelect(question)}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-700 hover:bg-slate-900"
              >
                {question}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default SearchResults;

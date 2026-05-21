import React from 'react';
import { Citation } from '../search-service/SearchResult';

interface CitationCardProps {
  citation: Citation;
}

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

const CitationCard: React.FC<CitationCardProps> = ({ citation }) => {
  return (
    <button
      type="button"
      onClick={() => window.open(citation.url, '_blank', 'noopener,noreferrer')}
      className="group block w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50"
    >
      <div className="flex items-start gap-4">
        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
          [{citation.id}]
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <span>{getDomain(citation.url)}</span>
            <span>{citation.engine}</span>
            <span>{Math.round(citation.relevanceScore * 100)} relevance</span>
            {citation.publishedDate && <span>{citation.publishedDate}</span>}
          </div>

          <h4 className="mt-2 text-sm font-semibold leading-6 text-slate-900 transition group-hover:text-emerald-800">
            {citation.title}
          </h4>

          {citation.snippet && (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
              {citation.snippet}
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

export default CitationCard;

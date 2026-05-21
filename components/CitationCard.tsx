/**
 * Citation Card Component
 * Displays a single citation with source information
 */

import React, { useState } from 'react';
import { Citation } from '../search-service/SearchResult';

interface CitationCardProps {
  citation: Citation;
}

const CitationCard: React.FC<CitationCardProps> = ({ citation }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    window.open(citation.url, '_blank', 'noopener,noreferrer');
  };

  const getDomain = (url: string): string => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div
      className="group relative p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        {/* Citation Number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
            [{citation.id}]
          </span>
        </div>

        {/* Citation Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white truncate mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {citation.title}
          </h4>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            {/* Favicon */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${getDomain(citation.url)}&sz=16`}
              alt=""
              className="w-4 h-4"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="truncate">{getDomain(citation.url)}</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="capitalize">{citation.engine}</span>
          </div>
        </div>

        {/* Relevance Badge */}
        <div className="flex-shrink-0">
          <div
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              citation.relevanceScore > 0.7
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : citation.relevanceScore > 0.4
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {Math.round(citation.relevanceScore * 100)}%
          </div>
        </div>
      </div>

      {/* Snippet Preview on Hover */}
      {isHovered && citation.snippet && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {citation.snippet.slice(0, 200)}
            {citation.snippet.length > 200 ? '...' : ''}
          </p>
        </div>
      )}

      {/* Hover Indicator */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-200 dark:group-hover:border-blue-800 rounded-xl transition-colors pointer-events-none" />
    </div>
  );
};

export default CitationCard;
'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfinity, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { getQuotaInfo, QuotaInfo as QuotaInfoData } from '../../utils/helpers';

interface QuotaInfoBadgeProps {
  appData: any;
  usageKey: string;
  /** Compact = single line (chips); full = bar + message */
  compact?: boolean;
}

/**
 * Monthly usage vs plan limit for one quota key.
 * Renders nothing when the key is unknown or limits aren't loaded.
 */
export const QuotaInfoBadge = ({ appData, usageKey, compact = false }: QuotaInfoBadgeProps) => {
  const q: QuotaInfoData | null = getQuotaInfo(appData, usageKey);
  if (!q) return null;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xxs font-semibold px-2 py-0.5 rounded-full ${
          q.exhausted
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : q.unlimited
              ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              : q.pct >= 80
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        }`}
        title={`${q.label}: ${q.unlimited ? 'unlimited' : `${q.used}/${q.limit} used this month`}`}
      >
        {q.label}
        {q.unlimited ? (
          <><FontAwesomeIcon icon={faInfinity} className="w-2.5 h-2.5" /></>
        ) : (
          <span>{q.used}/{q.limit}</span>
        )}
      </span>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{q.label} — monthly usage</span>
        <span
          className={`text-xs font-bold ${
            q.exhausted
              ? 'text-red-600 dark:text-red-400'
              : q.unlimited
                ? 'text-gray-500 dark:text-gray-400'
                : q.pct >= 80
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-800 dark:text-gray-100'
          }`}
        >
          {q.unlimited ? (
            <><FontAwesomeIcon icon={faInfinity} className="w-3 h-3 mr-0.5" />Unlimited</>
          ) : (
            <>{q.used.toLocaleString()} / {q.limit.toLocaleString()}</>
          )}
        </span>
      </div>
      {!q.unlimited && (
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              q.exhausted ? 'bg-red-500' : q.pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${q.pct}%` }}
          />
        </div>
      )}
      {q.exhausted && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
          <FontAwesomeIcon icon={faTriangleExclamation} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Monthly limit reached — upgrade your plan to continue.
        </p>
      )}
    </div>
  );
};

export default QuotaInfoBadge;

"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faFilter } from '@fortawesome/free-solid-svg-icons';

export type StatusFilter = 'ALL' | 'VERIFIED' | 'UNVERIFIED' | 'FULL_ACCESS';

interface DashboardFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  resultCount: number;
  totalCount: number;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All Status' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'UNVERIFIED', label: 'Unverified' },
  { value: 'FULL_ACCESS', label: 'Full Access' },
];

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  resultCount,
  totalCount,
  onClear,
}) => {
  const isFiltering = search.trim() !== '' || statusFilter !== 'ALL';

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
      <div className="relative flex-1">
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search email, domain, platform, username, memo..."
          className="w-full pl-9 pr-9 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Clear search"
          >
            <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative">
        <FontAwesomeIcon
          icon={faFilter}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          className="pl-8 pr-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between md:justify-start gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {isFiltering
            ? `${resultCount} of ${totalCount} shown`
            : `${totalCount} total`}
        </span>
        {isFiltering && (
          <button
            onClick={onClear}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

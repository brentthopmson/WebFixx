"use client";

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faClock,
  faTimesCircle,
  faSearch,
  faChevronLeft,
  faChevronRight,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import type { Campaign } from '../../../types';

interface CSVRow {
  [key: string]: string;
}

type RowStatus = 'done' | 'failed' | 'waiting';

interface RowProgress {
  status: RowStatus;
  identity: string;
  secondary: string;
  detail: string;
  timestamp: string;
  sn: string;
  url: string;
  context: string;
}

interface CampaignProgressViewProps {
  campaign: Campaign;
  rows: CSVRow[];
  loading: boolean;
}

const STATUS_META: Record<RowStatus, {
  label: string;
  badge: string;
  border: string;
  avatar: string;
  dot: string;
  icon: any;
  text: string;
}> = {
  done: {
    label: 'Done',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300',
    border: 'border-l-green-500',
    avatar: 'bg-green-500',
    dot: 'bg-green-500',
    icon: faCheckCircle,
    text: 'text-green-600 dark:text-green-400',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300',
    border: 'border-l-red-500',
    avatar: 'bg-red-500',
    dot: 'bg-red-500',
    icon: faTimesCircle,
    text: 'text-red-600 dark:text-red-400',
  },
  waiting: {
    label: 'Waiting',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    border: 'border-l-amber-400',
    avatar: 'bg-amber-400',
    dot: 'bg-amber-400',
    icon: faClock,
    text: 'text-amber-600 dark:text-amber-400',
  },
};

function getRowProgress(row: CSVRow, channel: string): RowProgress {
  const email = (row['EMAIL'] || '').trim();
  const username = (row['SOCIALUSERNAME'] || '').trim();
  const firstName = (row['FIRSTNAME'] || '').trim();
  const lastName = (row['LASTNAME'] || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const company = (row['BUSINESSNAME'] || '').trim();
  const platform = (row['SOCIALPLATFORM'] || '').trim();
  const sn = (row['SN'] || '').trim();
  const url = (row['URL'] || '').trim();
  const context = (row['CONTEXT'] || '').trim();

  if (channel === 'social') {
    const searchStatus = (row['searchStatus'] || '').trim().toLowerCase();
    const interactStatus = (row['interactStatus'] || '').trim().toLowerCase();
    const searchStamp = (row['searchStamp'] || '').trim();
    const interactStamp = (row['interactStamp'] || '').trim();
    const stamp = searchStamp || interactStamp;
    const searchKeys = (row['searchKeys'] || '').trim();
    const failed = searchStatus === 'failed' || interactStatus === 'failed';
    const done =
      searchStatus === 'executed' || searchStatus === 'messaged' ||
      interactStatus === 'executed' || interactStatus === 'messaged';

    let status: RowStatus = 'waiting';
    if (failed) status = 'failed';
    else if (done) status = 'done';

    const detail = failed
      ? (searchKeys || 'Interaction failed')
      : done
        ? (searchKeys || `Interacted (${(row['searchCount'] || row['interactCount'] || '—')})`)
        : 'Queued for interaction';

    return {
      status,
      identity: username || email || fullName || '—',
      secondary: platform || fullName || company,
      detail,
      timestamp: stamp,
      sn,
      url,
      context,
    };
  }

  const validation = (row['validation'] || '').trim().toLowerCase();
  const sendStamp = (row['sendStamp'] || '').trim();
  const provider = (row['providerMXResult'] || '').trim();
  const valStatus = (row['validation_status'] || '').trim();

  let status: RowStatus = 'waiting';
  if (validation === 'failed') status = 'failed';
  else if (validation === 'sent') status = 'done';

  const detail = status === 'failed'
    ? (provider || 'Delivery failed')
    : status === 'done'
      ? (provider ? `Sent via ${provider}` : 'Sent')
      : (valStatus ? `Validation: ${valStatus}` : 'Queued for delivery');

  return {
    status,
    identity: email || username || fullName || '—',
    secondary: fullName || company || platform,
    detail,
    timestamp: sendStamp,
    sn,
    url,
    context,
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const second = parts.length > 1 ? (parts[parts.length - 1][0] || '') : '';
  return (first + second).toUpperCase();
}

function formatTime(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export function CampaignProgressView({ campaign, rows, loading }: CampaignProgressViewProps) {
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  const progressRows = useMemo(
    () => rows.map(r => getRowProgress(r, campaign.channel)),
    [rows, campaign.channel]
  );

  const counts = useMemo(() => ({
    done: progressRows.filter(r => r.status === 'done').length,
    failed: progressRows.filter(r => r.status === 'failed').length,
    waiting: progressRows.filter(r => r.status === 'waiting').length,
  }), [progressRows]);

  const filtered = useMemo(() => {
    let list = progressRows;
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.identity.toLowerCase().includes(q) ||
        r.secondary.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q)
      );
    }
    return list;
  }, [progressRows, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const processed = counts.done + counts.failed;
  const total = progressRows.length;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  const filterChips: Array<{ key: RowStatus | 'all'; label: string; count: number; active: string; idle: string }> = [
    { key: 'all', label: 'All', count: total, active: 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900', idle: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
    { key: 'done', label: 'Done', count: counts.done, active: 'bg-green-600 text-white', idle: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
    { key: 'waiting', label: 'Waiting', count: counts.waiting, active: 'bg-amber-500 text-white', idle: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
    { key: 'failed', label: 'Failed', count: counts.failed, active: 'bg-red-600 text-white', idle: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  ];

  return (
    <div>
      {/* Summary strip */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</p>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            {processed.toLocaleString()} / {total.toLocaleString()} processed ({pct}%)
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {(['done', 'waiting', 'failed'] as RowStatus[]).map(s => (
            <div key={s} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-700 ${STATUS_META[s].badge}`}>
              <FontAwesomeIcon icon={STATUS_META[s].icon} className={`w-3.5 h-3.5 ${STATUS_META[s].text}`} />
              <span className="text-xs font-semibold">{STATUS_META[s].label}</span>
              <span className="text-sm font-bold">{counts[s].toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter + search */}
      <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {filterChips.map(chip => (
            <button
              key={chip.key}
              onClick={() => { setStatusFilter(chip.key); setPage(1); }}
              className={`px-2.5 py-1 text-xxs font-semibold rounded-full transition-colors ${statusFilter === chip.key ? chip.active : chip.idle}`}
            >
              {chip.label} <span className="opacity-70">({chip.count.toLocaleString()})</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Body */}
      {loading && rows.length === 0 ? (
        <div className="p-10 text-center">
          <FontAwesomeIcon icon={faSpinner} className="w-6 h-6 text-blue-500 animate-spin" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading contact progress...</p>
        </div>
      ) : paginated.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {campaign.fileUrl ? 'No contacts match the current filter.' : 'No CSV file uploaded for this campaign.'}
          </p>
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {paginated.map((row, i) => {
              const meta = STATUS_META[row.status];
              return (
                <li
                  key={`${safePage}-${i}`}
                  className={`flex items-center gap-3 px-4 py-3 border-l-4 ${meta.border} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}
                  title={row.detail}
                >
                  <div className={`w-9 h-9 rounded-full ${meta.avatar} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {initials(row.identity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold dark:text-white truncate">{row.identity}</span>
                      {row.sn && <span className="text-xxs text-gray-400 font-mono shrink-0">#{row.sn}</span>}
                    </div>
                    {row.secondary && (
                      <p className="text-xxs text-gray-500 dark:text-gray-400 truncate">{row.secondary}</p>
                    )}
                    <p className="text-xxs text-gray-400 dark:text-gray-500 truncate">{row.detail}</p>
                    {row.url && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xxs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate block max-w-full"
                        title={row.url}
                      >
                        {row.url.replace(/^https?:\/\//, '').slice(0, 50)}
                      </a>
                    )}
                    {row.context && (
                      <p className="text-xxs text-gray-400 dark:text-gray-500 truncate italic" title={row.context}>
                        {row.context.slice(0, 80)}{row.context.length > 80 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xxs font-semibold rounded-full ${meta.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    {row.timestamp && (
                      <span className="text-xxs text-gray-400 dark:text-gray-500">{formatTime(row.timestamp)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          <p className="text-xxs text-gray-500 dark:text-gray-400">
            Showing {(safePage - 1) * rowsPerPage + 1}-{Math.min(safePage * rowsPerPage, filtered.length)} of {filtered.length} contacts
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
            </button>
            <span className="text-xxs text-gray-600 dark:text-gray-300">{safePage} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
            >
              <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
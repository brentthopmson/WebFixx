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
  faSpinner,
  faDownload,
  faShieldAlt,
  faMagic,
  faRocket
} from '@fortawesome/free-solid-svg-icons';
import type { Campaign } from '../../../types';

interface CSVRow {
  [key: string]: string;
}

type StageBucket = 'execute' | 'personalize' | 'enrich' | 'validated' | 'failed';
type TabKey = 'all' | StageBucket;

interface RowProgress {
  bucket: StageBucket;
  label: string;
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
  headers?: string[];
}

const BUCKET_META: Record<StageBucket, {
  label: string;
  badge: string;
  border: string;
  avatar: string;
  dot: string;
  icon: any;
  text: string;
  chipActive: string;
  chipIdle: string;
}> = {
  execute: {
    label: 'Execute',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300',
    border: 'border-l-green-500',
    avatar: 'bg-green-500',
    dot: 'bg-green-500',
    icon: faRocket,
    text: 'text-green-600 dark:text-green-400',
    chipActive: 'bg-green-600 text-white',
    chipIdle: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  personalize: {
    label: 'Personalize',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
    border: 'border-l-purple-500',
    avatar: 'bg-purple-500',
    dot: 'bg-purple-500',
    icon: faMagic,
    text: 'text-purple-600 dark:text-purple-400',
    chipActive: 'bg-purple-600 text-white',
    chipIdle: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
  enrich: {
    label: 'Enrich',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
    border: 'border-l-blue-500',
    avatar: 'bg-blue-500',
    dot: 'bg-blue-500',
    icon: faSearch,
    text: 'text-blue-600 dark:text-blue-400',
    chipActive: 'bg-blue-600 text-white',
    chipIdle: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  validated: {
    label: 'Validated',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    border: 'border-l-amber-400',
    avatar: 'bg-amber-500',
    dot: 'bg-amber-400',
    icon: faShieldAlt,
    text: 'text-amber-600 dark:text-amber-400',
    chipActive: 'bg-amber-500 text-white',
    chipIdle: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300',
    border: 'border-l-red-500',
    avatar: 'bg-red-500',
    dot: 'bg-red-500',
    icon: faTimesCircle,
    text: 'text-red-600 dark:text-red-400',
    chipActive: 'bg-red-600 text-white',
    chipIdle: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
};

const norm = (v: any) => String(v ?? '').trim().toLowerCase();

const VALIDATION_HARD_FAIL = new Set([
  'not_exists', 'invalid_domain', 'no_mx', 'invalid_format', 'empty', 'duplicate',
  'invalid', 'failed', 'bounce', 'bounced', 'risky', 'mailbox_not_found', 'user_unknown', 'domain_not_found'
]);
const VALIDATION_ELIGIBLE = new Set(['verified_exists', 'valid_mx', 'social_valid']);
const EXEC_SENT = new Set(['sent', 'scheduled']);
const EXEC_FAILED = new Set(['failed', 'failed_final', 'skipped_invalid', 'skipped', 'blocked']);
const ENRICH_DONE = new Set(['enriched', 'no_data', 'skipped', 'completed']);

function getStaged(campaign: Campaign) {
  const c: any = campaign || {};
  const isSocial = c.channel === 'social';
  const validationStaged = !!c.validationStaged && !isSocial;
  const enrichmentStaged = !!c.enrichmentStaged && !isSocial;
  const personalizeStaged = !!c.aiPersonalizationStaged && !isSocial;
  const executeStaged = c.executeStaged !== false; // default true for email; social still has execution outcomes
  return { validationStaged, enrichmentStaged, personalizeStaged, executeStaged, isSocial };
}

function classifyRow(row: CSVRow, campaign: Campaign): RowProgress {
  const { validationStaged, enrichmentStaged, personalizeStaged, isSocial } = getStaged(campaign);
  const get = (k: string) => {
    if (row[k] != null && row[k] !== '') return String(row[k]);
    const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
    return found ? String(row[found] ?? '') : '';
  };

  const email = get('EMAIL').trim();
  const username = get('SOCIALUSERNAME').trim();
  const firstName = get('FIRSTNAME').trim();
  const lastName = get('LASTNAME').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const company = get('BUSINESSNAME').trim();
  const platform = get('SOCIALPLATFORM').trim();
  const sn = get('SN').trim();
  const url = get('URL').trim();
  const context = get('CONTEXT').trim();

  const validation = norm(get('validation'));
  const provider = get('providerMXResult').trim();
  const execStatus = norm(get('executionStatus') || get('lastSendStatus'));
  const lastError = get('lastSendError').trim();
  const enrichmentStatus = norm(get('enrichmentStatus'));
  const personalizationStatus = norm(get('personalizationStatus'));
  const enhancedBody = get('enhancedBody').trim();
  const enhancedSubject = get('enhancedSubject').trim();
  const enhancedSocial = get('enhancedSocialMessage').trim();

  const searchStatus = norm(get('searchStatus'));
  const interactStatus = norm(get('interactStatus'));
  const searchKeys = get('searchKeys').trim();
  const interactCount = get('interactCount').trim();
  const searchStamp = get('searchStamp').trim();
  const interactStamp = get('interactStamp').trim();
  const sendStamp = get('sendStamp').trim();
  const sendDate = get('sendDate').trim();
  const sendTime = get('sendTime').trim();

  const identity = (isSocial ? (username || email || fullName) : (email || username || fullName)) || '—';
  const secondary = isSocial ? (platform || fullName || company) : (fullName || company || platform);
  const ts = interactStamp || sendStamp || searchStamp || [sendDate, sendTime].filter(Boolean).join(' ');

  const isExecFailed = EXEC_FAILED.has(execStatus) || execStatus.endsWith('_failed') || execStatus.endsWith('_error');
  const isSent = EXEC_SENT.has(execStatus) || (EXEC_SENT.has(validation) && !isSocial);
  const isSocialDone = searchStatus === 'executed' || searchStatus === 'messaged' || interactStatus === 'executed' || interactStatus === 'messaged';
  const isSocialFailed = searchStatus === 'failed' || interactStatus === 'failed' || execStatus === 'failed' || execStatus === 'failed_final';
  const personalizedDone = personalizationStatus === 'personalized' || personalizationStatus === 'completed' || !!enhancedBody || !!enhancedSubject || !!enhancedSocial;
  const enrichFinalized = ENRICH_DONE.has(enrichmentStatus);
  const validationEligibleFinal = VALIDATION_ELIGIBLE.has(validation);
  const validationHardFail = VALIDATION_HARD_FAIL.has(validation);

  let bucket: StageBucket = 'validated';
  let label = 'Pending';
  let detail = 'Queued';

  // 1) Failed / blocked
  if (isExecFailed || isSocialFailed || validationHardFail || (validationStaged && !isSocial && norm(execStatus) === 'skipped_invalid')) {
    bucket = 'failed';
    label = 'Failed';
    const reason = lastError || (validationHardFail ? `Validation: ${validation || 'invalid'}` : '') || provider || searchKeys || execStatus || 'Failed/blocked';
    detail = reason;
  }
  // 2) Execute / Done
  else if (isSent || (!isSocial && execStatus === 'sent') || (isSocial && isSocialDone)) {
    bucket = 'execute';
    label = isSent && validation === 'scheduled' || execStatus === 'scheduled' ? 'Scheduled' : 'Done';
    if (isSocial) {
      detail = searchKeys || (interactStatus ? `Interacted${interactCount ? ` (${interactCount})` : ''}` : 'Executed');
    } else {
      detail = provider ? `Sent via ${provider}` : (execStatus === 'scheduled' ? 'Scheduled' : 'Sent');
      if (interactStatus === 'monitoring') detail += ` · Monitoring${interactCount ? ` (${interactCount} replies)` : ''}`;
      else if (interactStatus === 'executed' || interactStatus === 'messaged') detail += ` · Interacted${interactCount ? ` (${interactCount})` : ''}`;
    }
  }
  // 3) Personalize
  else if (personalizeStaged && personalizedDone) {
    bucket = 'personalize';
    label = 'Personalized';
    detail = personalizationStatus ? `Personalization: ${personalizationStatus}` : 'Personalized content ready';
  }
  // 4) Enrich
  else if (enrichmentStaged && enrichFinalized) {
    bucket = 'enrich';
    label = enrichmentStatus === 'no_data' ? 'No Data' : enrichmentStatus === 'skipped' ? 'Skipped' : 'Enriched';
    detail = `Enrichment: ${enrichmentStatus || 'completed'}`;
  }
  // 5) Validated (eligible) or awaiting validation (if staged)
  else if (validationStaged && !isSocial) {
    bucket = 'validated';
    if (validationEligibleFinal) {
      label = 'Valid';
      detail = `Validation: ${validation}${provider ? ` (${provider})` : ''}`;
    } else if (validation) {
      label = 'Validated';
      detail = `Validation: ${validation}${provider ? ` (${provider})` : ''}`;
    } else {
      label = 'Pending';
      detail = 'Awaiting validation';
    }
  }
  // Defaults when stages not staged / social
  else if (enrichmentStaged && !enrichFinalized) {
    bucket = 'enrich';
    label = 'Pending';
    detail = enrichmentStatus ? `Enrichment: ${enrichmentStatus}` : 'Awaiting enrichment';
  } else if (personalizeStaged && !personalizedDone) {
    bucket = 'personalize';
    label = 'Pending';
    detail = personalizationStatus ? `Personalization: ${personalizationStatus}` : 'Awaiting personalization';
  } else if (isSocial) {
    bucket = 'validated';
    label = searchStatus || interactStatus ? 'Processing' : 'Pending';
    detail = searchKeys || (searchStatus ? `Search: ${searchStatus}` : interactStatus ? `Interaction: ${interactStatus}` : 'Queued for interaction');
  } else {
    bucket = 'validated';
    label = validation ? validation : 'Pending';
    detail = validation ? `Validation: ${validation}` : (execStatus ? `Execution: ${execStatus}` : 'Queued');
  }

  return { bucket, label, identity, secondary, detail, timestamp: ts, sn, url, context };
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

function csvEscape(val: any): string {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const EXCLUDED_EXPORT_HEADERS = new Set([
  'smtp', 'port', 'username', 'password', 'apppassword', 'backupcode',
  'oauth2clientid', 'oauth2clientsecret', 'oauth2refreshtoken',
  'engine', 'provider', 'campaigntype',
  'shouldvalidate', 'shouldenhance', 'shouldsearchinteract', 'shouldpageinteract',
  'shouldinboxinteract', 'shouldactivitiesinteract', 'shouldsendmessage',
  'replyto'
]);

function isExcludedExportHeader(h: string): boolean {
  const n = String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!n) return true;
  if (EXCLUDED_EXPORT_HEADERS.has(n)) return true;
  if (n.startsWith('shooter')) return true;
  // obvious internal empty spacers (blank headers) handled above
  return false;
}

export function CampaignProgressView({ campaign, rows, loading, headers }: CampaignProgressViewProps) {
  const { validationStaged, enrichmentStaged, personalizeStaged, executeStaged } = getStaged(campaign);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  const progressRows = useMemo(
    () => rows.map(r => ({ row: r, progress: classifyRow(r, campaign) })),
    [rows, campaign]
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: progressRows.length, execute: 0, personalize: 0, enrich: 0, validated: 0, failed: 0 };
    for (const p of progressRows) c[p.progress.bucket]++;
    return c;
  }, [progressRows]);

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ key: TabKey; label: string }> = [{ key: 'all', label: 'All' }];
    if (executeStaged) tabs.push({ key: 'execute', label: 'Execute' });
    if (personalizeStaged) tabs.push({ key: 'personalize', label: 'Personalize' });
    if (enrichmentStaged) tabs.push({ key: 'enrich', label: 'Enrich' });
    if (validationStaged) tabs.push({ key: 'validated', label: 'Validated' });
    tabs.push({ key: 'failed', label: 'Failed' });
    return tabs;
  }, [executeStaged, personalizeStaged, enrichmentStaged, validationStaged]);

  const effectiveTab: TabKey = visibleTabs.some(t => t.key === activeTab) ? activeTab : 'all';

  const filtered = useMemo(() => {
    let list = progressRows;
    if (effectiveTab !== 'all') list = list.filter(p => p.progress.bucket === effectiveTab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.progress.identity.toLowerCase().includes(q) ||
        p.progress.secondary.toLowerCase().includes(q) ||
        p.progress.detail.toLowerCase().includes(q)
      );
    }
    return list;
  }, [progressRows, effectiveTab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const executed = counts.execute;
  const total = progressRows.length;
  const pct = total > 0 ? Math.round((executed / total) * 100) : 0;

  const exportHeaders = useMemo(() => {
    const base = (headers && headers.length ? headers : Array.from(new Set(rows.flatMap(r => Object.keys(r || {})))));
    return base.filter(h => !isExcludedExportHeader(h));
  }, [headers, rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    const lines = [exportHeaders.map(csvEscape).join(',')];
    for (const item of filtered) {
      lines.push(exportHeaders.map(h => csvEscape(item.row[h])).join(','));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeCampaign = String((campaign as any).id || (campaign as any).campaignId || 'campaign').replace(/[^a-zA-Z0-9_-]+/g, '-');
    const tabLabel = visibleTabs.find(t => t.key === effectiveTab)?.label || effectiveTab;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `${safeCampaign}_${tabLabel}_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const summaryBuckets = (['execute', 'personalize', 'enrich', 'validated', 'failed'] as StageBucket[])
    .filter(b => (b === 'failed') || (b === 'execute' ? executeStaged : b === 'personalize' ? personalizeStaged : b === 'enrich' ? enrichmentStaged : validationStaged));

  return (
    <div>
      {/* Summary strip */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</p>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {executed.toLocaleString()} / {total.toLocaleString()} executed ({pct}%)
            </span>
          </div>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={filtered.length ? `Export ${filtered.length} row(s) from ${visibleTabs.find(t => t.key === effectiveTab)?.label || 'current'} tab` : 'No rows to export'}
          >
            <FontAwesomeIcon icon={faDownload} className="w-3 h-3" />
            Export CSV ({visibleTabs.find(t => t.key === effectiveTab)?.label || 'Tab'}) · {filtered.length.toLocaleString()}
          </button>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          {summaryBuckets.map(b => {
            const meta = BUCKET_META[b];
            return (
              <div key={b} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-700 ${meta.badge}`}>
                <FontAwesomeIcon icon={meta.icon} className={`w-3.5 h-3.5 ${meta.text}`} />
                <span className="text-xs font-semibold">{meta.label}</span>
                <span className="text-sm font-bold">{counts[b].toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter + search */}
      <div className="p-4 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {visibleTabs.map(tab => {
            const active = effectiveTab === tab.key;
            const chip = tab.key === 'all'
              ? { active: 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900', idle: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' }
              : { active: BUCKET_META[tab.key as StageBucket].chipActive, idle: BUCKET_META[tab.key as StageBucket].chipIdle };
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={`px-2.5 py-1 text-xxs font-semibold rounded-full transition-colors ${active ? chip.active : chip.idle}`}
              >
                {tab.label} <span className="opacity-70">({counts[tab.key].toLocaleString()})</span>
              </button>
            );
          })}
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
            {rows.length ? 'No contacts match the current filter.' : 'No CSV file uploaded for this campaign.'}
          </p>
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {paginated.map((item, i) => {
              const p = item.progress;
              const meta = BUCKET_META[p.bucket];
              return (
                <li
                  key={`${safePage}-${i}`}
                  className={`flex items-center gap-3 px-4 py-3 border-l-4 ${meta.border} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}
                  title={p.detail}
                >
                  <div className={`w-9 h-9 rounded-full ${meta.avatar} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {initials(p.identity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold dark:text-white truncate">{p.identity}</span>
                      {p.sn && <span className="text-xxs text-gray-400 font-mono shrink-0">#{p.sn}</span>}
                    </div>
                    {p.secondary && (
                      <p className="text-xxs text-gray-500 dark:text-gray-400 truncate">{p.secondary}</p>
                    )}
                    <p className="text-xxs text-gray-400 dark:text-gray-500 truncate">{p.detail}</p>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xxs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate block max-w-full"
                        title={p.url}
                      >
                        {p.url.replace(/^https?:\/\//, '').slice(0, 50)}
                      </a>
                    )}
                    {p.context && (
                      <p className="text-xxs text-gray-400 dark:text-gray-500 truncate italic" title={p.context}>
                        {p.context.slice(0, 80)}{p.context.length > 80 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xxs font-semibold rounded-full ${meta.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {p.label || meta.label}
                    </span>
                    {p.timestamp && (
                      <span className="text-xxs text-gray-400 dark:text-gray-500">{formatTime(p.timestamp)}</span>
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
              onClick={() => setPage(pg => Math.max(1, pg - 1))}
              disabled={safePage === 1}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
            </button>
            <span className="text-xxs text-gray-600 dark:text-gray-300">{safePage} / {totalPages}</span>
            <button
              onClick={() => setPage(pg => Math.min(totalPages, pg + 1))}
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
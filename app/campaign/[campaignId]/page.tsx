"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faSync,
  faCheckCircle,
  faSpinner,
  faTimesCircle,
  faClock,
  faEnvelope,
  faRobot,
  faSearch,
  faChevronLeft,
  faChevronRight,
  faEdit,
  faPause,
  faPlay,
  faShieldAlt,
  faMagic,
  faRocket,
  faComments
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../../context/AppContext';
import { securedApi } from '../../../utils/auth';
import { isFeatureEnabled, featureDisabledMessage } from '../../../utils/featureFlags';
import { toast } from 'sonner';
import type { Campaign } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CampaignProgressView } from '../../components/admin/campaign/CampaignProgressView';

interface CSVRow {
  [key: string]: string;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.campaignId as string;
  const { appData } = useAppState();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'progress' | 'table'>('progress');
  const rowsPerPage = 50;
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // CSV data refresh runs via /api/drive-csv (Next.js -> Drive API, no AppScript),
  // so it can poll fast during an active run without touching the AppScript quota.
  const getRefreshInterval = (status?: string) =>
    status === 'running' || status === 'Limit Reached' ? 20000 : 60000;

  // Find campaign from appData or fetch directly
  const findCampaign = useCallback(() => {
    const raw = appData?.data?.campaigns;
    if (!raw) return null;
    const headers: string[] = raw.headers || [];
    const data: any[] = raw.data || [];
    const idIdx = headers.indexOf('campaignId');
    if (idIdx === -1) return null;
    const row: any[] | undefined = data.find((r: any) => r[idIdx] === campaignId);
    if (!row) return null;
    const settingsIdx = headers.indexOf('settings');
    const statusIdx = headers.indexOf('status');
    const typeIdx = headers.indexOf('type');
    const fileUrlIdx = headers.indexOf('fileUrl');
    const createdOnIdx = headers.indexOf('createdOn');
    const updatedOnIdx = headers.indexOf('updatedOn');
    const contextIdx = headers.indexOf('context');
    const statsIdx = headers.indexOf('stats');

    let settingsObj: any = {};
    try { if (row[settingsIdx]) settingsObj = JSON.parse(row[settingsIdx]); } catch {}

    let contextObj: any = {};
    try { if (row[contextIdx]) contextObj = JSON.parse(row[contextIdx]); } catch {}

    let statsObj: any = {};
    try { if (row[statsIdx]) statsObj = JSON.parse(row[statsIdx]); } catch {}

    return {
      id: row[idIdx] || campaignId,
      name: settingsObj.name || row[idIdx] || '',
      channel: settingsObj.channel || 'email',
      type: row[typeIdx] || 'general',
      subject: settingsObj.subject || '',
      body: settingsObj.body || '',
      projectId: settingsObj.projectId || '',
      accounts: settingsObj.accounts || [],
      smtpSettings: settingsObj.smtpSettings || [],
      fileUrl: row[fileUrlIdx] || settingsObj.fileUrl || '',
      deliveryMethod: settingsObj.deliveryMethod || 'smtp',
      validationStaged: settingsObj.validationStaged || false,
      validationStatus: settingsObj.validationStatus || 'idle',
      enrichmentStaged: settingsObj.enrichmentStaged || false,
      enrichmentStatus: settingsObj.enrichmentStatus || 'idle',
      aiPersonalizationStaged: settingsObj.aiPersonalizationStaged || false,
      aiPersonalizationPrompt: settingsObj.aiPersonalizationPrompt || '',
      personalizationStatus: settingsObj.personalizationStatus || 'idle',
      executeStaged: settingsObj.executeStaged ?? true,
      interactionStaged: settingsObj.interactionStaged || false,
      interactionStatus: settingsObj.interactionStatus || 'idle',
      interactionStopAfterHours: settingsObj.interactionStopAfterHours || 72,
      interactionMaxReplies: settingsObj.interactionMaxReplies || 100,
      interactionAccounts: settingsObj.interactionAccounts || [],
      firestickEnabled: settingsObj.firestickEnabled || false,
      linkType: settingsObj.linkType || 'project',
      linkId: settingsObj.linkId || '',
      socialInteractionTypes: settingsObj.socialInteractionTypes || [],
      socialStrategyPrompt: settingsObj.socialStrategyPrompt || '',
      socialKeywords: settingsObj.socialKeywords || [],
      shouldSendMessage: settingsObj.shouldSendMessage || false,
      template: settingsObj.template || '',
      templateId: settingsObj.templateId || '',
      templateContent: settingsObj.templateContent || '',
      isSetupComplete: settingsObj.isSetupComplete ||
        !!(settingsObj.validationStaged || settingsObj.enrichmentStaged ||
           settingsObj.aiPersonalizationStaged || settingsObj.executeStaged || settingsObj.interactionStaged) || false,
      created_at: row[createdOnIdx] || '',
      status: row[statusIdx] || 'draft',
      analytics: {
        totalRows: statsObj.interactions || 0,
        sent: statsObj.interactions || 0,
        delivered: statsObj.inbox || 0,
        failed: (statsObj.interactions || 0) - (statsObj.inbox || 0)
      }
    } as Campaign;
  }, [appData, campaignId]);

  // Fetch CSV via local API route (no CORS)
  const fetchCSV = useCallback(async (url: string, forceNetwork = false, refreshInterval = 60000) => {
    if (!url) return;

    const cacheKey = `campaign_csv_${campaignId}`;

    // Try cache first
    if (!forceNetwork) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 60000) {
            setCsvHeaders(parsed.headers);
            setCsvData(parsed.rows);
            return;
          }
        }
      } catch {}
    }

    setCsvLoading(true);
    try {
      const fileId = url.match(/[-\w]{25,}/)?.[0];
      if (!fileId) throw new Error('Could not extract file ID from URL');
      const res = await fetch(`/api/drive-csv?fileId=${fileId}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch CSV');
      const text = json.data;

      const lines = text.split('\n').filter((l: string) => l.trim());
      if (lines.length === 0) return;
      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map((line: string) => {
        const vals = line.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
        const row: CSVRow = {};
        headers.forEach((h: string, i: number) => { row[h] = vals[i] || ''; });
        return row;
      });
      setCsvHeaders(headers);
      setCsvData(rows);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ headers, rows, timestamp: Date.now() }));
      } catch {}

      // Schedule next refresh
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => fetchCSV(url, true, refreshInterval), refreshInterval);
    } catch (err) {
      console.error('Failed to fetch CSV:', err);
    } finally {
      setCsvLoading(false);
    }
  }, [campaignId]);

  // Poll campaign status every 60s
  const pollCampaign = useCallback(async () => {
    try {
      const res = await securedApi.callBackendFunction({
        functionName: 'getCampaign',
        campaignId
      });
      if (res.success && res.data) {
        if (res.data.status && campaign?.status !== res.data.status) {
          setCampaign(prev => prev ? { ...prev, status: res.data.status } : prev);
        }
      }
    } catch {
      // Poll failed — silent
    }
  }, [campaignId, campaign?.status]);

  const handlePauseCampaign = async () => {
    try {
      const res = await securedApi.callBackendFunction({
        functionName: 'pauseCampaign',
        campaignId
      });
      if (res.success) {
        setCampaign(prev => prev ? { ...prev, status: 'paused' } : prev);
        router.refresh();
      }
    } catch {
      // silent
    }
  };

  const handleResumeCampaign = async () => {
    if (!isFeatureEnabled(appData, 'allowShooting')) {
      alert(featureDisabledMessage('allowShooting', 'campaign resumption'));
      return;
    }
    try {
      const res = await securedApi.callBackendFunction({
        functionName: 'resumeCampaign',
        campaignId
      });
      if (res.success) {
        setCampaign(prev => prev ? { ...prev, status: 'running' } : prev);
        router.refresh();
      }
    } catch {
      // silent
    }
  };

  const handleExecutePipeline = async () => {
    if (!isFeatureEnabled(appData, 'allowShooting')) {
      alert(featureDisabledMessage('allowShooting', 'campaign execution'));
      return;
    }
    try {
      const res = await fetch('/campaign/pipeline-orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Pipeline Started', { description: 'Campaign execution has begun.' });
        setCampaign(prev => prev ? { ...prev, status: 'running' } : prev);
      } else {
        toast.error('Failed to start pipeline', { description: data.message });
      }
    } catch {
      toast.error('Failed to start pipeline');
    }
  };

  useEffect(() => {
    const camp = findCampaign();
    if (camp) {
      setCampaign(camp);
      if (camp.fileUrl) fetchCSV(camp.fileUrl, false, getRefreshInterval(camp.status));
    }
    setLoading(false);
  }, [findCampaign, fetchCSV]);

  // Auto-poll every 60s for status + cleanup refresh timeout on unmount
  useEffect(() => {
    if (!campaign || campaign.status === 'completed' || campaign.status === 'draft') return;
    const interval = setInterval(pollCampaign, 60000);
    return () => {
      clearInterval(interval);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [campaign, pollCampaign]);

  // Filter and paginate CSV data
  const filteredData = searchQuery
    ? csvData.filter(row =>
        Object.values(row).some(v =>
          v.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : csvData;

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (loading) {
    return (
      <div className="p-6 dark:bg-gray-900 dark:text-gray-100 min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
        <div className="text-center py-20">
          <h2 className="text-xl font-bold dark:text-white">Campaign Not Found</h2>
          <p className="text-gray-500 mt-2">Campaign &quot;{campaignId}&quot; was not found.</p>
          <Link href="/campaign" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            Back to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  const statusColor = (s: string) => {
    switch(s) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'paused': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Limit Reached': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="p-6 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/campaign" className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-xl font-bold dark:text-white">{campaign.name || campaign.id}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{campaign.id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Draft + setup incomplete: Continue Setup */}
          {campaign.status === 'draft' && !campaign.isSetupComplete && (
            <button
              onClick={() => router.push(`/campaign?edit=${campaign.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
              Continue Setup
            </button>
          )}
          {/* Draft + setup complete: Edit Settings */}
          {campaign.status === 'draft' && campaign.isSetupComplete && (
            <button
              onClick={() => router.push(`/campaign?edit=${campaign.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
              Edit Settings
            </button>
          )}
          {/* Draft + setup complete: Execute Pipeline */}
          {campaign.status === 'draft' && campaign.isSetupComplete && (
            <button
              onClick={handleExecutePipeline}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={faRocket} className="w-3 h-3" />
              Execute Pipeline
            </button>
          )}
          {/* Running or Limit Reached: Pause */}
          {(campaign.status === 'running' || campaign.status === 'Limit Reached') && (
            <button
              onClick={handlePauseCampaign}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={faPause} className="w-3 h-3" />
              Pause
            </button>
          )}
          {/* Paused: Resume */}
          {campaign.status === 'paused' && (
            <button
              onClick={handleResumeCampaign}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <FontAwesomeIcon icon={faPlay} className="w-3 h-3" />
              Resume
            </button>
          )}
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusColor(campaign.status)}`}>
            {campaign.status}
          </span>
          <button
            onClick={() => { if (campaign.fileUrl) fetchCSV(campaign.fileUrl, true, getRefreshInterval(campaign.status)); }}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Refresh Data"
          >
            <FontAwesomeIcon icon={faSync} className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">Channel</p>
          <p className="text-sm font-semibold mt-1 dark:text-white capitalize">
            <FontAwesomeIcon icon={campaign.channel === 'email' ? faEnvelope : faRobot} className="mr-1.5 text-blue-500" />
            {campaign.channel}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">Delivery</p>
          <p className="text-sm font-semibold mt-1 dark:text-white capitalize">{campaign.deliveryMethod || 'N/A'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">CSV Contacts</p>
          <p className="text-sm font-semibold mt-1 dark:text-white">{csvData.length.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">Progress</p>
          <p className="text-sm font-semibold mt-1 dark:text-white">
            {campaign.analytics?.sent || 0} sent / {campaign.analytics?.delivered || 0} delivered
          </p>
        </div>
      </div>

      {/* Unified Pipeline View */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pipeline Stages</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Validation', icon: faShieldAlt, staged: campaign.validationStaged, status: campaign.validationStatus, field: 'validationStaged' as const },
            { label: 'Enrichment', icon: faSearch, staged: campaign.enrichmentStaged, status: campaign.enrichmentStatus, field: 'enrichmentStaged' as const },
            { label: 'AI Personalization', icon: faMagic, staged: campaign.aiPersonalizationStaged, status: campaign.personalizationStatus, field: 'aiPersonalizationStaged' as const },
            { label: 'Execute', icon: faRocket, staged: campaign.executeStaged ?? true, status: campaign.status === 'running' ? 'processing' : campaign.status === 'completed' ? 'completed' : 'idle', field: 'executeStaged' as const },
            { label: 'Interaction', icon: faComments, staged: campaign.interactionStaged, status: campaign.interactionStatus || 'idle', field: 'interactionStaged' as const },
          ].map(item => {
            const statusIcon = item.status === 'completed' ? faCheckCircle
              : item.status === 'processing' ? faSpinner
              : item.status === 'failed' ? faTimesCircle
              : faClock;
            const statusColor = item.status === 'completed' ? 'text-green-500'
              : item.status === 'processing' ? 'text-blue-500'
              : item.status === 'failed' ? 'text-red-500'
              : 'text-gray-400';
            return (
              <div key={item.label} className={`p-3 rounded-lg border dark:border-gray-700 ${item.staged ? 'bg-gray-50 dark:bg-gray-900/40' : 'opacity-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs font-semibold dark:text-gray-300">{item.label}</p>
                  </div>
                  <FontAwesomeIcon icon={statusIcon} className={`w-3.5 h-3.5 ${statusColor} ${item.status === 'processing' ? 'animate-spin' : ''}`} />
                </div>
                <p className="text-xxs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                  {item.staged ? (item.status || 'pending') : 'Not staged'}
                </p>
              </div>
            );
          })}
        </div>
        {campaign.interactionStaged && (
          <div className="mt-3 text-xxs text-purple-500 dark:text-purple-400">
            Interaction limits: {campaign.interactionStopAfterHours || 72}h / {campaign.interactionMaxReplies || 100} replies
          </div>
        )}
      </div>

      {/* CSV Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-bold dark:text-white">
            CSV Contacts Data
            {csvLoading && <FontAwesomeIcon icon={faSpinner} className="ml-2 w-3.5 h-3.5 text-blue-500 animate-spin" />}
          </h3>
          <div className="flex items-center space-x-2">
            <div className="flex items-center rounded-lg overflow-hidden border dark:border-gray-600">
              <button
                onClick={() => setViewMode('progress')}
                className={`px-3 py-1.5 text-xxs font-semibold transition-colors ${viewMode === 'progress' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Progress
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xxs font-semibold transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Raw Data
              </button>
            </div>
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search rows..."
                className="pl-8 pr-3 py-1.5 text-xs border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        {viewMode === 'progress' ? (
          <CampaignProgressView campaign={campaign} rows={csvData} loading={csvLoading} />
        ) : (
          <>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              {csvHeaders.length > 0 ? (
                <table className="min-w-full text-xxs">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 sticky top-0">
                    <tr>
                      {csvHeaders.map((h, idx) => (
                        <th key={idx} className="px-3 py-2 text-left font-bold text-gray-600 dark:text-gray-300 border-b dark:border-gray-700 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row, i) => (
                      <tr key={`${currentPage}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 border-b dark:border-gray-700/50">
                        {csvHeaders.map((h, idx) => (
                          <td key={idx} className="px-3 py-1.5 dark:text-gray-300 whitespace-nowrap max-w-[200px] truncate">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {csvLoading ? 'Loading CSV data...' : campaign.fileUrl ? 'No CSV data loaded.' : 'No CSV file uploaded for this campaign.'}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <p className="text-xxs text-gray-500 dark:text-gray-400">
                  Showing {(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} rows
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                  </button>
                  <span className="text-xxs text-gray-600 dark:text-gray-300">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

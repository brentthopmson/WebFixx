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
  faComments,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../../context/AppContext';
import { securedApi, authApi } from '../../../utils/auth';
import { isFeatureEnabled, featureDisabledMessage, getConcurrentCampaignState } from '../../../utils/featureFlags';
import { getQuotaInfo } from '../../../utils/helpers';
import { QuotaInfoBadge } from '../../components/QuotaInfo';
import { toast } from 'sonner';
import { parseCSV } from '../../utils/csvNormalizer';
import type { Campaign } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CampaignProgressView } from '../../components/admin/campaign/CampaignProgressView';
import ConfirmationModal from '../../components/ConfirmationModal';

interface CSVRow {
  [key: string]: string;
}

// Human-readable explanation for a paused/resting campaign, built from the
// reason/detail fields the engine persists. Keeps the raw verbose errors out of
// the main view while still explaining WHY the campaign stopped.
function statusReasonText(c: Campaign): string {
  const engine = (c.lastEngineError || '').trim();
  const detail = (c.restDetail || '').trim();
  const reason = (c.restReason || c.pauseReason || '').trim();
  if (engine) {
    if (/no eligible engine server|not routing to unrelated/i.test(engine)) {
      return 'Resume failed: no eligible engine server for this campaign category/platform. Start the engine and retry the resume.';
    }
    return `Engine error: ${engine.slice(0, 160)}`;
  }
  if (reason === 'limit_reached') {
    if (detail) return `Quota reached — sending rests until the limit window resets. ${detail.slice(0, 160)}`;
    return 'Sending quota reached — the campaign will auto-resume when the limit window resets.';
  }
  if (reason === 'retry_pending') return 'Some rows are awaiting retry; resume to continue them.';
  if (reason === 'paused_by_admin') return 'Paused manually.';
  if (reason) return reason;
  if (detail) return detail.slice(0, 160);
  return '';
}

const PLATFORM_ACTION_LABELS: Array<{ key: string; label: string }> = [
  { key: 'likesOnPost', label: 'Post Likes' },
  { key: 'commentOnPost', label: 'Post Comments' },
  { key: 'likesOnComment', label: 'Comment Likes' },
  { key: 'commentOnComment', label: 'Comment Replies' },
  { key: 'follow', label: 'Follows' },
  { key: 'unfollow', label: 'Unfollows' },
  { key: 'repostOnPost', label: 'Post Reposts' },
  { key: 'repostOnComment', label: 'Comment Reposts' },
  { key: 'likeOnStory', label: 'Story Likes' },
  { key: 'commentOnStory', label: 'Story Comments' },
  { key: 'repostOnStory', label: 'Story Reposts' },
  { key: 'coldMessage', label: 'Direct Messages' },
  { key: 'inboxReply', label: 'Inbox Replies' },
  { key: 'emailSent', label: 'Emails Sent' },
];

// Map a campaigns-sheet row (object keyed by header name) to the Campaign UI
// shape. Shared by the appData lookup (findCampaign) and the direct
// getCampaign fallback used when the appData bundle is stale.
function campaignFromRowObject(row: Record<string, any>, fallbackId: string): Campaign {
  let settingsObj: any = {};
  try {
    if (typeof row.settings === 'string' && row.settings.trim()) settingsObj = JSON.parse(row.settings);
    else if (row.settings && typeof row.settings === 'object') settingsObj = row.settings;
  } catch {}

  let contextObj: any = {};
  try {
    if (typeof row.context === 'string' && row.context.trim()) contextObj = JSON.parse(row.context);
    else if (row.context && typeof row.context === 'object') contextObj = row.context;
  } catch {}

  let statsObj: any = {};
  try {
    if (typeof row.stats === 'string' && row.stats.trim()) statsObj = JSON.parse(row.stats);
    else if (row.stats && typeof row.stats === 'object') statsObj = row.stats;
  } catch {}

  const durationDays = settingsObj.durationDays || 7;
  const createdRaw = row.createdOn || row.created_at || '';
  const createdTime = createdRaw ? new Date(createdRaw).getTime() : 0;
  const isRowExpired = createdTime > 0 && Date.now() >= createdTime + durationDays * 86400000;
  const rawStatus = row.status || 'draft';
  const resolvedStatus = isRowExpired && rawStatus !== 'draft' ? 'completed' : rawStatus;

  const resolvedFileUrl = row.fileUrl || settingsObj.fileUrl || '';
  const resolvedChannel = settingsObj.channel || 'email';
  const resolvedMode = settingsObj.campaignMode || (resolvedFileUrl ? 'file' : 'interactions-only');

  const postStatusObj = settingsObj.postStatus || {};
  const engagedPostCount = Object.values(postStatusObj).reduce(
    (sum: number, acctMap: any) => sum + (acctMap && typeof acctMap === 'object' ? Object.keys(acctMap).length : 0),
    0
  );
  const totalActions =
    Number(statsObj.totalActions) ||
    Number(statsObj.interactions) ||
    engagedPostCount ||
    Number(settingsObj.analytics?.sent) ||
    0;

  return {
    id: row.campaignId || fallbackId,
    name: settingsObj.name || row.campaignId || '',
    channel: resolvedChannel,
    platform: settingsObj.platform || '',
    type: row.type || settingsObj.type || 'general',
    subject: settingsObj.subject || '',
    body: settingsObj.body || '',
    projectId: settingsObj.projectId || '',
    accounts: settingsObj.accounts || [],
    smtpSettings: settingsObj.smtpSettings || [],
    fileUrl: resolvedFileUrl,
    deliveryMethod: settingsObj.deliveryMethod || 'smtp',
    validationStaged: settingsObj.validationStaged || false,
    validationStatus: settingsObj.validationStatus || 'idle',
    enrichmentStaged: settingsObj.enrichmentStaged || false,
    enrichmentStatus: settingsObj.enrichmentStatus || 'idle',
    aiPersonalizationStaged: settingsObj.aiPersonalizationStaged || false,
    aiPersonalizationPrompt: settingsObj.aiPersonalizationPrompt || '',
    personalizationStatus: settingsObj.personalizationStatus || 'idle',
    executeStaged: resolvedChannel === 'social'
      ? !!(settingsObj.shouldSendMessage && resolvedFileUrl)
      : (resolvedMode === 'interactions-only' ? false : (settingsObj.executeStaged ?? true)),
    executionStatus: settingsObj.executionStatus || '',
    interactionStaged: resolvedChannel === 'social'
      ? true
      : (settingsObj.interactionStaged || resolvedMode === 'interactions-only' || false),
    interactionStatus: settingsObj.interactionStatus || 'idle',
    interactionStopAfterHours: settingsObj.interactionStopAfterHours || 72,
    interactionAccounts: settingsObj.interactionAccounts || [],
    firestickEnabled: settingsObj.firestickEnabled || false,
    linkType: settingsObj.linkType || 'project',
    linkId: settingsObj.linkId || '',
    socialInteractionTypes: settingsObj.socialInteractionTypes || [],
    socialStrategyPrompt: settingsObj.socialStrategyPrompt || '',
    socialKeywords: settingsObj.socialKeywords || [],
    tagStatus: settingsObj.tagStatus || {},
    postStatus: postStatusObj,
    shouldSendMessage: settingsObj.shouldSendMessage || false,
    requireAiForComments: !!(settingsObj.requireAiForComments ?? contextObj.requireAiForComments),
    targetedComments: !!(settingsObj.targetedComments ?? contextObj.targetedComments),
    campaignMode: resolvedMode,
    targetLink: settingsObj.targetLink || '',
    personalizeLink: !!settingsObj.personalizeLink,
    linkParam: settingsObj.linkParam || 'email',
    helperKeyword: settingsObj.helperKeyword || '',
    interactionTargetLink: settingsObj.interactionTargetLink || '',
    linkAfterTurns: settingsObj.linkAfterTurns ?? 2,
    emailKeywords: settingsObj.emailKeywords || [],
    emailStrategyPrompt: settingsObj.emailStrategyPrompt || '',
    sendMode: settingsObj.sendMode || 'now',
    scheduleStartTime: settingsObj.scheduleStartTime || '',
    campaignKeyword: settingsObj.campaignKeyword || '',
    replyFilterInstalled: settingsObj.replyFilterInstalled === true || settingsObj.replyFilterInstalled === "true",
    replyFilterKeyword: settingsObj.replyFilterKeyword || '',
    replyFilterAt: settingsObj.replyFilterAt || '',
    template: settingsObj.template || '',
    templateId: settingsObj.templateId || '',
    templateContent: settingsObj.templateContent || '',
    durationDays,
    restUntil: settingsObj.restUntil || null,
    restReason: settingsObj.restReason || null,
    restDetail: settingsObj.restDetail || null,
    pauseReason: settingsObj.pauseReason || null,
    lastEngineError: settingsObj.lastEngineError || null,
    isSetupComplete: settingsObj.isSetupComplete ||
      !!(settingsObj.validationStaged || settingsObj.enrichmentStaged ||
         settingsObj.aiPersonalizationStaged || settingsObj.executeStaged || settingsObj.interactionStaged) || false,
    created_at: createdRaw,
    status: resolvedStatus,
    stats: statsObj,
    analytics: {
      totalRows: Number(settingsObj.analytics?.totalRows) || totalActions,
      sent: totalActions,
      delivered: statsObj.inbox || Number(settingsObj.analytics?.delivered) || 0,
      failed: Number(settingsObj.analytics?.failed) || 0
    }
  } as Campaign;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params?.campaignId as string;
  const { appData, setAppData } = useAppState();
  // Per-user concurrent campaign guardrail (from the user's PLAN, per engine/GAS).
  // Exclude this campaign so a running/paused campaign holding the last slot can
  // still show its own Resume/Retry controls (mirrors the engine's exclude-self).
  const concurrentState = getConcurrentCampaignState(appData, campaignId);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [isStartingPipeline, setIsStartingPipeline] = useState(false);
  // Stay in "pausing" until the ENGINE has actually persisted status=paused in
  // the sheet (mirrors isStartingPipeline). Cleared only by pollCampaign().
  const [isPausing, setIsPausing] = useState(false);
  // Immediate click feedback for Pause/Resume/Retry: set synchronously as
  // the FIRST statement of each handler (before any await) so the button
  // spins + disables the instant it is clicked, not after the request.
  const [actingAction, setActingAction] = useState<'resume' | 'pause' | 'retry' | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvLoading, setCsvLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'progress' | 'table'>('progress');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const rowsPerPage = 50;
  const seededCampaignIdRef = useRef<string | null>(null);

  // CSV data refresh runs via /api/drive-csv (Next.js -> Drive API, no AppScript),
  // so it can poll fast during an active run without touching the AppScript quota.
  const getRefreshInterval = (status?: string) => {
    const s = String(status || '').toLowerCase();
    // Fast cadence for any state where rows/stages are actively changing.
    if (['running', 'processing', 'staged', 'resting', 'paused', 'limit reached'].includes(s)) return 15000;
    return 60000;
  };

  // Find campaign from appData (may be stale — callers fall back to getCampaign)
  const findCampaign = useCallback(() => {
    const raw = appData?.data?.campaigns;
    if (!raw) return null;
    const headers: string[] = raw.headers || [];
    const data: any[] = raw.data || [];
    const idIdx = headers.indexOf('campaignId');
    if (idIdx === -1) return null;
    const row: any[] | undefined = data.find((r: any) => r[idIdx] === campaignId);
    if (!row) return null;
    const rowObj: Record<string, any> = {};
    headers.forEach((h, i) => { rowObj[h] = row[i]; });
    return campaignFromRowObject(rowObj, campaignId);
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

      // Use a quote-aware CSV parser: personalized email bodies contain commas
      // and newlines inside quoted fields. A naive split('\n')/split(',') turned
      // each body line into a fake "row" (54 real rows -> 246) and scattered
      // values into the wrong columns.
      const parsed = parseCSV(text);
      if (parsed.length === 0) return;
      const headers = parsed[0].map((h: string) => String(h || '').trim().replace(/^"|"$/g, ''));
      const rows = parsed.slice(1)
        .filter((vals: string[]) => vals.some((v: string) => String(v || '').trim()))
        .map((vals: string[]) => {
          const row: CSVRow = {};
          headers.forEach((h: string, i: number) => { row[h] = String(vals[i] ?? '').trim(); });
          return row;
        });
      setCsvHeaders(headers);
      setCsvData(rows);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ headers, rows, timestamp: Date.now() }));
      } catch {}
      // NOTE: refresh scheduling lives in its own effect keyed on primitive
      // values (see below). Do NOT self-schedule here — a setTimeout handle
      // housed in this component gets cleared whenever the campaign object
      // changes, and status polling creates a new object every cycle.
    } catch (err) {
      console.error('Failed to fetch CSV:', err);
    } finally {
      setCsvLoading(false);
    }
  }, [campaignId]);

  // Poll campaign status — updates all pipeline stage fields, stats, and auto-advances
  const pollCampaign = useCallback(async () => {
    try {
      const res = await securedApi.callBackendFunction({
        functionName: 'getCampaign',
        campaignId
      });
      if (res.success && res.data) {
        const d = res.data as any;
        const mapped = campaignFromRowObject(d, campaignId);
        setCampaign(mapped);
        if (mapped.status === 'running') setIsStartingPipeline(false);
        // Only the engine's persisted sheet state confirms a real pause.
        if (mapped.status === 'paused') setIsPausing(false);
        if (d.engineStopped) {
          toast.error('Engine Stopped Responding', {
            description: d.engineError || 'The engine server stopped responding — this campaign was automatically paused.'
          });
        }

        const createdTime = mapped.created_at ? new Date(mapped.created_at).getTime() : 0;
        const isExpiredNow = createdTime > 0 && Date.now() >= createdTime + (mapped.durationDays || 7) * 86400000;
        if (isExpiredNow) {
          return;
        }

        // NO client-side stage auto-trigger here. The engine self-advances when a
        // stage completes, and a stale/cached poll used to fire a duplicate
        // runCampaignPipeline mid-run (whose GAS dispatch failure reverted the
        // row to 'paused' at 00:16:47). Polling is read-only.
      }
    } catch {
      // Poll failed — silent
    }
  }, [campaignId]);

  // Manual refresh: force-refresh app-level data, the campaign row, and the
  // CSV in one go, with visible feedback (the button spins while in flight).
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const fileUrl = campaign?.fileUrl || '';
    try {
      await Promise.allSettled([
        authApi.updateAppData(setAppData, true),
        pollCampaign(),
        fileUrl ? fetchCSV(fileUrl, true) : Promise.resolve(),
      ]);
      toast.success('Data refreshed');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, setAppData, pollCampaign, fetchCSV, campaign?.fileUrl]);

  const handlePauseCampaign = async () => {
    if (actingAction || isPausing) return;
    setActingAction('pause');
    setIsPausing(true); // spinner + "Pausing…" — mirrors the starting flow
    // Optimistic badge flip for instant feedback; the REAL confirmation comes
    // from pollCampaign() reading status=paused from the sheet.
    setCampaign(prev => prev ? { ...prev, status: 'paused' } : prev);
    toast.info('Pausing campaign…', { description: 'Waiting for the engine to stop at the current checkpoint.' });
    let confirmed = false;
    try {
      const res: any = await securedApi.callBackendFunction({
        functionName: 'pauseCampaign',
        campaignId
      });
      if (res.success || /already paused/i.test(String(res.error || ''))) {
        // Poll immediately and a few times so the "paused" sheet state (written
        // by GAS) is picked up quickly; isPausing clears only on a real confirm.
        for (let i = 0; i < 8; i++) {
          await pollCampaign();
          // pollCampaign() calls setIsPausing(false) once it sees status=paused.
          // Re-check the sheet via a fresh getCampaign to avoid a stale cache.
          const live: any = await securedApi.callBackendFunction({ functionName: 'getCampaign', campaignId }).catch(() => null);
          if (String(live?.data?.status || '').toLowerCase() === 'paused') {
            setIsPausing(false);
            confirmed = true;
            break;
          }
          await new Promise(r => setTimeout(r, 1500));
        }
        if (confirmed) {
          toast.success('Campaign Paused', {
            description: 'Engine has stopped at the current checkpoint. Resume anytime to continue.'
          });
          router.refresh();
        } else {
          // Safety: don't leave the UI stuck; let the next poll reconcile.
          setIsPausing(false);
          toast.error('Pause not yet confirmed', {
            description: 'The pause request was sent but the engine has not confirmed a stopped state yet. Check the status badge.'
          });
        }
      } else {
        setIsPausing(false);
        toast.error(res.error || 'Failed to pause campaign');
        pollCampaign();
      }
    } catch (err: any) {
      setIsPausing(false);
      toast.error(err?.message || 'Failed to pause campaign');
      pollCampaign();
    } finally {
      setActingAction(null);
    }
  };

  const handleResumeCampaign = async () => {
    if (actingAction) return;
    if (!isFeatureEnabled(appData, 'allowShooting')) {
      alert(featureDisabledMessage('allowShooting', 'campaign resumption'));
      return;
    }
    // Immediate feedback: spinner + disabled + optimistic status flip,
    // set synchronously BEFORE the (slow) backend call.
    setActingAction('resume');
    setCampaign(prev => prev ? { ...prev, status: 'running' } : prev);
    try {
      const res: any = await securedApi.callBackendFunction({
        functionName: 'resumeCampaign',
        campaignId
      });
      if (res.success) {
        toast.success('Campaign Resumed', {
          description: res.message || 'Campaign resumed and is running again.'
        });
        setCampaign(prev => prev ? { ...prev, status: 'running' } : prev);
        pollCampaign();
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to resume campaign');
        pollCampaign();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resume campaign');
      pollCampaign();
    } finally {
      setActingAction(null);
    }
  };

  // ==================== Staged-aware monthly quota ====================
  // Social campaigns spend interactionUsage (+ senderUsage if DMs enabled),
  // never shootCampaignUsage ("Campaign sends" is email-only) — mirrors
  // CampaignModal's channel-aware quota keys.
  const stagedQuotaKeys: string[] = [];
  if (campaign?.channel === 'social') {
    stagedQuotaKeys.push('interactionUsage');
    if (campaign?.shouldSendMessage) stagedQuotaKeys.push('senderUsage');
  } else {
    if (campaign?.validationStaged) stagedQuotaKeys.push('validateUsage');
    if (campaign?.enrichmentStaged) stagedQuotaKeys.push('enrichUsage');
    if (campaign?.aiPersonalizationStaged) stagedQuotaKeys.push('personalizeUsage');
    if (campaign?.executeStaged ?? true) stagedQuotaKeys.push('shootCampaignUsage');
    if (campaign?.interactionStaged) stagedQuotaKeys.push('interactionUsage');
  }
  const exhaustedStagedQuotas = stagedQuotaKeys
    .map(k => getQuotaInfo(appData, k))
    .filter((q): q is NonNullable<typeof q> => !!q && q.exhausted);
  const exhaustedQuotaMessage = exhaustedStagedQuotas.length
    ? `Monthly limit reached for: ${exhaustedStagedQuotas.map(q => q.label).join(', ')}. Upgrade your plan to continue.`
    : '';

  const handleExecutePipeline = async () => {
    if (!isFeatureEnabled(appData, 'allowShooting')) {
      alert(featureDisabledMessage('allowShooting', 'campaign execution'));
      setShowExecuteConfirm(false);
      return;
    }
    // Block if ANY staged step's monthly quota is exhausted (skip backend)
    if (exhaustedQuotaMessage) {
      toast.error('Monthly quota reached', { description: exhaustedQuotaMessage });
      setShowExecuteConfirm(false);
      return;
    }
    // Close modal immediately so the user isn't blocked waiting for the
    // backend (validation can take minutes). Fire-and-forget the request.
    setShowExecuteConfirm(false);
    setIsStartingPipeline(true);
    toast.info('Starting pipeline...', { description: 'Campaign execution has begun.' });

    securedApi.callBackendFunction({
      functionName: 'runCampaignPipeline',
      campaignId
    }).then((data: any) => {
      if (data?.success) {
        toast.success('Pipeline Started', { description: data.message || 'Campaign execution has begun.' });
        setCampaign(prev => prev ? {
          ...prev,
          status: 'running',
          ...(prev.validationStaged ? { validationStatus: 'processing' } : {}),
          ...(prev.enrichmentStaged ? { enrichmentStatus: 'processing' } : {}),
          ...(prev.aiPersonalizationStaged ? { personalizationStatus: 'processing' } : {}),
          ...(prev.interactionStaged ? { interactionStatus: 'processing' } : {}),
        } : prev);
        pollCampaign();
        // If the backend getCampaign response is still cached as 'draft' a few
        // seconds after a successful start, bypass the appData cache entirely
        // and re-read the sheet so the running badge/pause button appear.
        setTimeout(async () => {
          try {
            const live = await securedApi.callBackendFunction({ functionName: 'getCampaign', campaignId });
            const liveStatus = String((live as any)?.data?.status || '').toLowerCase();
            if (liveStatus === 'draft' || !liveStatus) {
              await authApi.updateAppData(setAppData, true);
              pollCampaign();
            }
          } catch { /* keep the optimistic running state */ }
        }, 5000);
      } else {
        toast.error(data?.message || data?.error || 'Failed to start pipeline', {
          description: data?.error || data?.message
        });
        setIsStartingPipeline(false);
      }
    }).catch((err: any) => {
      toast.error(err?.message || 'Failed to start pipeline');
      setIsStartingPipeline(false);
    });

    // Keep isStartingPipeline true until pollCampaign flips status to running
    setTimeout(() => setIsStartingPipeline(false), 30000);
  };

  useEffect(() => {
    // Only seed from appData once per campaignId so subsequent setAppData
    // updates from fast-path backend calls never overwrite live polled state.
    if (seededCampaignIdRef.current === campaignId) return;
    let cancelled = false;
    const camp = findCampaign();
    if (camp) {
      seededCampaignIdRef.current = campaignId;
      setCampaign(camp);
      if (camp.fileUrl) fetchCSV(camp.fileUrl, false, getRefreshInterval(camp.status));
      setLoading(false);
      // Immediately verify live status + engine liveness via GAS getCampaign
      pollCampaign();
      return;
    }
    // appData bundle is stale or missing this campaign — fetch the row directly
    // so the detail page never shows "Not Found" for a campaign that exists.
    (async () => {
      try {
        const res = await securedApi.callBackendFunction({
          functionName: 'getCampaign',
          campaignId
        });
        if (!cancelled && res.success && res.data) {
          seededCampaignIdRef.current = campaignId;
          const direct = campaignFromRowObject(res.data, campaignId);
          setCampaign(direct);
          if (direct.fileUrl) fetchCSV(direct.fileUrl, false, getRefreshInterval(direct.status));
        }
      } catch {
        // fall through to the Not Found state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [findCampaign, fetchCSV, pollCampaign, campaignId]);

  // Auto-poll for status + cleanup refresh timeout on unmount.
  // 15s while a run is active, 30s while in error/retry, 60s otherwise.
  // A row can briefly read 'draft' while a stage is actually processing (e.g. a
  // stale save); stage statuses are the authoritative signal, so never stop
  // polling just because the row status lagged behind.
  useEffect(() => {
    if (!campaign) return;
    const s = String(campaign.status || '').toLowerCase();
    const stageStates = [
      campaign.validationStatus, campaign.enrichmentStatus, campaign.personalizationStatus,
      campaign.executionStatus, campaign.interactionStatus,
    ].map(v => String(v || '').toLowerCase());
    const stageActive = stageStates.some(v =>
      ['processing', 'resting', 'retry', 'running', 'waiting_quota', 'staged'].includes(v)
    );
    const rowActive = ['running', 'processing', 'staged', 'resting', 'paused', 'limit reached'].includes(s);
    const createdMs = campaign.created_at ? new Date(campaign.created_at).getTime() : 0;
    const expired = createdMs > 0 && Date.now() >= createdMs + (campaign.durationDays || 7) * 86400000;
    if (expired) {
      // One-time call to getCampaign ensures GAS checkAndCompleteExpiredCampaign marks the sheet row 'completed'
      if (s !== 'completed' && s !== 'draft') {
        securedApi.callBackendFunction({ functionName: 'getCampaign', campaignId }).catch(() => {});
      }
      return;
    }
    // 'draft' is NOT terminal for polling: appData is seeded once and can be
    // stale while the engine has already moved the sheet to running/paused.
    if (s === 'completed') return;
    // Poll fast while a pause is being confirmed so the UI updates promptly.
    const intervalMs = isPausing ? 2000 : (rowActive || stageActive || s === 'draft') ? 15000 : (s === 'error' ? 30000 : 60000);
    const interval = setInterval(pollCampaign, intervalMs);
    return () => clearInterval(interval);
  }, [campaign, pollCampaign, campaignId, isPausing]);

  // Dedicated CSV refresh: driven by a primitive fileUrl + cadence, NOT by the
  // campaign object. pollCampaign() replaces the campaign object every cycle,
  // so any effect depending on `campaign` tears down its timer before the CSV
  // refresh fires — which is why the table went stale until a manual reload.
  const csvFileUrl = campaign?.fileUrl || '';
  const csvRefreshMs = getRefreshInterval(campaign?.status);
  useEffect(() => {
    if (!csvFileUrl) return;
    fetchCSV(csvFileUrl, true, csvRefreshMs);
    const t = setInterval(() => fetchCSV(csvFileUrl, true, csvRefreshMs), csvRefreshMs);
    return () => clearInterval(t);
  }, [csvFileUrl, csvRefreshMs, fetchCSV]);

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
      case 'resting': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Limit Reached': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const durationDays = campaign.durationDays || 7;
  const createdDate = campaign.created_at ? new Date(campaign.created_at) : null;
  const endDate = createdDate ? new Date(createdDate.getTime() + durationDays * 86400000) : null;
  const nowMs = Date.now();
  // Duration only guards interactions. List shoots (fileUrl) never expire
  // on duration — they run to list completion (progress priority below).
  const durationGuardsInteractions = campaign.channel === 'social' || !campaign.fileUrl;
  const isCampaignExpired = durationGuardsInteractions && endDate ? nowMs >= endDate.getTime() : false;
  const effectiveStatus = isCampaignExpired && campaign.status !== 'draft' ? 'completed' : campaign.status;

  // Progress priority: LIST > INTERACTION > DURATION.
  // - List present: sent/total rows (email analytics or tag progress).
  // - List complete + interaction running: interaction window (time-based).
  // - No list: interaction window (time-based) as before.
  const listTotal = Number((campaign as any).analytics?.totalRows) || 0;
  const listSent = Number((campaign as any).analytics?.sent) || 0;
  const listDone = campaign.channel === 'email'
    ? (listTotal > 0 && listSent >= listTotal)
    : (campaign as any).listCompleted === true;
  const hasList = !!campaign.fileUrl;
  const interactionOn = campaign.channel === 'social'
    ? (campaign.socialInteractionTypes || []).length > 0
    : !!campaign.interactionStaged;
  const progressMode: 'list' | 'interaction' | 'duration' = !hasList
    ? (interactionOn ? 'interaction' : 'duration')
    : (listDone && interactionOn ? 'interaction' : 'list');
  // Once the user pauses, a leftover restUntil must not keep the UI looking
  // "resting" — a paused campaign is actionable (Resume), not resting.
  const isResting = !isCampaignExpired && effectiveStatus !== 'paused'
    && (effectiveStatus === 'resting' || (campaign.restUntil && nowMs < Number(campaign.restUntil)));

  // Resolve connected accounts and their platform usage — STRICTLY from this
  // campaign row's stats column (campaign-scoped). Never read the hub's
  // interactionUsage: that is the account-wide quota shared across every
  // campaign and must not appear here.
  //
  // Identity (display name ONLY) falls back to the hub when the stored
  // identifier is missing or is the raw account key itself (legacy rows
  // seeded before handle resolution existed): socials[0].username →
  // email → username, matched by submissionId OR browserId. Usage numbers
  // never come from the hub.
  const hubIdentityById = (() => {
    const rawHub = (appData as any)?.data?.hub;
    if (!rawHub?.headers || !Array.isArray(rawHub?.data)) {
      return new Map<string, { identifier: string }>();
    }
    const h: string[] = rawHub.headers;
    const subIdx = h.indexOf('submissionId');
    const bidIdx = h.indexOf('browserId');
    const emailIdx = h.indexOf('email');
    const usernameIdx = h.indexOf('username');
    const socialsIdx = h.indexOf('socials');
    const map = new Map<string, { identifier: string }>();
    for (const row of rawHub.data as any[]) {
      let handle = '';
      if (socialsIdx !== -1 && row[socialsIdx]) {
        try {
          const parsed = typeof row[socialsIdx] === 'string' ? JSON.parse(row[socialsIdx]) : row[socialsIdx];
          if (Array.isArray(parsed) && parsed[0]?.username) handle = String(parsed[0].username).trim();
        } catch { /* malformed socials JSON — skip handle */ }
      }
      const identifier = handle
        || (emailIdx !== -1 ? String(row[emailIdx] || '').trim() : '')
        || (usernameIdx !== -1 ? String(row[usernameIdx] || '').trim() : '');
      if (!identifier) continue;
      const entry = { identifier };
      if (subIdx !== -1) { const k = String(row[subIdx] || '').trim(); if (k) map.set(k, entry); }
      if (bidIdx !== -1) { const k = String(row[bidIdx] || '').trim(); if (k) map.set(k, entry); }
    }
    return map;
  })();

  const connectedAccountsUsage = (() => {
    const statsAccounts = campaign.stats?.accounts || {};
    const allIds = Array.from(
      new Set([
        ...(campaign.accounts || []),
        ...(campaign.interactionAccounts || []),
        ...Object.keys(statsAccounts),
        ...Object.keys(campaign.postStatus || {}),
      ].map(id => String(id || '').trim()).filter(Boolean))
    );

    return allIds.map(accountId => {
      const statEntry = statsAccounts[accountId] || {};

      const rawUsage = statEntry.usage || {};
      const usageMap: Record<string, { hourly: number; daily: number; monthly: number; total: number }> = {};
      let computedTotal = 0;
      for (const [k, v] of Object.entries(rawUsage || {})) {
        if (k.startsWith('_') || !v || typeof v !== 'object') continue;
        const t = Number((v as any).total) || 0;
        const d = Number((v as any).daily) || 0;
        const h = Number((v as any).hourly) || 0;
        const m = Number((v as any).monthly) || 0;
        usageMap[k] = { hourly: h, daily: d, monthly: m, total: t };
        computedTotal += t;
      }

      const engagedPosts = Object.keys((campaign.postStatus || {})[accountId] || {}).length;
      const total = Number(statEntry.total) || computedTotal || engagedPosts || 0;

      const storedIdentifier =
        statEntry.identifier && statEntry.identifier !== accountId ? String(statEntry.identifier) : '';
      const identifier = storedIdentifier || hubIdentityById.get(accountId)?.identifier || accountId;

      return {
        accountId,
        identifier,
        platform: statEntry.platform || campaign.platform || campaign.channel || 'account',
        total,
        engagedPosts,
        usage: usageMap,
      };
    });
  })();

  const totalActionsAcrossAccounts = connectedAccountsUsage.reduce((sum, a) => sum + a.total, 0);
  const engagedPostsTotal = connectedAccountsUsage.reduce((sum, a) => sum + a.engagedPosts, 0);
  const displayTotalActions =
    Number((campaign.stats as any)?.totalActions) ||
    totalActionsAcrossAccounts ||
    engagedPostsTotal ||
    Number(campaign.analytics?.sent) ||
    0;

  // Execute gate: Execute Pipeline is disabled (with a reason) until the
  // campaign actually satisfies its execution requirements — same checks
  // the modal enforces on save, evaluated live on the detail page.
  const executeBlockers: string[] = [];
  if (campaign.channel === 'social') {
    if (!(campaign.accounts || []).length) executeBlockers.push('Add at least one social profile');
    if (!campaign.fileUrl && !(campaign.socialKeywords || []).length && !(campaign.socialInteractionTypes || []).length) {
      executeBlockers.push('Add targeting keywords, upload a CSV, or enable an interaction hook');
    }
    if (!campaign.platform) executeBlockers.push('Select the target platform');
  } else {
    if (campaign.campaignMode !== 'interactions-only' && !campaign.fileUrl) executeBlockers.push('Upload a recipients CSV');
    if (!campaign.subject) executeBlockers.push('Add an email subject line');
    if (!campaign.body) executeBlockers.push('Add an email body');
    const method = campaign.deliveryMethod || 'smtp';
    if (method === 'smtp' && !(campaign.smtpSettings || []).length) executeBlockers.push('Add at least one SMTP server');
    if (method !== 'smtp' && !(campaign.accounts || []).length) executeBlockers.push('Select at least one MAIL account');
    if (method === 'mixed' && !(campaign.smtpSettings || []).length) executeBlockers.push('Add at least one SMTP server (mixed mode)');
    if (campaign.interactionStaged) {
      if (!(campaign.emailKeywords || []).length) executeBlockers.push('Add at least one inbox watch keyword');
      if (!String(campaign.emailStrategyPrompt || '').trim()) executeBlockers.push('Add an AI reply strategy prompt');
      if (!(campaign.interactionAccounts || []).length) executeBlockers.push('Select at least one interaction account');
    }
  }
  if (exhaustedStagedQuotas.length > 0) executeBlockers.push(exhaustedQuotaMessage);
  const canExecute = executeBlockers.length === 0;

  return (
    <div className="p-6 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/campaign" className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-xl font-bold dark:text-white flex items-center gap-2">
              {campaign.name || campaign.id}
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${campaign.channel === 'social' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                {campaign.channel === 'social' ? 'SOCIAL' : 'EMAIL'}
              </span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{campaign.id} · {campaign.channel === 'social' ? 'Social campaign' : 'Email campaign'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* Action buttons are strictly hidden once the campaign duration has elapsed or status is completed */}
          {!isCampaignExpired && effectiveStatus !== 'completed' && (
            <>
              {/* Edit Setup — available for any active campaign (completed/expired hidden by wrapper above) */}
              <button
                onClick={() => router.push(`/campaign?edit=${campaign.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                title="Edit campaign setup — changes take effect on the next engine cycle"
              >
                <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
                {campaign.isSetupComplete ? 'Edit Setup' : 'Continue Setup'}
              </button>
              {/* Draft + setup complete: Execute Pipeline (hidden at concurrent limit) */}
              {(effectiveStatus === 'draft' || isStartingPipeline) && campaign.isSetupComplete && (effectiveStatus as any) !== 'error' && (effectiveStatus as any) !== 'failed' && !concurrentState.atLimit && (
                <button
                  onClick={() => setShowExecuteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canExecute || isStartingPipeline}
                  title={!canExecute ? `Missing requirements: ${executeBlockers.join('; ')}` : undefined}
                >
                  <FontAwesomeIcon icon={isStartingPipeline ? faSpinner : faRocket} spin={isStartingPipeline} className="w-3 h-3" />
                  {isStartingPipeline ? 'Starting…' : 'Execute Pipeline'}
                </button>
              )}
              {/* Error/Failed: Retry (hidden at concurrent limit) */}
              {(effectiveStatus === 'error' || effectiveStatus === 'failed') && !concurrentState.atLimit && (
                <button
                  onClick={async () => {
                    if (actingAction) return;
                    setActingAction('retry');
                    try {
                      await securedApi.callBackendFunction({ functionName: 'runCampaignPipeline', campaignId, retry: true });
                      toast.success('Retry triggered');
                      pollCampaign();
                    } catch (e:any) {
                      toast.error(e?.message || 'Failed to retry');
                    } finally {
                      setActingAction(null);
                    }
                  }}
                  disabled={actingAction === 'retry'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon icon={actingAction === 'retry' ? faSpinner : faPlay} spin={actingAction === 'retry'} className="w-3 h-3" />
                  {actingAction === 'retry' ? 'Retrying…' : 'Retry'}
                </button>
              )}
              {/* Running / Limit Reached / Resting: Pause. A resting campaign can
                  be paused by the user — that stops the GAS auto-resume so the
                  next checker pass won't restart it. Keep visible while confirming
                  so the spinner stays until the pause is persisted. */}
              {((effectiveStatus === 'running' || effectiveStatus === 'Limit Reached' || effectiveStatus === 'resting' || isResting || isPausing)) && (effectiveStatus as any) !== 'error' && (effectiveStatus as any) !== 'failed' && (
                <button
                  onClick={handlePauseCampaign}
                  disabled={actingAction === 'pause' || isPausing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon icon={isPausing || actingAction === 'pause' ? faSpinner : faPause} spin={isPausing || actingAction === 'pause'} className="w-3 h-3" />
                  {isPausing || actingAction === 'pause' ? 'Pausing…' : 'Pause'}
                </button>
              )}
              {/* Paused: Resume (hidden at concurrent limit) */}
              {effectiveStatus === 'paused' && !isPausing && (effectiveStatus as any) !== 'error' && (effectiveStatus as any) !== 'failed' && !concurrentState.atLimit && (
                <button
                  onClick={handleResumeCampaign}
                  disabled={actingAction === 'resume'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon icon={actingAction === 'resume' ? faSpinner : faPlay} spin={actingAction === 'resume'} className="w-3 h-3" />
                  {actingAction === 'resume' ? 'Resuming…' : 'Resume'}
                </button>
              )}
            </>
          )}
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusColor(isCampaignExpired && effectiveStatus === 'draft' ? 'completed' : effectiveStatus)}`}>
            {isCampaignExpired && effectiveStatus === 'draft' ? 'Expired' : effectiveStatus}
          </span>
          {campaign.replyFilterInstalled && (
            <span
              className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
              title={`Reply filter installed${campaign.replyFilterKeyword ? ` · keyword: ${campaign.replyFilterKeyword}` : ''}${campaign.replyFilterAt ? ` · ${campaign.replyFilterAt}` : ''}`}
            >
              Reply filter active
            </span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Refresh Data"
          >
            <FontAwesomeIcon icon={faSync} spin={isRefreshing} className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Why the campaign paused/rested — surfaced from engine settings. */}
      {(() => {
        const informative = effectiveStatus === 'paused' || effectiveStatus === 'resting' || isResting;
        if (!informative) return null;
        const reason = statusReasonText(campaign);
        if (!reason) return null;
        return (
          <div className={`mb-5 flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
            campaign.lastEngineError
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
          }`}>
            <FontAwesomeIcon icon={faExclamationTriangle} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold">Status: {effectiveStatus}. </span>
              <span>{reason}</span>
              {campaign.lastEngineError && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer font-semibold underline hover:no-underline">Full error details</summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] max-h-40 overflow-auto">{campaign.lastEngineError}</pre>
                </details>
              )}
            </div>
          </div>
        );
      })()}

      {/* Monthly quota pills — own row BELOW the header (never share the
          title row: it crushes the title and action buttons). */}
      {stagedQuotaKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          <span className="text-xxs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">Monthly usage:</span>
          {stagedQuotaKeys.map(k => (
            <QuotaInfoBadge key={k} appData={appData} usageKey={k} compact />
          ))}
        </div>
      )}

      {concurrentState.atLimit && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-400">
          <FontAwesomeIcon icon={faExclamationTriangle} className="w-3.5 h-3.5 shrink-0" />
          Concurrent campaign limit — {concurrentState.current} of {concurrentState.limit} slots in use. Execute/Retry/Resume are hidden until a slot frees up.
        </div>
      )}

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
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">{campaign.channel === 'social' ? 'Mode' : 'Delivery'}</p>
          <p className="text-sm font-semibold mt-1 dark:text-white capitalize">
            {campaign.channel === 'social'
              ? `${campaign.platform || 'social'} · ${(campaign.socialInteractionTypes || []).length > 0 ? 'engagement' : 'read-only'}`
              : campaign.deliveryMethod || 'N/A'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">
            {campaign.channel === 'social'
              ? (campaign.fileUrl || csvData.length > 0 ? 'Profile List' : 'Target Keywords')
              : 'CSV Contacts'}
          </p>
          <p className="text-sm font-semibold mt-1 dark:text-white">
            {campaign.channel === 'social' && !campaign.fileUrl && csvData.length === 0
              ? `${(campaign.socialKeywords || []).length} keyword${(campaign.socialKeywords || []).length === 1 ? '' : 's'}`
              : csvData.length.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
          <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">Progress</p>
          <p className="text-sm font-semibold mt-1 dark:text-white">
            {campaign.channel === 'social'
              ? `${displayTotalActions.toLocaleString()} actions performed`
              : `${displayTotalActions.toLocaleString()} sent / ${(campaign.analytics?.delivered || 0).toLocaleString()} delivered`}
          </p>
        </div>
      </div>

      {/* Campaign Duration & Lifecycle Card */}
      {(() => {
        const now = Date.now();
        const elapsedMs = createdDate ? Math.max(0, now - createdDate.getTime()) : 0;
        const totalMs = durationDays * 86400000;
        const elapsedPct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
        const remainingMs = endDate ? endDate.getTime() - now : 0;
        const daysLeft = Math.max(0, Math.ceil(remainingMs / 86400000));
        const restMins = campaign.restUntil ? Math.max(0, Math.ceil((Number(campaign.restUntil) - now) / 60000)) : 0;

        // Progress priority: LIST > INTERACTION > DURATION.
        // List mode shows sent/total rows — duration never limits a list.
        const listPct = listTotal > 0 ? Math.min(100, Math.round((listSent / listTotal) * 100)) : 0;
        const barPct = progressMode === 'list' ? listPct : elapsedPct;
        const barTitle = progressMode === 'list'
          ? `List Progress (${listSent.toLocaleString()} / ${listTotal.toLocaleString()} sent)`
          : progressMode === 'interaction'
            ? `Interaction Window (${durationDays} Days)`
            : `Campaign Lifecycle & Schedule (${durationDays} Days)`;
        const barLeft = progressMode === 'list'
          ? `${listPct}% sent (${listSent.toLocaleString()}/${listTotal.toLocaleString()})`
          : `${elapsedPct}% elapsed`;
        const barRight = progressMode === 'list'
          ? (listPct >= 100 ? 'List complete' : `${(listTotal - listSent).toLocaleString()} remaining`)
          : (remainingMs > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining` : 'Duration reached (completed)');

        return (
          <div className="relative bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 mb-6 overflow-hidden">
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-500 ${
                barPct >= 100
                  ? 'bg-emerald-500/15 dark:bg-emerald-500/20'
                  : 'bg-emerald-500/10 dark:bg-emerald-500/15'
              }`}
              style={{ width: `${barPct}%` }}
            />
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faClock} className={`w-4 h-4 ${barPct >= 100 ? 'text-emerald-500' : 'text-purple-500'}`} />
                  <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider">
                    {barTitle}
                  </h3>
                  {progressMode === 'list' && listDone && interactionOn && (
                    <span className="px-2 py-0.5 text-xxs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full border border-blue-300 dark:border-blue-700">
                      List done — interaction now running
                    </span>
                  )}
                  {isResting && (
                    <span className="px-2 py-0.5 text-xxs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 rounded-full animate-pulse border border-purple-300 dark:border-purple-700">
                      Cooldown Rest · Resumes in {restMins}m
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {createdDate && (
                    <span>
                      Started: <strong className="text-gray-700 dark:text-gray-200">{createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  )}
                  {endDate && progressMode !== 'list' && (
                    <span className="ml-3">
                      Scheduled End: <strong className="text-gray-700 dark:text-gray-200">{endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-gray-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      barPct >= 100
                        ? 'bg-emerald-500'
                        : barPct >= 80
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-emerald-500 to-green-500'
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xxs">
                  <span className={barPct >= 100 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>{barLeft}</span>
                  <span className={barRight === 'List complete' && barPct >= 100 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}>
                    {barRight}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Unified Pipeline View */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pipeline Stages</h3>
        </div>
        {(() => {
          const socialInteractStatus =
            (isCampaignExpired && campaign.status !== 'draft') || effectiveStatus === 'completed'
              ? 'completed'
              : (effectiveStatus === 'running' || isResting)
                ? 'processing'
                : (effectiveStatus === 'failed' || effectiveStatus === 'error')
                  ? 'failed'
                  : (displayTotalActions > 0 ? 'completed' : 'idle');
          const socialHooksLabel = (() => {
            const hooks = campaign.socialInteractionTypes || [];
            const parts: string[] = [];
            if (hooks.includes('search')) parts.push('Search');
            if (hooks.includes('inbox')) parts.push('Inbox');
            if (hooks.includes('other')) parts.push('Profile Page');
            parts.push('Activities');
            return parts.join(' & ');
          })();
          const emailExecuteStatus =
            campaign.executionStatus === 'completed' || effectiveStatus === 'completed' || (isCampaignExpired && campaign.status !== 'draft')
              ? 'completed'
              : effectiveStatus === 'running'
                ? 'processing'
                : (effectiveStatus === 'failed' || effectiveStatus === 'error')
                  ? 'failed'
                  : 'idle';
          const emailInteractStatus =
            (isCampaignExpired && campaign.status !== 'draft') || effectiveStatus === 'completed'
              ? 'completed'
              : (campaign.interactionStatus === 'monitoring' || (effectiveStatus === 'running' && !campaign.executeStaged))
                ? 'processing'
                : (campaign.interactionStatus || 'idle');

          const stageItems = campaign.channel === 'social'
            ? [
                ...(campaign.shouldSendMessage && campaign.fileUrl
                  ? [{ label: 'Execute (Direct Message)', subtitle: 'CSV Profile DMs', icon: faRocket, staged: true, status: socialInteractStatus }]
                  : []),
                { label: 'Interaction', subtitle: socialHooksLabel, icon: faComments, staged: true, status: socialInteractStatus },
              ]
            : [
                { label: 'Validation', subtitle: '', icon: faShieldAlt, staged: campaign.validationStaged, status: campaign.validationStatus },
                { label: 'Enrichment', subtitle: '', icon: faSearch, staged: campaign.enrichmentStaged, status: campaign.enrichmentStatus },
                { label: 'AI Personalization', subtitle: '', icon: faMagic, staged: campaign.aiPersonalizationStaged, status: campaign.personalizationStatus },
                { label: 'Execute', subtitle: '', icon: faRocket, staged: campaign.executeStaged ?? true, status: emailExecuteStatus },
                { label: 'Interaction', subtitle: '', icon: faComments, staged: campaign.interactionStaged, status: emailInteractStatus },
              ];

          return (
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${campaign.channel === 'social' ? 'lg:grid-cols-3' : 'lg:grid-cols-5'}`}>
              {stageItems.map(item => {
                const statusIcon = item.status === 'completed' ? faCheckCircle
                  : item.status === 'processing' ? faSpinner
                  : item.status === 'failed' ? faTimesCircle
                  : faClock;
                const sColor = item.status === 'completed' ? 'text-green-500'
                  : item.status === 'processing' ? 'text-blue-500'
                  : item.status === 'failed' ? 'text-red-500'
                  : 'text-gray-400';
                return (
                  <div key={item.label} className={`p-3 rounded-lg border dark:border-gray-700 ${item.staged ? 'bg-gray-50 dark:bg-gray-900/40' : 'opacity-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <FontAwesomeIcon icon={item.icon} className="w-3.5 h-3.5 text-emerald-500" />
                        <p className="text-xs font-semibold dark:text-gray-200">{item.label}</p>
                      </div>
                      <FontAwesomeIcon icon={statusIcon} className={`w-3.5 h-3.5 ${sColor} ${item.status === 'processing' ? 'animate-spin' : ''}`} />
                    </div>
                    <p className="text-xxs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                      {item.staged
                        ? `${item.subtitle ? `${item.subtitle} · ` : ''}${item.status || 'pending'}`
                        : 'Not staged'}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {campaign.interactionStaged && (
          <div className="mt-3 text-xxs text-purple-500 dark:text-purple-400">
            Interaction window: {campaign.channel === 'social' ? `${durationDays}d campaign schedule` : `${campaign.interactionStopAfterHours || 72}h`}
            {' · '}
            <span className="font-semibold">
              Monthly quota: {(() => {
                const q = getQuotaInfo(appData, 'interactionUsage');
                if (!q) return '—';
                return q.unlimited ? 'unlimited' : `${q.used}/${q.limit} used`;
              })()}
            </span>
          </div>
        )}
      </div>

      {/* Connected Accounts & Platform Usage (from campaigns.stats + platform holder) */}
      {connectedAccountsUsage.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Connected Accounts & Platform Usage ({connectedAccountsUsage.length})
              </h3>
              <p className="text-xxs text-gray-500 dark:text-gray-400 mt-0.5">
                Live per-account action tally recorded in campaign stats across likes, comments, follows, replies, and messages
              </p>
            </div>
            <span className="px-2.5 py-1 text-xxs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Total Actions: {displayTotalActions.toLocaleString()}
            </span>
          </div>
          <div className="space-y-3">
            {connectedAccountsUsage.map(acc => {
              const activeActions = PLATFORM_ACTION_LABELS.filter(a => (acc.usage[a.key]?.total || 0) > 0);
              const displayActions = activeActions.length > 0
                ? activeActions
                : (campaign.channel === 'social'
                    ? PLATFORM_ACTION_LABELS.filter(a => ['likesOnPost', 'commentOnPost', 'likesOnComment', 'commentOnComment', 'follow', 'inboxReply', 'coldMessage'].includes(a.key))
                    : PLATFORM_ACTION_LABELS.filter(a => ['emailSent', 'inboxReply'].includes(a.key)));
              return (
                <div key={acc.accountId} className="p-3.5 rounded-xl border dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FontAwesomeIcon icon={campaign.channel === 'social' ? faRobot : faEnvelope} className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate" title={acc.accountId}>{acc.identifier}</span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {acc.platform}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {acc.engagedPosts > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          {acc.engagedPosts} post{acc.engagedPosts === 1 ? '' : 's'} engaged
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 text-xxs font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                        {acc.total.toLocaleString()} action{acc.total === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {displayActions.map(({ key, label }) => {
                      const entry = acc.usage[key] || { hourly: 0, daily: 0, monthly: 0, total: 0 };
                      const hasCount = entry.total > 0;
                      return (
                        <div
                          key={key}
                          className={`p-2 rounded-lg border text-left transition-colors ${
                            hasCount
                              ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/60'
                              : 'bg-white/60 border-gray-200/70 dark:bg-gray-800/50 dark:border-gray-700/60 opacity-60'
                          }`}
                        >
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate" title={label}>
                            {label}
                          </p>
                          <p className={`text-sm font-bold mt-0.5 ${hasCount ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {entry.total.toLocaleString()}
                          </p>
                          {hasCount && (entry.daily > 0 || entry.hourly > 0) && (
                            <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">
                              1h: {entry.hourly} · 24h: {entry.daily}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CSV Data Table */}
      {(campaign.fileUrl || (csvData && csvData.length > 0) || csvLoading) && (
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-bold dark:text-white">
            {campaign.channel === 'social' ? 'Profile List Data' : 'CSV Contacts Data'}
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
          <CampaignProgressView campaign={campaign} rows={csvData} loading={csvLoading} headers={csvHeaders} />
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
                    {csvLoading ? 'Loading CSV data...' : campaign.fileUrl ? 'No CSV data loaded.' : campaign.channel === 'social' ? 'No profile list uploaded for this campaign (keyword / inbox-driven).' : 'No CSV file uploaded for this campaign.'}
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
      )}

      <ConfirmationModal
        isOpen={showExecuteConfirm}
        onClose={() => setShowExecuteConfirm(false)}
        onConfirm={handleExecutePipeline}
        title="Start Pipeline?"
        message={campaign?.channel === 'social'
          ? 'This will start executing the social campaign pipeline (queue interactions / send DMs via your selected profiles). This action cannot be undone. Continue?'
          : 'This will start executing the campaign pipeline (sending emails / running interactions). This action cannot be undone. Continue?'}
        confirmText="Start Pipeline"
        cancelText="Cancel"
        confirmDisabled={exhaustedStagedQuotas.length > 0}
        confirmLoading={isStartingPipeline}
      >
        <div className="mb-5 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border dark:border-gray-700 space-y-2">
          <p className="text-xxs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monthly quota this run will spend</p>
          {stagedQuotaKeys.map(k => (
            <QuotaInfoBadge key={k} appData={appData} usageKey={k} />
          ))}
          {exhaustedQuotaMessage && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{exhaustedQuotaMessage}</p>
          )}
        </div>
      </ConfirmationModal>
    </div>
  );
}

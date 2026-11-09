"use client";

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'sonner';
import { 
  faPlus,
  faSync,
  faEdit,
  faTrash,
  faClock,
  faEnvelope,
  faRobot,
  faCheckCircle,
  faTimesCircle,
  faSpinner,
  faArrowRight,
  faPause,
  faPlay,
  faComments,
  faRocket,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../context/AppContext';
import { isFeatureEnabled, featureDisabledMessage, getMaxAccountsPerCampaign, getConcurrentCampaignState } from '../../utils/featureFlags';
import { CampaignModal } from '../components/admin/campaign/CampaignModal';
import type { Campaign } from '../types';
import { securedApi, authApi } from '../../utils/auth';
import { getUserLimits } from '../../utils/helpers';
import { QuotaInfoBadge } from '../components/QuotaInfo';
import { validateCampaignCreation, getValidationErrorMessage } from '../utils/campaignValidators';
import LoadingSpinner from '../components/LoadingSpinner';
import TransactionResultModal from '../components/TransactionResultModal';
import ConfirmationModal from '../components/ConfirmationModal';
import UpgradePlanModal from '../components/admin/settings/UpgradePlanModal';

export default function Campaign() {
  const { appData, setAppData } = useAppState();
  // Per-user concurrent campaign guardrail (SETTINGS campaignConcurrentLimit —
  // mirrors engine/GAS). atLimit hides Execute/Resume until a slot frees.
  const concurrentState = getConcurrentCampaignState(appData);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [showPauseConfirmation, setShowPauseConfirmation] = useState(false);
  const [campaignToPause, setCampaignToPause] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAttemptedRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Per-row acting state for resume/pause/delete — spinner lives INSIDE the
  // clicked button only (no full-page overlay, no success modal).
  const [actingId, setActingId] = useState<string | null>(null);

  // Result Modal State
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalProps, setResultModalProps] = useState({
    type: 'success' as 'success' | 'error' | 'warning',
    title: '',
    message: '',
    details: {}
  });

  const searchParams = useSearchParams();
  const router = useRouter();
  const editCampaignId = searchParams.get('edit');

  // Auto-open CampaignModal in edit mode when ?edit=campaignId is present
  useEffect(() => {
    if (!editCampaignId || campaigns.length === 0) return;
    const target = campaigns.find(c => c.id === editCampaignId);
    if (target) {
      setEditingCampaign(target);
      setShowCampaignModal(true);
    }
  }, [editCampaignId, campaigns]);

  const userLimits = getUserLimits(appData);

  // Campaign Data Transformation Function based on sheet headers
  const transformCampaignData = (rawData: any, headers?: string[]) => {
    const safeHeaders = headers || [
      'sn', 'createdOn', 'campaignId', 'userId', 'type', 
      'fileUrl', 'settings', 'context', 'status', 'stats', 'updatedOn'
    ];

    const processedData = Array.isArray(rawData) ? rawData : rawData.data || [];

    const columnIndices = {
      sn: safeHeaders.indexOf('sn'),
      createdOn: safeHeaders.indexOf('createdOn'),
      campaignId: safeHeaders.indexOf('campaignId'),
      userId: safeHeaders.indexOf('userId'),
      type: safeHeaders.indexOf('type'),
      fileUrl: safeHeaders.indexOf('fileUrl'),
      settings: safeHeaders.indexOf('settings'),
      context: safeHeaders.indexOf('context'),
      status: safeHeaders.indexOf('status'),
      stats: safeHeaders.indexOf('stats'),
      updatedOn: safeHeaders.indexOf('updatedOn')
    };

    const parseErrors: string[] = [];
    const result = processedData.map((row: any) => {
      let settingsObj: any = { accounts: [], subject: '', body: '', smtpSettings: [], fileUrl: '' };
      let contextObj = { strategy: '', identities: [] };
      let statsObj = { interactions: 0, conversions: 0, inbox: 0 };

      try {
        const rawSettings = row[columnIndices.settings];
        if (typeof rawSettings === 'string' && rawSettings.trim()) {
          settingsObj = JSON.parse(rawSettings);
          if (typeof settingsObj !== 'object' || settingsObj === null || Array.isArray(settingsObj)) {
            settingsObj = { _parseError: 'Settings parsed to non-object' };
          }
        } else if (rawSettings && typeof rawSettings === 'object') {
          settingsObj = rawSettings;
        }
      } catch(e) {
        const msg = `Settings parse error: ${e instanceof Error ? e.message : 'unknown error'}`;
        console.error(msg, e);
        settingsObj = { _parseError: msg };
        parseErrors.push(msg);
      }

      try {
        const rawContext = row[columnIndices.context];
        if (typeof rawContext === 'string' && rawContext.trim()) {
          contextObj = JSON.parse(rawContext);
          if (typeof contextObj !== 'object' || contextObj === null || Array.isArray(contextObj)) {
            contextObj = { strategy: '', identities: [], _parseError: 'Context parsed to non-object' } as any;
          }
        } else if (rawContext && typeof rawContext === 'object') {
          contextObj = rawContext;
        }
      } catch(e) {
        const msg = `Context parse error: ${e instanceof Error ? e.message : 'unknown error'}`;
        console.error(msg, e);
        contextObj = { strategy: '', identities: [], _parseError: msg } as any;
        parseErrors.push(msg);
      }

      try {
        const rawStats = row[columnIndices.stats];
        if (typeof rawStats === 'string' && rawStats.trim()) {
          statsObj = JSON.parse(rawStats);
          if (typeof statsObj !== 'object' || statsObj === null || Array.isArray(statsObj)) {
            statsObj = { interactions: 0, conversions: 0, inbox: 0, _parseError: 'Stats parsed to non-object' } as any;
          }
        } else if (rawStats && typeof rawStats === 'object') {
          statsObj = rawStats;
        }
      } catch(e) {
        const msg = `Stats parse error: ${e instanceof Error ? e.message : 'unknown error'}`;
        console.error(msg, e);
        statsObj = { interactions: 0, conversions: 0, inbox: 0, _parseError: msg } as any;
        parseErrors.push(msg);
      }

      const totalSent = Number((statsObj as any).totalActions) || statsObj.interactions || Number(settingsObj.analytics?.sent) || 0;
      const limitVal = userLimits?.shootCampaignLimit || 0;
      const durationDaysVal = settingsObj.durationDays || 7;
      const createdRaw = row[columnIndices.createdOn] || '';
      const createdTime = createdRaw ? new Date(createdRaw).getTime() : 0;
      const isRowExpired = createdTime > 0 && (Date.now() >= createdTime + durationDaysVal * 86400000);

      // Dynamically pause/flag if limit reached, or complete if timeframe elapsed
      let resolvedStatus = row[columnIndices.status] || 'draft';
      if (isRowExpired && resolvedStatus !== 'draft') {
        resolvedStatus = 'completed';
      } else if (limitVal > 0 && totalSent >= limitVal && resolvedStatus !== 'completed' && resolvedStatus !== 'draft') {
        resolvedStatus = 'Limit Reached';
      }

      const resolvedFileUrl = (columnIndices.fileUrl !== -1 ? row[columnIndices.fileUrl] : '') || settingsObj.fileUrl || '';
      const resolvedChannel = settingsObj.channel || 'email';
      const resolvedMode = settingsObj.campaignMode || (resolvedFileUrl ? 'file' : 'interactions-only');

      return {
        id: row[columnIndices.campaignId] || '',
        name: settingsObj.name || row[columnIndices.campaignId] || '',
        channel: resolvedChannel,
        platform: settingsObj.platform || '',
        type: row[columnIndices.type] || settingsObj.type || 'general',
        subject: settingsObj.subject || '',
        body: settingsObj.body || '',
        replyFolder: settingsObj.replyFolder || '',
        accounts: settingsObj.accounts || [],
        smtpSettings: settingsObj.smtpSettings || [],
        fileUrl: resolvedFileUrl,

        template: settingsObj.template || '',
        templateId: settingsObj.templateId || '',
        templateContent: settingsObj.templateContent || '',

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
        deliveryMethod: settingsObj.deliveryMethod || 'smtp',
        
        linkType: settingsObj.linkType || 'project',
        linkId: settingsObj.linkId || '',
        
        socialInteractionTypes: settingsObj.socialInteractionTypes || [],
        socialStrategyPrompt: settingsObj.socialStrategyPrompt || '',
        socialKeywords: settingsObj.socialKeywords || [],
        tagStatus: settingsObj.tagStatus || {},
        postStatus: settingsObj.postStatus || {},
        shouldSendMessage: settingsObj.shouldSendMessage || false,
        campaignMode: resolvedMode,
        durationDays: durationDaysVal,
        restUntil: settingsObj.restUntil || null,
        isSetupComplete: settingsObj.isSetupComplete ||
          !!(settingsObj.validationStaged || settingsObj.enrichmentStaged ||
             settingsObj.aiPersonalizationStaged || settingsObj.executeStaged || settingsObj.interactionStaged) || false,
        
        context: contextObj,
        status: resolvedStatus,
        stats: statsObj as any,
        analytics: {
          totalRows: Number(settingsObj.analytics?.totalRows) || totalSent,
          sent: totalSent,
          delivered: statsObj.inbox || Number(settingsObj.analytics?.delivered) || 0,
          failed: Number(settingsObj.analytics?.failed) || 0
        },
        created_at: createdRaw,
        updated_at: row[columnIndices.updatedOn] || ''
      } as Campaign;
    });
    if (parseErrors.length) {
      console.warn('[Campaigns][DIAG] transformCampaignData parseErrors:', parseErrors);
    }
    // Newest first — createdOn is an ISO timestamp (fallback: updatedOn).
    result.sort((a: any, b: any) =>
      String(b.created_at || '').localeCompare(String(a.created_at || '')) ||
      String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
    );
    return result;
  };

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        const rawData = appData?.data?.campaigns?.data || [];
        const rawHeaders = appData?.data?.campaigns?.headers || [];
        // [DIAG] campaign list debugging
        // silent
        if (rawData.length === 0 && appData?.data && !refreshAttemptedRef.current) {
          refreshAttemptedRef.current = true;
          try {
            await authApi.updateAppData(setAppData);
            return;
          } catch (e) {
            // ignore
          }
        }
        if (rawData.length > 0) {
          refreshAttemptedRef.current = false;
        }
        const transformed = transformCampaignData(rawData, rawHeaders);
        // silent
        setCampaigns(transformed);
      } catch (error) {
        console.error('[Campaigns][DIAG] Error transforming campaign data:', error);
        setCampaigns([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, [appData]);

  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      // force=true: manual refresh must bypass both the 30s client cache and
      // the 120s Flask cache so the latest sheet state is always shown.
      await authApi.updateAppData(setAppData, true);
    } catch (error) {
      console.error('Error refreshing application data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const buildStrategyContext = (campaign: Partial<Campaign>) => JSON.stringify({
    name: campaign.name || '',
    channel: campaign.channel || 'email',
    type: campaign.type || 'general',
    // Carried so updateCampaign's settings merge round-trips them
    projectId: campaign.projectId || '',
    accounts: campaign.accounts || [],
    platform: campaign.platform || '',
    // Derived (approved): engagement on when any interaction type is selected
    engagementMode: (campaign.socialInteractionTypes || []).length > 0,
    subject: campaign.subject || '',
    body: campaign.body || '',
    replyFolder: campaign.replyFolder || '',
    fileUrl: campaign.fileUrl || '',
    smtpSettings: campaign.smtpSettings || [],
    template: campaign.template || '',
    templateId: campaign.templateId || '',
    templateContent: campaign.templateContent || '',
    validationStaged: campaign.validationStaged || false,
    validationStatus: campaign.validationStatus || 'idle',
    enrichmentStaged: campaign.enrichmentStaged || false,
    enrichmentStatus: campaign.enrichmentStatus || 'idle',
    aiPersonalizationStaged: campaign.aiPersonalizationStaged || false,
    aiPersonalizationPrompt: campaign.aiPersonalizationPrompt || '',
    personalizationStatus: campaign.personalizationStatus || 'idle',
    executeStaged: campaign.executeStaged ?? true,
    interactionStaged: campaign.interactionStaged || false,
    interactionStatus: campaign.interactionStatus || 'idle',
    interactionStopAfterHours: campaign.interactionStopAfterHours || 72,
    interactionAccounts: campaign.interactionAccounts || [],
    firestickEnabled: campaign.firestickEnabled || false,
    deliveryMethod: campaign.deliveryMethod || 'smtp',
    linkType: campaign.linkType || 'project',
    linkId: campaign.linkId || '',
    socialInteractionTypes: campaign.socialInteractionTypes || [],
    socialStrategyPrompt: campaign.socialStrategyPrompt || '',
    socialKeywords: campaign.socialKeywords || [],
    shouldSendMessage: campaign.shouldSendMessage || false,
    campaignMode: campaign.campaignMode || (campaign.fileUrl ? 'file' : 'interactions-only'),
    targetLink: campaign.targetLink || '',
    personalizeLink: (campaign as any).personalizeLink || false,
    linkParam: (campaign as any).linkParam || 'email',
    helperKeyword: (campaign as any).helperKeyword || '',
    interactionTargetLink: (campaign as any).interactionTargetLink || '',
    linkAfterTurns: (campaign as any).linkAfterTurns ?? 2,
    durationDays: campaign.durationDays,
    emailKeywords: campaign.emailKeywords || [],
    emailStrategyPrompt: campaign.emailStrategyPrompt || '',
    isSetupComplete: campaign.isSetupComplete || false
  });

  const handleSaveCampaign = async (newCampaign: Partial<Campaign>) => {
    const isUpdate = !!newCampaign.id || !!editingCampaign?.id;
    if (!isUpdate && !isFeatureEnabled(appData, 'allowCampaignCreation')) {
      setResultModalProps({
        type: 'error',
        title: 'Feature Disabled',
        message: featureDisabledMessage('allowCampaignCreation', 'campaign creation'),
        details: {}
      });
      setShowResultModal(true);
      return;
    }
    setIsProcessing(true);
    const campaignId = editingCampaign?.id || newCampaign.id || '';
    let response: any = null;
    try {
      // Validate campaign data before sending to backend
      const maxCampaignAccounts = getMaxAccountsPerCampaign(appData);
      const validationError = validateCampaignCreation(newCampaign, maxCampaignAccounts);
      if (validationError) {
        const errorMessage = getValidationErrorMessage(validationError);
        console.warn('[Campaign] Validation failed:', validationError);
        setResultModalProps({
          type: 'error',
          title: 'Campaign Validation Failed',
          message: errorMessage,
          details: { field: validationError.field }
        });
        setShowResultModal(true);
        setIsProcessing(false);
        return;
      }

      const isUpdateExisting = campaignId.length > 0;
      const strategyContext = buildStrategyContext(newCampaign);
      // silent

      if (isUpdate) {
        response = await securedApi.callBackendFunction({
          functionName: 'updateCampaign',
          campaignId,
          settings: strategyContext,
          status: newCampaign.status || 'draft'
        });
      } else {
        response = await securedApi.callBackendFunction({
          functionName: 'createNewCampaign',
          projectId: newCampaign.projectId || '',
          // Comma-joined: objectToFormData JSON-stringifies arrays and GAS
          // comma-splits, which corrupted accounts into ["[]"] / ['["a"', …].
          accountIds: (newCampaign.accounts || []).join(','),
          status: newCampaign.status || 'draft',
          strategyContext,
          userId: appData?.user?.userId || ''
        });
      }

      // silent

      if (response.success) {
        toast.success(isUpdate ? 'Campaign Updated' : 'Campaign Created', {
          description: isUpdate
            ? 'Your campaign settings have been saved.'
            : 'Your campaign has been successfully created.',
        });
        await authApi.updateAppData(setAppData);
      } else {
        console.error('[Campaign] Backend returned error:', response.error);
        setResultModalProps({
          type: 'error',
          title: isUpdate ? 'Error Updating Campaign' : 'Error Creating Campaign',
          message: response.error || 'An unexpected error occurred.',
          details: { rawResponse: JSON.stringify(response).substring(0, 500) }
        });
        setShowResultModal(true);
      }
    } catch (error: any) {
      console.error('[Campaign] Exception during save:', error);
      setResultModalProps({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to save campaign.',
        details: {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
      setShowCampaignModal(false);
      setEditingCampaign(null);
      const navigateId = isUpdate ? campaignId : response?.data?.campaignId || campaignId;
      if (navigateId) {
        router.push(`/campaign/${navigateId}`);
      }
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    setActingId(campaignId);
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'pauseCampaign',
        campaignId
      });
      if (response.success) {
        // No modal — the card badge flips to paused on the next refresh.
        await authApi.updateAppData(setAppData);
      } else {
        toast.error('Pause failed', { description: response.error || 'Failed to pause campaign.' });
      }
    } catch (error: any) {
      toast.error('Error', { description: error.message || 'An unexpected error occurred.' });
    } finally {
      setActingId(null);
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    if (!isFeatureEnabled(appData, 'allowShooting')) {
      toast.error('Feature Disabled', { description: featureDisabledMessage('allowShooting', 'campaign resumption') });
      return;
    }
    setActingId(campaignId);
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'resumeCampaign',
        campaignId
      });
      if (response.success) {
        // No "Campaign Resumed" modal and no page overlay — the status badge
        // flipping to Running is the feedback.
        await authApi.updateAppData(setAppData);
      } else {
        toast.error('Resume failed', { description: response.error || 'Failed to resume campaign.' });
      }
    } catch (error: any) {
      toast.error('Error', { description: error.message || 'An unexpected error occurred.' });
    } finally {
      setActingId(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    const targetId = campaignToDelete;
    setActingId(targetId);
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'deleteCampaign',
        campaignId: campaignToDelete
      });

      if (response.success) {
        toast.success('Campaign Deleted', { description: 'The campaign has been successfully deleted.' });
        await authApi.updateAppData(setAppData);
      } else {
        toast.error('Error Deleting Campaign', { description: response.error || 'An unexpected error occurred.' });
      }
    } catch (error: any) {
      toast.error('Error', { description: error.message || 'Failed to delete campaign.' });
    } finally {
      setActingId(null);
      setShowDeleteConfirmation(false);
      setCampaignToDelete(null);
    }
  };

  const handleConfirmPause = async () => {
    if (!campaignToPause) return;
    setShowPauseConfirmation(false);
    setCampaignToPause(null);
    await handlePauseCampaign(campaignToPause);
  };

  return (
    <div className="p-4 sm:p-6 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
          <button
            onClick={handleRefreshData}
            className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Refresh Data"
            disabled={refreshing}
          >
            <FontAwesomeIcon icon={faSync} className={`${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button
          onClick={() => {
            setEditingCampaign(null);
            setShowCampaignModal(true);
          }}
          className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">New Campaign</span>
        </button>
      </div>

      {/* Monthly quota strip — the 5 keys Execute Pipeline / create can spend */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-1">Monthly usage:</span>
        {(['shootCampaignUsage', 'validateUsage', 'enrichUsage', 'personalizeUsage', 'interactionUsage'] as const).map((k) => (
          <QuotaInfoBadge key={k} appData={appData} usageKey={k} compact />
        ))}
        {concurrentState.atLimit && (
          <span className="w-full inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
            <FontAwesomeIcon icon={faExclamationTriangle} className="w-3.5 h-3.5 shrink-0" />
            Concurrent campaign limit — {concurrentState.current} of {concurrentState.limit} slots in use. Execute/Resume are hidden until a slot frees up.
          </span>
        )}
      </div>

      {/* [DIAG] Debug panel — visible only with ?debug=1 */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1' && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-400 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-auto max-h-96">
          <div className="font-bold mb-1">[Campaigns Debug] appData.data keys:</div>
          {JSON.stringify(appData?.data ? Object.keys(appData.data) : 'NO appData.data')}
          <div className="font-bold mt-2 mb-1">[Campaigns Debug] appData.data.campaigns (raw):</div>
          {JSON.stringify(appData?.data?.campaigns, null, 2) ?? 'undefined'}
          <div className="font-bold mt-2 mb-1">[Campaigns Debug] campaigns state length:</div>
          {campaigns.length}
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.length === 0 && !loading && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700">
            <FontAwesomeIcon icon={faEnvelope} className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400">No campaigns yet</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create your first campaign to get started.</p>
          </div>
        )}
        {campaigns.map((campaign: Campaign) => {
          const stageIcon = (staged?: boolean, status?: string) => {
            if (!staged) return { icon: faClock, color: 'text-gray-300 dark:text-gray-600' };
            if (status === 'completed') return { icon: faCheckCircle, color: 'text-green-500' };
            if (status === 'processing') return { icon: faSpinner, color: 'text-blue-500' };
            if (status === 'failed') return { icon: faTimesCircle, color: 'text-red-500' };
            return { icon: faClock, color: 'text-gray-400 dark:text-gray-500' };
          };
          const sent = campaign.analytics?.sent || 0;
          const limit = userLimits?.shootCampaignLimit || 0;
          const durationDays = campaign.durationDays || 7;
          const createdDate = campaign.created_at ? new Date(campaign.created_at) : null;
          const created = createdDate ? createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          const endDate = createdDate ? new Date(createdDate.getTime() + durationDays * 86400000) : null;
          const now = Date.now();
          const restRemainingMin = campaign.restUntil ? Math.max(0, Math.ceil((Number(campaign.restUntil) - now) / 60000)) : 0;
          const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now) / 86400000)) : 0;
          const isExpired = endDate ? now >= endDate.getTime() : false;
          const elapsedMs = createdDate ? now - createdDate.getTime() : 0;
          const totalMs = durationDays * 86400000;
          const pct = totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 0;
          const isResting = !isExpired && (campaign.status === 'resting' || (campaign.restUntil && now < Number(campaign.restUntil)));
          const effectiveStatus = isExpired && campaign.status !== 'draft' ? 'completed' : campaign.status;
          const socialInteractStageStatus =
            (isExpired && campaign.status !== 'draft') || effectiveStatus === 'completed'
              ? 'completed'
              : (effectiveStatus === 'running' || isResting)
                ? 'processing'
                : (effectiveStatus === 'failed' || effectiveStatus === 'error')
                  ? 'failed'
                  : (sent > 0 ? 'completed' : 'idle');
          const emailExecuteStageStatus =
            campaign.executionStatus === 'completed' || effectiveStatus === 'completed' || (isExpired && campaign.status !== 'draft')
              ? 'completed'
              : effectiveStatus === 'running'
                ? 'processing'
                : (effectiveStatus === 'failed' || effectiveStatus === 'error')
                  ? 'failed'
                  : 'idle';
          const emailInteractStageStatus =
            (isExpired && campaign.status !== 'draft') || effectiveStatus === 'completed'
              ? 'completed'
              : ((campaign as any).interactionStatus === 'monitoring' || (effectiveStatus === 'running' && !campaign.executeStaged))
                ? 'processing'
                : ((campaign as any).interactionStatus || 'idle');
          return (
          <div key={campaign.id} className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700 animate-fadeIn overflow-hidden">
            {/* Progressive light-green background fill based on campaign lifespan */}
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-500 ${
                pct >= 100
                  ? 'bg-emerald-500/15 dark:bg-emerald-500/20'
                  : 'bg-emerald-500/10 dark:bg-emerald-500/15'
              }`}
              style={{ width: `${pct}%` }}
            />
            <div className="relative z-10">
            {/* Top row: name, ID, status */}
            <div className="p-4 pb-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <FontAwesomeIcon icon={campaign.channel === 'social' ? faRobot : faEnvelope} className={`w-4 h-4 ${campaign.channel === 'social' ? 'text-emerald-500' : 'text-blue-500'}`} />
                  <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{campaign.name || campaign.id}</h3>
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${campaign.channel === 'social' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                    {(campaign.channel || 'email').toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{campaign.id}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xxs text-gray-500 dark:text-gray-400">
                  <span className="capitalize">{campaign.channel}</span>
                  {campaign.channel === 'social' ? (
                    <>
                      {campaign.platform && <span className="capitalize">· {campaign.platform}</span>}
                      <span className="capitalize">
                        · {((): string => {
                          const hooks = campaign.socialInteractionTypes || [];
                          if (hooks.length === 0 && !campaign.shouldSendMessage) return 'read-only';
                          return [...hooks.map(t => t === 'other' ? 'page' : t), ...(campaign.shouldSendMessage ? ['dm'] : [])].join(' / ');
                        })()}
                      </span>
                    </>
                  ) : (
                    campaign.deliveryMethod && <span>· {campaign.deliveryMethod} rotation</span>
                  )}
                  {campaign.type && <span>· {campaign.type.replace(/_/g, ' ')}</span>}
                  {created && (
                    <span title={endDate ? `Ends ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined}>
                      · {created} ({durationDays}d schedule{endDate ? ` → ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''})
                    </span>
                  )}
                </div>
              </div>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${
                effectiveStatus === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                isResting ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-700 animate-pulse' :
                effectiveStatus === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                effectiveStatus === 'paused' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                effectiveStatus === 'Limit Reached' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' :
                effectiveStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                effectiveStatus === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {isResting ? `Resting (${restRemainingMin}m left)` : effectiveStatus === 'running' ? `Running · ${daysRemaining}d left` : (isExpired && effectiveStatus === 'draft' ? 'Expired' : effectiveStatus)}
              </span>
            </div>

            {/* Limit reached banner */}
            {effectiveStatus === 'Limit Reached' && (
              <div className="mx-4 mb-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <FontAwesomeIcon icon={faClock} className="w-3.5 h-3.5 animate-pulse shrink-0" />
                  <span>Plan limit (<strong>{limit}</strong>) reached. <button onClick={() => setShowUpgradeModal(true)} className="font-semibold underline hover:no-underline">Upgrade</button></span>
                </div>
              </div>
            )}

            {/* Failed banner */}
            {effectiveStatus === 'failed' && (
              <div className="mx-4 mb-3 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2">
                <FontAwesomeIcon icon={faTimesCircle} className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-xs text-red-800 dark:text-red-300 font-semibold">Pipeline failed — check the debug sheet / Telegram alerts, then re-trigger from the campaign page.</span>
              </div>
            )}

            {/* Staging pipeline badges + schedule status (inline bar replaced by progressive green card background) */}
            <div className="px-4 pb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xxs">
                {(campaign.channel === 'social'
                  ? [
                      ...(campaign.shouldSendMessage && campaign.fileUrl
                        ? [{ label: 'Execute', staged: true, status: socialInteractStageStatus }]
                        : []),
                      { label: 'Interact', staged: true, status: socialInteractStageStatus },
                    ]
                  : [
                      { label: 'Validate', staged: campaign.validationStaged, status: campaign.validationStatus },
                      { label: 'Enrich', staged: campaign.enrichmentStaged, status: campaign.enrichmentStatus },
                      { label: 'AI', staged: campaign.aiPersonalizationStaged, status: campaign.personalizationStatus },
                      { label: 'Execute', staged: campaign.executeStaged ?? true, status: emailExecuteStageStatus },
                      { label: 'Interact', staged: campaign.interactionStaged, status: emailInteractStageStatus },
                    ]
                ).map(s => {
                  const si = stageIcon(s.staged, s.status);
                  return (
                    <span key={s.label} className={`flex items-center gap-1 font-medium ${si.color}`}>
                      <FontAwesomeIcon icon={si.icon} className={`w-3 h-3 ${si.icon === faSpinner ? 'animate-spin' : ''}`} />
                      <span>{s.label}</span>
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-xxs">
                {sent > 0 && (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {sent.toLocaleString()} {campaign.channel === 'social' ? 'actions' : 'sent'} ·
                  </span>
                )}
                <span className={`font-semibold shrink-0 ${isExpired ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {isExpired ? `Completed (${durationDays}d elapsed)` : `${daysRemaining}d left (${pct}%)`}
                </span>
              </div>
            </div>

            {/* Interaction stats */}
            {campaign.interactionStaged && (campaign as any).interactionStatus && campaign.channel !== 'social' && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-3 text-xxs text-purple-600 dark:text-purple-400">
                  <span className="flex items-center gap-1">
                    <FontAwesomeIcon icon={faComments} className="w-3 h-3" />
                    Interaction: {(campaign as any).interactionStatus}
                  </span>
                  {(campaign as any).interactionStoppedReason && (
                    <span className="text-amber-500 dark:text-amber-400">
                      ({(campaign as any).interactionStoppedReason.replace(/_/g, ' ')})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions row */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/70 dark:bg-gray-900/40 border-t dark:border-gray-700/80">
              <Link
                href={`/campaign/${campaign.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                View Details
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
              </Link>
              <div className="flex items-center gap-1">
                {/* Only show start/execute/resume/pause buttons when campaign duration has NOT elapsed */}
                {!isExpired && effectiveStatus !== 'completed' && (
                  <>
                    {/* Draft + setup incomplete: Continue Setup */}
                    {effectiveStatus === 'draft' && !campaign.isSetupComplete && (
                      <button onClick={() => { setEditingCampaign(campaign); setShowCampaignModal(true); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors" title="Continue Setup">
                        <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
                        Continue Setup
                      </button>
                    )}
                    {/* Draft + setup complete: Execute (hidden at concurrent limit) */}
                    {effectiveStatus === 'draft' && campaign.isSetupComplete && !concurrentState.atLimit && (
                      <button onClick={() => router.push(`/campaign/${campaign.id}`)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors" title="Execute Campaign">
                        <FontAwesomeIcon icon={faRocket} className="w-3 h-3" />
                        Execute
                      </button>
                    )}
                    {/* Running or Limit Reached: Pause */}
                    {(effectiveStatus === 'running' || effectiveStatus === 'Limit Reached') && (
                      <button onClick={() => { setCampaignToPause(campaign.id); setShowPauseConfirmation(true); }} disabled={actingId === campaign.id} className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Pause Campaign">
                        <FontAwesomeIcon icon={actingId === campaign.id ? faSpinner : faPause} spin={actingId === campaign.id} className="w-4 h-4" />
                      </button>
                    )}
                    {/* Paused: Resume (hidden at concurrent limit) */}
                    {effectiveStatus === 'paused' && !concurrentState.atLimit && (
                      <button onClick={() => handleResumeCampaign(campaign.id)} disabled={actingId === campaign.id} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Resume Campaign">
                        <FontAwesomeIcon icon={actingId === campaign.id ? faSpinner : faPlay} spin={actingId === campaign.id} className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
                {/* Delete always shown */}
                <button onClick={() => { setCampaignToDelete(campaign.id); setShowDeleteConfirmation(true); }} disabled={actingId === campaign.id} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Delete Campaign">
                  <FontAwesomeIcon icon={actingId === campaign.id ? faSpinner : faTrash} spin={actingId === campaign.id} className="w-4 h-4" />
                </button>
              </div>
            </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Campaign Modal */}
      {showCampaignModal && (
        <CampaignModal
          appData={appData}
          campaignToEdit={editingCampaign || undefined}
          onClose={() => {
            setShowCampaignModal(false);
            setEditingCampaign(null);
          }}
          onSave={handleSaveCampaign}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => { if (actingId) return; setShowDeleteConfirmation(false); setCampaignToDelete(null); }}
          onConfirm={handleDeleteCampaign}
          title="Delete Campaign"
          message="Are you sure you want to permanently delete this campaign? This action cannot be undone."
          confirmText={actingId ? 'Deleting...' : 'Delete'}
          cancelText="Cancel"
          // @ts-ignore
          confirmDisabled={!!actingId}
          // @ts-ignore
          confirmLoading={!!actingId}
        />
      )}

      {showPauseConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => { if (actingId) return; setShowPauseConfirmation(false); setCampaignToPause(null); }}
          onConfirm={handleConfirmPause}
          title="Pause Campaign"
          message="Are you sure you want to pause this campaign? You can resume it anytime to continue from where it left off."
          confirmText={actingId ? 'Pausing...' : 'Pause'}
          cancelText="Cancel"
          // @ts-ignore
          confirmDisabled={!!actingId}
          // @ts-ignore
          confirmLoading={!!actingId}
        />
      )}

      {showUpgradeModal && (
        <UpgradePlanModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          appData={appData}
          userLimits={userLimits}
          onConfirm={() => setShowUpgradeModal(false)}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          isUpgradingPlan={false}
        />
      )}

      {/* Transaction Result Modal */}
      <TransactionResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        type={resultModalProps.type}
        title={resultModalProps.title}
        message={resultModalProps.message}
        details={resultModalProps.details}
      />

      {/* Loading States — page-level only. Resume/pause/delete use the row
          button spinner (actingId), never this overlay. */}
      {(loading || refreshing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </div>
      )}
    </div>
  );
}

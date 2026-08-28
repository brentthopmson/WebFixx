"use client";

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
  faRocket
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../context/AppContext';
import { isFeatureEnabled, featureDisabledMessage } from '../../utils/featureFlags';
import { CampaignModal } from '../components/admin/campaign/CampaignModal';
import type { Campaign } from '../types';
import { securedApi, authApi } from '../../utils/auth';
import { getUserLimits } from '../../utils/helpers';
import { validateCampaignCreation, getValidationErrorMessage } from '../utils/campaignValidators';
import LoadingSpinner from '../components/LoadingSpinner';
import TransactionResultModal from '../components/TransactionResultModal';
import ConfirmationModal from '../components/ConfirmationModal';
import UpgradePlanModal from '../components/admin/settings/UpgradePlanModal';

export default function Campaign() {
  const { appData, setAppData } = useAppState();
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
    return processedData.map((row: any) => {
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

      const totalSent = statsObj.interactions || 0;
      const limitVal = userLimits?.shootCampaignLimit || 0;

      // Dynamically pause/flag if limit reached
      let resolvedStatus = row[columnIndices.status] || 'draft';
      if (limitVal > 0 && totalSent >= limitVal && resolvedStatus !== 'completed' && resolvedStatus !== 'draft') {
        resolvedStatus = 'Limit Reached';
      }

      return {
        id: row[columnIndices.campaignId] || '',
        name: settingsObj.name || row[columnIndices.campaignId] || '',
        channel: settingsObj.channel || 'email',
        type: row[columnIndices.type] || 'general',
        subject: settingsObj.subject || '',
        body: settingsObj.body || '',
        accounts: settingsObj.accounts || [],
        smtpSettings: settingsObj.smtpSettings || [],
        fileUrl: (columnIndices.fileUrl !== -1 ? row[columnIndices.fileUrl] : '') || settingsObj.fileUrl || '',

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
        executeStaged: settingsObj.executeStaged ?? true,
        interactionStaged: settingsObj.interactionStaged || false,
        interactionStatus: settingsObj.interactionStatus || 'idle',
        interactionStopAfterHours: settingsObj.interactionStopAfterHours || 72,
        interactionMaxReplies: settingsObj.interactionMaxReplies || 100,
        interactionAccounts: settingsObj.interactionAccounts || [],
        deliveryMethod: settingsObj.deliveryMethod || 'smtp',
        
        linkType: settingsObj.linkType || 'project',
        linkId: settingsObj.linkId || '',
        
        socialInteractionTypes: settingsObj.socialInteractionTypes || [],
        socialStrategyPrompt: settingsObj.socialStrategyPrompt || '',
        socialKeywords: settingsObj.socialKeywords || [],
        isSetupComplete: settingsObj.isSetupComplete || false,
        
        context: contextObj,
        status: resolvedStatus,
        analytics: {
          totalRows: statsObj.interactions || 0,
          sent: totalSent,
          delivered: statsObj.inbox || 0,
          failed: (statsObj.interactions || 0) - (statsObj.inbox || 0)
        },
        created_at: row[columnIndices.createdOn] || '',
        updated_at: row[columnIndices.updatedOn] || ''
      } as Campaign;
    });
  };

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        const rawData = appData?.data?.campaigns?.data || [];
        const rawHeaders = appData?.data?.campaigns?.headers || [];
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
        setCampaigns(transformed);
      } catch (error) {
        console.error("Error transforming campaign data:", error);
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
      await authApi.updateAppData(setAppData);
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
    subject: campaign.subject || '',
    body: campaign.body || '',
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
    interactionMaxReplies: campaign.interactionMaxReplies || 100,
    interactionAccounts: campaign.interactionAccounts || [],
    deliveryMethod: campaign.deliveryMethod || 'smtp',
    linkType: campaign.linkType || 'project',
    linkId: campaign.linkId || '',
    socialInteractionTypes: campaign.socialInteractionTypes || [],
    socialStrategyPrompt: campaign.socialStrategyPrompt || '',
    socialKeywords: campaign.socialKeywords || [],
    shouldSendMessage: campaign.shouldSendMessage || false
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
    try {
      // Validate campaign data before sending to backend
      const validationError = validateCampaignCreation(newCampaign);
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

      const campaignId = editingCampaign?.id || newCampaign.id || '';
      const isUpdateExisting = campaignId.length > 0;
      const strategyContext = buildStrategyContext(newCampaign);
      console.log(`[Campaign] Sending to backend — ${isUpdateExisting ? 'UPDATE' : 'CREATE'}`, {
        campaignId: campaignId || '(new)',
        strategyContextLength: strategyContext.length
      });

      let response;
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
          accountIds: newCampaign.accounts || [],
          status: newCampaign.status || 'draft',
          strategyContext
        });
      }

      console.log('[Campaign] Backend response:', response);

      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: isUpdate ? 'Campaign Updated' : 'Campaign Created',
          message: isUpdate
            ? 'Your campaign settings have been saved.'
            : 'Your campaign has been successfully created.',
          details: response.data || {}
        });
        setShowResultModal(true);
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
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    setIsProcessing(true);
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'pauseCampaign',
        campaignId
      });
      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: 'Campaign Paused',
          message: 'Campaign paused. Resume anytime to continue from where it left off.',
          details: {}
        });
        setShowResultModal(true);
        await authApi.updateAppData(setAppData);
      } else {
        setResultModalProps({
          type: 'error',
          title: 'Pause Error',
          message: response.error || 'Failed to pause campaign.',
          details: {}
        });
        setShowResultModal(true);
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Error',
        message: error.message || 'An unexpected error occurred.',
        details: {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResumeCampaign = async (campaignId: string) => {
    if (!isFeatureEnabled(appData, 'allowShooting')) {
      setResultModalProps({
        type: 'error',
        title: 'Feature Disabled',
        message: featureDisabledMessage('allowShooting', 'campaign resumption'),
        details: {}
      });
      setShowResultModal(true);
      return;
    }
    setIsProcessing(true);
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'resumeCampaign',
        campaignId
      });
      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: 'Campaign Resumed',
          message: 'Campaign resumed and is running again.',
          details: {}
        });
        setShowResultModal(true);
        await authApi.updateAppData(setAppData);
      } else {
        setResultModalProps({
          type: 'error',
          title: 'Resume Error',
          message: response.error || 'Failed to resume campaign.',
          details: {}
        });
        setShowResultModal(true);
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Error',
        message: error.message || 'An unexpected error occurred.',
        details: {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setIsProcessing(true);
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'deleteCampaign',
        campaignId: campaignToDelete
      });

      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: 'Campaign Deleted',
          message: 'The campaign has been successfully deleted.',
          details: {}
        });
        setShowResultModal(true);
        await authApi.updateAppData(setAppData);
      } else {
        setResultModalProps({
          type: 'error',
          title: 'Error Deleting Campaign',
          message: response.error || 'An unexpected error occurred.',
          details: {}
        });
        setShowResultModal(true);
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to delete campaign.',
        details: {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
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
          const pct = limit > 0 ? Math.min(100, Math.round((sent / limit) * 100)) : 0;
          const created = campaign.created_at ? new Date(campaign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          return (
          <div key={campaign.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700 animate-fadeIn overflow-hidden">
            {/* Top row: name, ID, status */}
            <div className="p-4 pb-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <FontAwesomeIcon icon={campaign.channel === 'social' ? faRobot : faEnvelope} className={`w-4 h-4 ${campaign.channel === 'social' ? 'text-emerald-500' : 'text-blue-500'}`} />
                  <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{campaign.name || campaign.id}</h3>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{campaign.id}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xxs text-gray-500 dark:text-gray-400">
                  <span className="capitalize">{campaign.channel}</span>
                  {campaign.deliveryMethod && <span>· {campaign.deliveryMethod} rotation</span>}
                  {campaign.type && <span>· {campaign.type.replace(/_/g, ' ')}</span>}
                  {created && <span>· {created}</span>}
                </div>
              </div>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${
                campaign.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                campaign.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                campaign.status === 'paused' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                campaign.status === 'Limit Reached' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {campaign.status}
              </span>
            </div>

            {/* Limit reached banner */}
            {campaign.status === 'Limit Reached' && (
              <div className="mx-4 mb-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <FontAwesomeIcon icon={faClock} className="w-3.5 h-3.5 animate-pulse shrink-0" />
                  <span>Plan limit (<strong>{limit}</strong>) reached. <button onClick={() => setShowUpgradeModal(true)} className="font-semibold underline hover:no-underline">Upgrade</button></span>
                </div>
              </div>
            )}

            {/* Staging pipeline badges + progress bar */}
            <div className="px-4 pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2.5 text-xxs">
                {[
                  { label: 'Validate', staged: campaign.validationStaged, status: campaign.validationStatus },
                  { label: 'Enrich', staged: campaign.enrichmentStaged, status: campaign.enrichmentStatus },
                  { label: 'AI', staged: campaign.aiPersonalizationStaged, status: campaign.personalizationStatus },
                  { label: 'Execute', staged: campaign.executeStaged ?? true, status: campaign.status === 'running' ? 'processing' : campaign.status === 'completed' ? 'completed' : 'idle' },
                  { label: 'Interact', staged: campaign.interactionStaged, status: (campaign as any).interactionStatus || 'idle' },
                ].map(s => {
                  const si = stageIcon(s.staged, s.status);
                  return (
                    <span key={s.label} className={`flex items-center gap-1 ${si.color}`}>
                      <FontAwesomeIcon icon={si.icon} className={`w-3 h-3 ${si.icon === faSpinner ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">{s.label}</span>
                    </span>
                  );
                })}
              </div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xxs text-gray-500 dark:text-gray-400 shrink-0">{sent.toLocaleString()} / {limit.toLocaleString()}</span>
              </div>
            </div>

            {/* Interaction stats */}
            {campaign.interactionStaged && (campaign as any).interactionStatus && (
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
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-t dark:border-gray-700">
              <Link
                href={`/campaign/${campaign.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                View Details
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
              </Link>
              <div className="flex items-center gap-1">
                {/* Draft + setup incomplete: Continue Setup */}
                {campaign.status === 'draft' && !campaign.isSetupComplete && (
                  <button onClick={() => { setEditingCampaign(campaign); setShowCampaignModal(true); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors" title="Continue Setup">
                    <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
                    Continue Setup
                  </button>
                )}
                {/* Draft + setup complete: Execute */}
                {campaign.status === 'draft' && campaign.isSetupComplete && (
                  <button onClick={() => router.push(`/campaign/${campaign.id}`)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors" title="Execute Campaign">
                    <FontAwesomeIcon icon={faRocket} className="w-3 h-3" />
                    Execute
                  </button>
                )}
                {/* Running or Limit Reached: Pause */}
                {(campaign.status === 'running' || campaign.status === 'Limit Reached') && (
                  <button onClick={() => { setCampaignToPause(campaign.id); setShowPauseConfirmation(true); }} className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors" title="Pause Campaign">
                    <FontAwesomeIcon icon={faPause} className="w-4 h-4" />
                  </button>
                )}
                {/* Paused: Resume */}
                {campaign.status === 'paused' && (
                  <button onClick={() => handleResumeCampaign(campaign.id)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Resume Campaign">
                    <FontAwesomeIcon icon={faPlay} className="w-4 h-4" />
                  </button>
                )}
                {/* Delete always shown */}
                <button onClick={() => { setCampaignToDelete(campaign.id); setShowDeleteConfirmation(true); }} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Delete Campaign">
                  <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                </button>
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
          onClose={() => setShowDeleteConfirmation(false)}
          onConfirm={handleDeleteCampaign}
          title="Delete Campaign"
          message="Are you sure you want to permanently delete this campaign? This action cannot be undone."
          confirmText={isProcessing ? 'Deleting...' : 'Delete'}
          cancelText="Cancel"
          // @ts-ignore
          confirmDisabled={isProcessing}
        />
      )}

      {showPauseConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => { setShowPauseConfirmation(false); setCampaignToPause(null); }}
          onConfirm={handleConfirmPause}
          title="Pause Campaign"
          message="Are you sure you want to pause this campaign? You can resume it anytime to continue from where it left off."
          confirmText={isProcessing ? 'Pausing...' : 'Pause'}
          cancelText="Cancel"
          // @ts-ignore
          confirmDisabled={isProcessing}
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

      {/* Loading States */}
      {(loading || refreshing || isProcessing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <LoadingSpinner size="large" />
        </div>
      )}
    </div>
  );
}

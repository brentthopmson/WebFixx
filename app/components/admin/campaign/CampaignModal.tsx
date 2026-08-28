"use client";

import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUpload, 
  faSpinner, 
  faEdit, 
  faPlus, 
  faTrash,
  faCheckCircle,
  faEnvelope,
  faRobot,
  faInfoCircle,
  faExclamationTriangle,
  faChevronDown,
  faChevronRight,
  faCog,
  faFileAlt,
  faCheckSquare
} from '@fortawesome/free-solid-svg-icons';
import type { Campaign, SMTPSetting, CSVAnalytics } from '../../../types';
import { securedApi } from '../../../../utils/auth';
import { checkFileBeforeUpload, FILE_CONSTRAINTS } from '../../../utils/fileValidators';
import { validateCampaignCreation, getValidationErrorMessage } from '../../../utils/campaignValidators';
import { normalizeCSV, generateSampleCSV } from '../../../utils/csvNormalizer';
import { getUserLimits } from '../../../../utils/helpers';
import { isFeatureEnabled, featureDisabledMessage } from '../../../../utils/featureFlags';
import ConfirmationModal from '../../../components/ConfirmationModal';

interface CampaignModalProps {
  appData: any;
  onClose: () => void;
  onSave: (campaign: Partial<Campaign>) => void;
  campaignToEdit?: Campaign;
}

export function CampaignModal({ appData, onClose, onSave, campaignToEdit }: CampaignModalProps) {
  const isEditing = !!campaignToEdit;
  const userLimits = getUserLimits(appData);
  const campaignFileSize = userLimits?.campaignFileSize;
  const [step, setStep] = useState(isEditing ? 2 : 0);
  const [loading, setLoading] = useState(false);
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);

  // Parse projects list from appData (active only)
  const getProjectsList = () => {
    const rawProjects = appData?.data?.projects;
    if (!rawProjects) return [];
    const headers = rawProjects.headers || [];
    const data = rawProjects.data || [];
    
    const projectIdIndex = headers.indexOf('projectId');
    const titleIndex = headers.indexOf('title') !== -1 ? headers.indexOf('title')
      : headers.indexOf('name') !== -1 ? headers.indexOf('name')
      : headers.indexOf('projectTitle');
    const statusIndex = headers.indexOf('systemStatus');
    
    return data
      .filter((row: any) => {
        const status = statusIndex !== -1 ? (row[statusIndex] || '').toLowerCase() : '';
        return status === 'active';
      })
      .map((row: any) => ({
        projectId: row[projectIdIndex] || '',
        title: titleIndex !== -1 ? row[titleIndex] : (row[projectIdIndex] || '')
      }))
      .filter((p: any) => p.projectId);
  };

  // Parse redirect links from appData (active only)
  const getRedirectsList = () => {
    const rawRedirects = appData?.data?.redirect || appData?.data?.redirects;
    if (!rawRedirects) return [];
    const headers = rawRedirects.headers || [];
    const data = rawRedirects.data || [];
    
    const redirectIdIndex = headers.indexOf('redirectId');
    const titleIndex = headers.indexOf('title') !== -1 ? headers.indexOf('title') : headers.indexOf('subdomain');
    const statusIndex = headers.indexOf('status');
    
    return data
      .filter((row: any) => {
        const status = statusIndex !== -1 ? (row[statusIndex] || '') : '';
        return status === 'ACTIVE';
      })
      .map((row: any) => ({
        redirectId: row[redirectIdIndex] || '',
        title: titleIndex !== -1 ? row[titleIndex] : (row[redirectIdIndex] || '')
      }))
      .filter((r: any) => r.redirectId);
  };

  const projectsList = getProjectsList();
  const redirectsList = getRedirectsList();

  const getInitialFormData = (): Partial<Campaign> => {
    if (campaignToEdit) {
      return {
        id: campaignToEdit.id || '',
        name: campaignToEdit.name || '',
        channel: campaignToEdit.channel || 'email',
        type: campaignToEdit.type || 'general',
        subject: campaignToEdit.subject || '',
        body: campaignToEdit.body || '',
        projectId: campaignToEdit.projectId || '',
        accounts: campaignToEdit.accounts || [],
        interactionAccounts: campaignToEdit.interactionAccounts || [],
        smtpSettings: campaignToEdit.smtpSettings || [],
        template: campaignToEdit.template || '',
        templateId: campaignToEdit.templateId || '',
        templateContent: campaignToEdit.templateContent || '',
        fileUrl: campaignToEdit.fileUrl || '',
        created_at: campaignToEdit.created_at || new Date().toISOString(),
        status: campaignToEdit.status || 'draft',
        validationStaged: campaignToEdit.validationStaged || false,
        validationStatus: campaignToEdit.validationStatus || 'idle',
        enrichmentStaged: campaignToEdit.enrichmentStaged || false,
        enrichmentStatus: campaignToEdit.enrichmentStatus || 'idle',
        aiPersonalizationStaged: campaignToEdit.aiPersonalizationStaged || false,
        aiPersonalizationPrompt: campaignToEdit.aiPersonalizationPrompt || '',
        personalizationStatus: campaignToEdit.personalizationStatus || 'idle',
        executeStaged: campaignToEdit.executeStaged ?? true,
        interactionStaged: campaignToEdit.interactionStaged || false,
        interactionStatus: campaignToEdit.interactionStatus || 'idle',
        interactionStopAfterHours: campaignToEdit.interactionStopAfterHours || 72,
        interactionMaxReplies: campaignToEdit.interactionMaxReplies || 100,
        deliveryMethod: campaignToEdit.deliveryMethod || 'smtp',
        firestickEnabled: campaignToEdit.firestickEnabled || false,
        linkType: campaignToEdit.linkType || 'project',
        linkId: campaignToEdit.linkId || '',
        socialInteractionTypes: campaignToEdit.socialInteractionTypes || [],
        socialStrategyPrompt: campaignToEdit.socialStrategyPrompt || '',
        socialKeywords: campaignToEdit.socialKeywords || [],
        shouldSendMessage: campaignToEdit.shouldSendMessage || false
      };
    }
    return {
      id: '',
      name: '',
      channel: 'email',
      type: 'general',
      subject: '',
      body: '',
      projectId: '',
      accounts: [],
      interactionAccounts: [],
      smtpSettings: [],
      template: '',
      templateId: '',
      templateContent: '',
      fileUrl: '',
      created_at: new Date().toISOString(),
      status: 'draft',
      validationStaged: false,
      validationStatus: 'idle',
      enrichmentStaged: false,
      enrichmentStatus: 'idle',
      aiPersonalizationStaged: false,
      aiPersonalizationPrompt: '',
      personalizationStatus: 'idle',
      executeStaged: true,
      interactionStaged: false,
      interactionStatus: 'idle',
      interactionStopAfterHours: 72,
      interactionMaxReplies: 100,
      deliveryMethod: 'smtp',
      firestickEnabled: false,
      linkType: 'project',
      linkId: '',
      socialInteractionTypes: [],
      socialStrategyPrompt: '',
      socialKeywords: [],
      shouldSendMessage: false
    };
  };

  const [formData, setFormData] = useState<Partial<Campaign>>(getInitialFormData);

  // Get ALL logged-in hub accounts matching channel type (from any project, regardless of status)
  const getHubAccountsForChannel = (channelType: 'email' | 'social') => {
    const rawHub = appData?.data?.hub;
    if (!rawHub) return [];

    const headers = rawHub.headers || [];
    const data = rawHub.data || [];
    
    const submissionIdIndex = headers.indexOf('submissionId');
    const projectIdIndex = headers.indexOf('projectId');
    const typeIndex = headers.indexOf('type');
    const emailIndex = headers.indexOf('email');
    const cookieIndex = headers.indexOf('formattedCookie') !== -1 ? headers.indexOf('formattedCookie') : headers.indexOf('cookieJSON');
    
    return data.filter((row: any) => {
      const accType = (row[typeIndex] || '').toLowerCase();
      const hasCookies = row[cookieIndex] && String(row[cookieIndex]).length > 10;
      
      // Must have active browser session (cookies)
      if (!hasCookies) return false;
      
      // Email matches gmail, outlook, etc. Social matches twitter, tiktok, etc.
      const isSocialType = accType.includes('twitter') || accType.includes('tiktok') || accType.includes('social') || accType.includes('x') || accType.includes('instagram') || accType.includes('facebook') || accType.includes('whatsapp') || accType.includes('discord');
      const matchesChannel = channelType === 'social' ? isSocialType : !isSocialType;
      
      return matchesChannel;
    }).map((row: any) => ({
      accountId: row[submissionIdIndex],
      type: row[typeIndex],
      identifier: row[emailIndex],
      projectId: row[projectIdIndex]
    }));
  };

  const accountsList = getHubAccountsForChannel(formData.channel || 'email');

  // Get COMPLETED hub accounts for interaction selection
  const getCompletedAccountsForInteraction = (channelType: 'email' | 'social') => {
    const rawHub = appData?.data?.hub;
    if (!rawHub) return [];

    const headers = rawHub.headers || [];
    const data = rawHub.data || [];

    const submissionIdIndex = headers.indexOf('submissionId');
    const typeIndex = headers.indexOf('type');
    const emailIndex = headers.indexOf('email');
    const statusIndex = headers.indexOf('status');
    const cookieAccessIndex = headers.indexOf('cookieAccess');
    const interactionStatusIndex = headers.indexOf('interactionStatus');

    return data.filter((row: any) => {
      const accType = (row[typeIndex] || '').toLowerCase();
      const status = String(row[statusIndex] || '').toUpperCase();
      const cookieAccess = String(row[cookieAccessIndex] || '').toUpperCase();
      const interactionStatus = String(row[interactionStatusIndex] || 'ACTIVE').toUpperCase();

      // Must be COMPLETED with valid cookie access
      if (status !== 'COMPLETED') return false;
      if (cookieAccess !== 'TRUE') return false;
      // Must not be rate-limited or cancelled
      if (interactionStatus === 'RATE_LIMITED' || interactionStatus === 'CANCELLED') return false;

      // Match channel type
      const isSocialType = accType.includes('twitter') || accType.includes('tiktok') || accType.includes('social') || accType.includes('x') || accType.includes('instagram') || accType.includes('facebook') || accType.includes('whatsapp') || accType.includes('discord');
      const matchesChannel = channelType === 'social' ? isSocialType : !isSocialType;

      return matchesChannel;
    }).map((row: any) => ({
      accountId: row[submissionIdIndex],
      type: row[typeIndex],
      email: row[emailIndex],
    }));
  };

  const interactionAccountsList = getCompletedAccountsForInteraction(formData.channel || 'email');

  const [csvAnalytics, setCsvAnalytics] = useState<CSVAnalytics | null>(null);
  const [editingSMTP, setEditingSMTP] = useState<SMTPSetting | null>(null);
  const [socialKeywordInput, setSocialKeywordInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Collapsible sections state
  const [expandedSection, setExpandedSection] = useState<string | null>('basic');
  const [templateSource, setTemplateSource] = useState<'existing' | 'custom'>(campaignToEdit?.templateId ? 'existing' : 'custom');
  const [templatePreview, setTemplatePreview] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'html' | 'code'>('html');

  // Parse templates list from appData (EMAIL category only)
  const templatesList = useMemo(() => {
    const raw = appData?.data?.template;
    if (!raw) return [];
    const headers = raw.headers || [];
    const data = raw.data || [];
    const idIdx = headers.indexOf('templateId');
    const nameIdx = headers.indexOf('name');
    const codeIdx = headers.indexOf('code');
    const code2Idx = headers.indexOf('templateCode');
    const categoryIdx = headers.indexOf('category');
    const nicheIdx = headers.indexOf('niche');
    const typeIdx = headers.indexOf('type');
    return data.map((row: any) => ({
      templateId: row[idIdx] || '',
      name: row[nameIdx] || '',
      code: row[codeIdx] || row[code2Idx] || '',
      category: row[categoryIdx] || '',
      niche: row[nicheIdx] || '',
      type: row[typeIdx] || '',
    })).filter((t: any) => t.templateId && t.category.toUpperCase() === 'EMAIL');
  }, [appData]);

  // Validate placeholders in body against CSV headers
  const getMissingPlaceholders = (body: string, headers: string[]) => {
    if (!body || !headers) return [];
    const placeholders = body.match(/\{\{(\w+)\}\}/g) || [];
    const keys = Array.from(new Set(placeholders.map((p: string) => p.slice(2, -2))));
    return keys.filter(k => !headers.includes(k));
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const file = e.target.files[0];
    setUploadError(null);
    setLoading(true);
    
    try {
      // 1. Validate file before processing
      const validationError = await checkFileBeforeUpload(file, campaignFileSize);
      if (validationError) {
        setUploadError(validationError);
        setLoading(false);
        return;
      }

      // 2. Read and normalize CSV content to 88-column schema
      let text = await file.text();
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      
      const normalized = normalizeCSV(text);
      if (normalized.totalRows === 0) {
        setUploadError("CSV file is empty or could not be parsed.");
        setLoading(false);
        return;
      }

      // 3. Create draft campaign with normalized CSV in one call
      const base64Content = btoa(unescape(encodeURIComponent(normalized.normalizedText)));
      const campaignName = file.name.replace(/\.[^/.]+$/, "");
      const channel = formData.channel || 'email';
      const draftContext: Record<string, any> = {
        name: campaignName,
        channel,
        type: formData.type || 'general'
      };
      if (channel === 'email') {
        draftContext.subject = '';
        draftContext.body = '';
        draftContext.smtpSettings = [];
        draftContext.deliveryMethod = 'smtp';
      }
      console.log(`[CampaignModal] Creating draft campaign with normalized CSV — channel=${channel} name=${campaignName}`);
      const response = await securedApi.callBackendFunction({
        functionName: 'createNewCampaign',
        projectId: '',
        accountIds: [],
        status: 'draft',
        strategyContext: JSON.stringify(draftContext),
        fileName: file.name,
        fileContent: base64Content,
        fileSize: file.size,
        fileMimeType: file.type,
        campaignFileSize
      });

      console.log('[CampaignModal] Draft creation response:', response);
      if (!response.success) {
        setUploadError(response.error || 'Failed to create draft campaign.');
        setLoading(false);
        return;
      }

      const draftId = (response as any)?.campaignId || (response as any)?.id || '';
      const fileUrl = (response as any)?.fileUrl || '';
      if (draftId) {
        console.log(`[CampaignModal] Draft campaign created — ID: ${draftId} fileUrl: ${fileUrl}`);
      } else {
        console.error('[CampaignModal] Draft creation returned no campaignId:', response);
      }

      const analytics: CSVAnalytics = {
        totalRows: normalized.totalRows,
        headers: normalized.headers,
        preview: normalized.preview,
        summary: `Normalized to 88-column schema. ${normalized.totalRows} contacts mapped.`,
      };
      
      setCsvAnalytics(analytics);
      setFormData(prev => ({
        ...prev,
        id: draftId || prev.id,
        fileUrl,
        name: prev.name || campaignName
      }));
      setStep(2);
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(
        error instanceof Error 
          ? error.message 
          : 'Error parsing CSV file. Please make sure it is a valid comma-separated text file.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddSMTP = () => {
    if (!editingSMTP) return;
    
    setFormData(prev => ({
      ...prev,
      smtpSettings: [...(prev.smtpSettings || []), editingSMTP]
    }));
    setEditingSMTP(null);
  };

  const handleAddSocialKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && socialKeywordInput.trim()) {
      e.preventDefault();
      const newKeyword = socialKeywordInput.trim();
      if (!(formData.socialKeywords || []).includes(newKeyword)) {
        setFormData(prev => ({
          ...prev,
          socialKeywords: [...(prev.socialKeywords || []), newKeyword]
        }));
      }
      setSocialKeywordInput('');
    }
  };

  const handleRemoveSocialKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      socialKeywords: (prev.socialKeywords || []).filter(k => k !== keyword)
    }));
  };

  const renderSMTPForm = () => (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-700 border dark:border-gray-600 animate-fadeIn">
      <h4 className="font-semibold text-sm text-gray-900 dark:text-white">Add SMTP Server</h4>
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Host (e.g. smtp.gmail.com)"
          className="p-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={editingSMTP?.host || ''}
          onChange={e => setEditingSMTP(prev => ({ ...prev!, host: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Port (e.g. 587)"
          className="p-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={editingSMTP?.port || ''}
          onChange={e => setEditingSMTP(prev => ({ ...prev!, port: Number(e.target.value) }))}
        />
      </div>
      <input
        type="email"
        placeholder="From Email Address"
        className="w-full p-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        value={editingSMTP?.from_email || ''}
        onChange={e => setEditingSMTP(prev => ({ ...prev!, from_email: e.target.value }))}
      />
      <input
        type="text"
        placeholder="SMTP Username"
        className="w-full p-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        value={editingSMTP?.username || ''}
        onChange={e => setEditingSMTP(prev => ({ ...prev!, username: e.target.value }))}
      />
      <input
        type="password"
        placeholder="SMTP Password"
        className="w-full p-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        value={editingSMTP?.password || ''}
        onChange={e => setEditingSMTP(prev => ({ ...prev!, password: e.target.value }))}
      />
      <div className="flex justify-end space-x-2.5 pt-2">
        <button
          onClick={() => setEditingSMTP(null)}
          className="px-3.5 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAddSMTP}
          className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Add Server
        </button>
      </div>
    </div>
  );

  const renderSMTPList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">SMTP Server Rotation Pool ({(formData.smtpSettings || []).length})</h4>
        <button
          onClick={() => setEditingSMTP({ host: '', port: 587, username: '', password: '', from_email: '' })}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-xs font-semibold"
        >
          <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5 mr-1" />
          Add Server
        </button>
      </div>
      
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {(formData.smtpSettings || []).map((smtp, index) => (
          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg dark:bg-gray-700 border dark:border-gray-600">
            <div>
              <p className="text-sm font-semibold dark:text-white">{smtp.from_email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{smtp.host}:{smtp.port}</p>
            </div>
            <button
              onClick={() => {
                const newSettings = [...(formData.smtpSettings || [])];
                newSettings.splice(index, 1);
                setFormData(prev => ({ ...prev, smtpSettings: newSettings }));
              }}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 transition-colors"
            >
              <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
            </button>
          </div>
        ))}
        {(formData.smtpSettings || []).length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">No SMTP servers added yet. Outbound emails will rely on active browser WIRE logins.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border dark:border-gray-700">
        
        {/* Title */}
        <div className="flex justify-between items-center mb-6 border-b pb-3 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-950 dark:text-white flex items-center">
            {step === 0 ? (
              <span>{isEditing ? 'Edit Campaign' : 'Create Campaign'}</span>
            ) : formData.channel === 'social' ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <FontAwesomeIcon icon={faRobot} className="w-5 h-5" />
                Social AI Campaign Creator
              </span>
            ) : (
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <FontAwesomeIcon icon={faEnvelope} className="w-5 h-5" />
                Email outreach Creator
              </span>
            )}
          </h2>
          {step > 0 && (
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
              {formData.channel} Mode
            </span>
          )}
        </div>
        
        {/* Step indicators (Hidden on Step 0) */}
        {step > 0 && (
          <div className="flex justify-between mb-8 overflow-x-auto pb-2 border-b dark:border-gray-700/50">
            {(isEditing
              ? (formData.channel === 'social'
                  ? ['AI Outreach Setup', 'Review Strategy']
                  : ['Staging & Details', 'Review & Launch'])
              : (formData.channel === 'social'
                  ? ['Upload Targets', 'AI Outreach Setup', 'Review Strategy']
                  : ['Upload Contacts', 'Staging & Details', 'Review & Launch'])
            ).map((label, i) => {
              const stepNum = isEditing ? i + 2 : i + 1;
              return (
                <div key={i} className={`flex items-center space-x-2 whitespace-nowrap ${stepNum <= step ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all font-bold text-sm
                    ${stepNum <= step ? 'border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {stepNum}
                  </div>
                  <span className="text-xs">{label}</span>
                  {i < (isEditing ? 1 : 2) && <div className={`h-0.5 w-6 sm:w-10 ${stepNum < step ? 'bg-blue-600 dark:bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 0: Channel Selection */}
        {step === 0 && (
          <div className="space-y-6 animate-fadeIn py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed max-w-md mx-auto">
              Select your campaign architecture. Each option loads a highly tailored workflow designed for premium performance.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div 
                onClick={() => {
                  const channel = 'email';
                  const allAccounts = getHubAccountsForChannel(channel);
                  setFormData(prev => ({ ...prev, channel: channel, accounts: allAccounts.map((a: any) => a.accountId) }));
                  setStep(1);
                }}
                className={`cursor-pointer p-6 rounded-2xl border-2 transition-all flex flex-col items-center text-center space-y-4 hover:shadow-lg backdrop-blur-md bg-white/20 dark:bg-gray-800/40 hover:-translate-y-0.5
                  ${formData.channel === 'email' 
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-800'}`}
              >
                <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FontAwesomeIcon icon={faEnvelope} className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold dark:text-white">Email Campaigns</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Shoot cold outreach lists using SMTP, active WIRE accounts, or Mixed-Mode. Supports staged validation, lead enrichment, and AI-powered custom mail merge.
                </p>
              </div>

              <div 
                onClick={() => {
                  const channel = 'social';
                  const allAccounts = getHubAccountsForChannel(channel);
                  setFormData(prev => ({ ...prev, channel: channel, accounts: allAccounts.map((a: any) => a.accountId) }));
                  setStep(1);
                }}
                className={`cursor-pointer p-6 rounded-2xl border-2 transition-all flex flex-col items-center text-center space-y-4 hover:shadow-lg backdrop-blur-md bg-white/20 dark:bg-gray-800/40 hover:-translate-y-0.5
                  ${formData.channel === 'social' 
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-md' 
                    : 'border-gray-200 hover:border-emerald-300 dark:border-gray-700 dark:hover:border-emerald-800'}`}
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FontAwesomeIcon icon={faRobot} className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold dark:text-white">Social AI Campaigns</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Engage leads automatically using logged-in SOCIAL browser sessions. Orchestrate inbox replies, keyword-based search-interact, and AI profile engagements.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: File Upload */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            {uploadError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">Upload Failed</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">{uploadError}</p>
                </div>
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csvUpload"
                disabled={loading}
              />
              <label htmlFor="csvUpload" className="cursor-pointer block">
                <FontAwesomeIcon icon={loading ? faSpinner : faUpload} className={`w-10 h-10 mb-4 text-gray-400 dark:text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
                  {loading ? 'Uploading & Parsing list...' : formData.channel === 'social' ? 'Upload Targets CSV List (Optional)' : 'Upload Recipients CSV List'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
                  {formData.channel === 'social' 
                    ? 'Upload a CSV of specific handles/keywords to interact with. If omitted, target leads via search keywords.'
                    : 'A comma-separated values file (.csv) containing contact emails and personalization columns.'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 font-medium">
                  📋 Max file size: {campaignFileSize || FILE_CONSTRAINTS.MAX_SIZE_KB}KB | Allowed format: .csv only
                </p>
                <a
                  onClick={(e) => {
                    e.stopPropagation();
                    const blob = new Blob([generateSampleCSV()], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'sample-campaign.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-block mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  ⬇ Download Sample CSV Template
                </a>
              </label>
            </div>
            
            {formData.channel === 'social' && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    setCsvAnalytics(null);
                    setFormData(prev => ({ ...prev, fileUrl: '' }));
                    setStep(2);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 hover:dark:bg-gray-600 rounded-xl font-semibold transition-colors text-xs shadow-sm"
                >
                  Skip Upload & Setup Strategy
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Campaign Details */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            {/* CSV Summary */}
            {csvAnalytics && (
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 flex items-center space-x-3">
                <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold dark:text-white">Contacts Database Synced</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5 leading-relaxed">{csvAnalytics.summary}</p>
                </div>
              </div>
            )}

            {/* SECTION 1: Basic Campaign Info */}
            <div className="border rounded-xl dark:border-gray-700 overflow-hidden">
              <button type="button" onClick={() => toggleSection('basic')} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500" />
                  Basic Campaign Info
                </h3>
                <FontAwesomeIcon icon={expandedSection === 'basic' ? faChevronDown : faChevronRight} className="text-gray-400" />
              </button>
              {expandedSection === 'basic' && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Campaign Name</label>
                    <input type="text" placeholder="e.g. Q2 Customer Outreach Strategy" className={`w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none ${isEditing ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-70' : ''}`} value={formData.name || ''} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} disabled={isEditing} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Niche Category</label>
                      <select className={`w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none ${isEditing ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-70' : ''}`} value={formData.type || 'general'} onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as Campaign['type'] }))} disabled={isEditing}>
                        <option value="general">General Niche</option>
                        <option value="email_logs">Email Logs</option>
                        <option value="bank_logs">Bank Logs</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Outreach Redirect/Project Link Injection</label>
                      <select className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.linkType || 'project'} onChange={e => setFormData(prev => ({ ...prev, linkType: e.target.value as any, linkId: '' }))}>
                        <option value="project">Project Link</option>
                        <option value="redirect">Redirect Link</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Linked Target Link</label>
                    <select className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.linkId || ''} onChange={e => setFormData(prev => ({ ...prev, linkId: e.target.value }))}>
                      <option value="">-- Choose Link --</option>
                      {formData.linkType === 'project' ? (
                        projectsList.map((p: any) => <option key={p.projectId} value={p.projectId}>{p.title}</option>)
                      ) : (
                        redirectsList.map((r: any) => <option key={r.redirectId} value={r.redirectId}>{r.title}</option>)
                      )}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: Delivery Method */}
            <div className="border rounded-xl dark:border-gray-700 overflow-hidden">
              <button type="button" onClick={() => toggleSection('delivery')} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FontAwesomeIcon icon={faCog} className={formData.channel === 'social' ? 'text-emerald-500' : 'text-blue-500'} />
                  {formData.channel === 'social' ? 'Outreach Profiles & Method' : 'Outbound Rotative Delivery Method'}
                </h3>
                <FontAwesomeIcon icon={expandedSection === 'delivery' ? faChevronDown : faChevronRight} className="text-gray-400" />
              </button>
              {expandedSection === 'delivery' && (
                <div className="p-4 space-y-4">
                  {formData.channel === 'email' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Delivery Method</label>
                      <select className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.deliveryMethod || 'smtp'} onChange={e => setFormData(prev => ({ ...prev, deliveryMethod: e.target.value as any }))}>
                        <option value="smtp">Custom SMTP Rotative Pool Only</option>
                        <option value="wire">Active Hub WIRE profiles Only (Secure Web Session)</option>
                        <option value="mixed">Mixed-Mode Rotation (Load balance SMTPs + WIRE sessions)</option>
                      </select>
                    </div>
                  )}

                  {formData.deliveryMethod !== 'smtp' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Select WebFixx Project</label>
                      <select className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold" value={formData.projectId || ''} onChange={e => setFormData(prev => ({ ...prev, projectId: e.target.value }))}>
                        <option value="">-- Choose Project --</option>
                        {projectsList.map((p: any) => <option key={p.projectId} value={p.projectId}>{p.title}</option>)}
                      </select>
                    </div>
                  )}

                  {formData.projectId && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                        Select Active {formData.channel === 'social' ? 'Social' : 'Email'} Profiles ({accountsList.length} Found)
                      </label>
                      {accountsList.length === 0 ? (
                        <p className="text-xs text-amber-600 italic bg-amber-50 p-3 rounded-xl dark:bg-amber-950/20 dark:text-amber-400 flex items-start gap-2">
                          <FontAwesomeIcon icon={faInfoCircle} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>No logged-in {formData.channel === 'social' ? 'social' : 'email'} accounts found in your hub. Please log in to at least one profile first.</span>
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-36 overflow-y-auto border p-3 rounded-xl dark:border-gray-600 dark:bg-gray-900/40">
                          {accountsList.map((acc: any) => (
                            <label key={acc.accountId} className="flex items-center space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                              <input type="checkbox" className="form-checkbox text-blue-600 rounded focus:ring-blue-500 w-4 h-4" checked={(formData.accounts || []).includes(acc.accountId)} onChange={e => { const checked = e.target.checked; setFormData(prev => { const currentAccs = prev.accounts || []; const nextAccs = checked ? [...currentAccs, acc.accountId] : currentAccs.filter((id: string) => id !== acc.accountId); return { ...prev, accounts: nextAccs }; }); }} />
                              <span className="text-sm dark:text-gray-200 font-semibold text-gray-800 flex items-center gap-2">
                                {acc.identifier} 
                                <span className="text-xs text-gray-400 font-normal bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">{acc.type}</span>
                                {acc.projectId && <span className="text-xxs text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded">{acc.projectId}</span>}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(formData.channel !== 'social' && (formData.deliveryMethod === 'smtp' || formData.deliveryMethod === 'mixed')) && (
                    <div className="border-t pt-4 dark:border-gray-700 animate-fadeIn">
                      {editingSMTP ? renderSMTPForm() : renderSMTPList()}
                    </div>
                  )}

                  {formData.channel === 'email' && (
                    <div className="border-t pt-4 dark:border-gray-700">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="form-checkbox text-blue-600 rounded w-4 h-4"
                          checked={formData.firestickEnabled || false}
                          onChange={e => setFormData(prev => ({ ...prev, firestickEnabled: e.target.checked }))}
                        />
                        <div>
                          <p className="text-sm font-semibold dark:text-white">Enable Firestick Warm-Up</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Send to a familiar inbox first before each lead to improve deliverability. Halves daily send capacity.</p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 3: Template / Content */}
            <div className="border rounded-xl dark:border-gray-700 overflow-hidden">
              <button type="button" onClick={() => toggleSection('template')} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FontAwesomeIcon icon={faFileAlt} className={formData.channel === 'social' ? 'text-emerald-500' : 'text-blue-500'} />
                  {formData.channel === 'social' ? 'Message Template & AI Strategy' : 'Email Template'}
                </h3>
                <FontAwesomeIcon icon={expandedSection === 'template' ? faChevronDown : faChevronRight} className="text-gray-400" />
              </button>
              {expandedSection === 'template' && (
                <div className="p-4 space-y-4">
                  {formData.channel === 'social' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">AI Outreach Strategy & DM Instruction Guidelines</label>
                        <textarea placeholder="e.g. Write a friendly, warm, non-spammy introduction. Offer a free audit for their landing page. Reference their recent tweets/posts. Emphasize a conversational approach." className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[120px]" value={formData.socialStrategyPrompt || ''} onChange={e => setFormData(prev => ({ ...prev, socialStrategyPrompt: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">DM Content Template</label>
                        <textarea placeholder="Write your DM template here. Supports merge tags like {{first_name}}..." className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[120px]" value={formData.body || ''} onChange={e => setFormData(prev => ({ ...prev, body: e.target.value }))} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center space-x-3 mb-2">
                        <button type="button" onClick={() => setTemplateSource('existing')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${templateSource === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>Choose Existing Template</button>
                        <button type="button" onClick={() => setTemplateSource('custom')} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${templateSource === 'custom' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>Custom Content</button>
                      </div>
                      {templateSource === 'existing' ? (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Select Email Template</label>
                            <select className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.templateId || ''} onChange={e => { const tpl = templatesList.find((t: any) => t.templateId === e.target.value); setFormData(prev => ({ ...prev, templateId: e.target.value, body: tpl?.code || prev.body, templateContent: tpl?.code || '' })); setTemplatePreview(tpl?.code || ''); setPreviewMode('html'); }}>
                              <option value="">-- Select Template --</option>
                              {templatesList.map((t: any) => <option key={t.templateId} value={t.templateId}>{t.name} — {t.type || 'HTML'}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Email Subject</label>
                            <input type="text" placeholder="e.g. Quick question regarding operations" className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold" value={formData.subject || ''} onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))} />
                          </div>
                          {templatePreview && (
                            <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl border dark:border-gray-700">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xxs font-bold text-gray-400 uppercase tracking-wider">Preview</p>
                                <button type="button" onClick={() => setPreviewMode(prev => prev === 'html' ? 'code' : 'html')} className="text-xxs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">
                                  {previewMode === 'html' ? 'View Code' : 'View HTML'}
                                </button>
                              </div>
                              {previewMode === 'html' ? (
                                <iframe srcDoc={templatePreview} className="w-full h-64 border rounded-lg bg-white dark:bg-gray-900" sandbox="allow-same-origin" title="Template Preview" />
                              ) : (
                                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto bg-white dark:bg-gray-900 p-2 rounded-lg border dark:border-gray-600">{templatePreview}</pre>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Subject Line</label>
                            <input type="text" placeholder="e.g. Quick question regarding operations" className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold" value={formData.subject || ''} onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Email Body</label>
                            <textarea placeholder="Write your email body here. Supports mail merge tags like {{first_name}} and {{company}}..." className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[120px]" value={formData.body || ''} onChange={e => setFormData(prev => ({ ...prev, body: e.target.value }))} />
                          </div>
                        </>
                      )}
                      {/* Placeholder warnings */}
                      {(() => { const missing = getMissingPlaceholders(formData.body || '', csvAnalytics?.headers || []); return missing.length > 0 ? (
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="w-3 h-3" />
                            Unrecognized placeholders
                          </p>
                          <p className="text-xxs text-amber-700 dark:text-amber-400 mt-1">These tags don't match any CSV column: <strong>{missing.join(', ')}</strong></p>
                        </div>
                      ) : null; })()}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 4: Staging Pipeline */}
            <div className="border rounded-xl dark:border-gray-700 overflow-hidden">
              <button type="button" onClick={() => toggleSection('staging')} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheckSquare} className={formData.channel === 'social' ? 'text-emerald-500' : 'text-blue-500'} />
                  {formData.channel === 'social' ? 'Interaction Pipeline & Automation' : 'Staging Pipeline & Delivery Settings'}
                </h3>
                <FontAwesomeIcon icon={expandedSection === 'staging' ? faChevronDown : faChevronRight} className="text-gray-400" />
              </button>
              {expandedSection === 'staging' && (
                <div className="p-4 space-y-4">
                  {formData.channel === 'social' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Automated Social Interaction Hooks</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                          {([
                            ['inbox', 'Inbox reply hook'],
                            ['search', 'Search interact hook'],
                            ['other', 'Profile page activities'],
                          ] as const).map(([val, label]) => (
                            <label key={val} className="flex items-center space-x-2.5 cursor-pointer p-1 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors">
                              <input type="checkbox" className="form-checkbox text-emerald-600 rounded focus:ring-emerald-500 w-4 h-4" checked={(formData.socialInteractionTypes || []).includes(val)} onChange={e => { const checked = e.target.checked; setFormData(prev => { const list = prev.socialInteractionTypes || []; const next = checked ? [...list, val] : list.filter(i => i !== val); return { ...prev, socialInteractionTypes: next as any }; }); }} />
                              <span className="text-xs font-semibold dark:text-gray-300">{label}</span>
                            </label>
                          ))}
                          <label className="flex items-center space-x-2.5 cursor-pointer p-1 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors">
                            <input type="checkbox" className="form-checkbox text-emerald-600 rounded focus:ring-emerald-500 w-4 h-4" checked={formData.shouldSendMessage === true} onChange={e => setFormData(prev => ({ ...prev, shouldSendMessage: e.target.checked }))} />
                            <span className="text-xs font-semibold dark:text-gray-300">Send DM to all CSV profiles</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex justify-between">
                          <span>Targeting handles / Discovery Keywords</span>
                          <span className="text-xxs text-gray-400 font-normal lowercase">Press enter to register tag</span>
                        </label>
                        <input type="text" placeholder="e.g. #SaaSFounder, @elonmusk, copywriting" className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold mb-2" value={socialKeywordInput} onChange={e => setSocialKeywordInput(e.target.value)} onKeyDown={handleAddSocialKeyword} />
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                          {(formData.socialKeywords || []).map(keyword => (
                            <span key={keyword} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                              {keyword}
                              <button type="button" onClick={() => handleRemoveSocialKeyword(keyword)} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200 font-bold ml-0.5 text-xxs w-3 h-3 flex items-center justify-center rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900">×</button>
                            </span>
                          ))}
                          {(formData.socialKeywords || []).length === 0 && <span className="text-xs text-gray-400 italic">No targeting keywords specified. Add some above.</span>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <input type="checkbox" className="form-checkbox text-blue-600 rounded w-4 h-4" checked={formData.validationStaged || false} onChange={e => setFormData(prev => ({ ...prev, validationStaged: e.target.checked }))} />
                          <span className="text-xs font-semibold dark:text-gray-300">Validation</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <input type="checkbox" className="form-checkbox text-blue-600 rounded w-4 h-4" checked={formData.enrichmentStaged || false} onChange={e => setFormData(prev => ({ ...prev, enrichmentStaged: e.target.checked }))} />
                          <span className="text-xs font-semibold dark:text-gray-300">Enrichment</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <input type="checkbox" className="form-checkbox text-blue-600 rounded w-4 h-4" checked={formData.aiPersonalizationStaged || false} onChange={e => setFormData(prev => ({ ...prev, aiPersonalizationStaged: e.target.checked }))} />
                          <span className="text-xs font-semibold dark:text-gray-300">AI Personalization</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <input type="checkbox" className="form-checkbox text-blue-600 rounded w-4 h-4" checked={formData.executeStaged ?? true} onChange={e => setFormData(prev => ({ ...prev, executeStaged: e.target.checked }))} />
                          <span className="text-xs font-semibold dark:text-gray-300">Execute</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <input type="checkbox" className="form-checkbox text-purple-600 rounded w-4 h-4" checked={formData.interactionStaged || false} onChange={e => setFormData(prev => ({ ...prev, interactionStaged: e.target.checked }))} />
                          <span className="text-xs font-semibold dark:text-gray-300">Interaction</span>
                        </label>
                      </div>
                      {formData.interactionStaged && (
                        <div className="animate-fadeIn space-y-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xxs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Stop After (hours)</label>
                              <input type="number" min="1" max="720" className="w-full p-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" value={formData.interactionStopAfterHours || 72} onChange={e => setFormData(prev => ({ ...prev, interactionStopAfterHours: parseInt(e.target.value) || 72 }))} />
                            </div>
                            <div>
                              <label className="block text-xxs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">Max Replies</label>
                              <input type="number" min="1" max="10000" className="w-full p-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" value={formData.interactionMaxReplies || 100} onChange={e => setFormData(prev => ({ ...prev, interactionMaxReplies: parseInt(e.target.value) || 100 }))} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xxs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1.5">
                              Select Accounts for Interaction ({interactionAccountsList.length} COMPLETED)
                            </label>
                            {interactionAccountsList.length === 0 ? (
                              <p className="text-xs text-amber-600 italic bg-amber-50 p-3 rounded-lg dark:bg-amber-950/20 dark:text-amber-400 flex items-start gap-2">
                                <FontAwesomeIcon icon={faInfoCircle} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <span>No COMPLETED email accounts found. Complete a browser session first.</span>
                              </p>
                            ) : (
                              <div className="space-y-1.5 max-h-32 overflow-y-auto border p-2 rounded-lg dark:border-purple-700 dark:bg-gray-900/40">
                                {interactionAccountsList.map((acc: any) => (
                                  <label key={acc.accountId} className="flex items-center space-x-2.5 cursor-pointer p-1 rounded hover:bg-white dark:hover:bg-gray-700/40 transition-colors">
                                    <input
                                      type="checkbox"
                                      className="form-checkbox text-purple-600 rounded focus:ring-purple-500 w-3.5 h-3.5"
                                      checked={(formData.interactionAccounts || []).includes(acc.accountId)}
                                      onChange={e => {
                                        const checked = e.target.checked;
                                        setFormData(prev => {
                                          const current = prev.interactionAccounts || [];
                                          const next = checked
                                            ? [...current, acc.accountId]
                                            : current.filter((id: string) => id !== acc.accountId);
                                          return { ...prev, interactionAccounts: next };
                                        });
                                      }}
                                    />
                                    <span className="text-xs dark:text-gray-200 font-semibold text-gray-800">
                                      {acc.email}
                                      <span className="text-xxs text-gray-400 font-normal ml-1.5 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{acc.type}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {formData.aiPersonalizationStaged && (
                        <div className="animate-fadeIn">
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1.5">Mail-Merge prompt</label>
                          <textarea placeholder="Define personalized instructions using columns like {{first_name}} and {{company}} (e.g. Write a custom icebreaker about their company {{company}} in a friendly tone, vary subject lines)" className="w-full p-2.5 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[80px]" value={formData.aiPersonalizationPrompt || ''} onChange={e => setFormData(prev => ({ ...prev, aiPersonalizationPrompt: e.target.value }))} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Review & Save */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Campaign Summary Card */}
            <div className="bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 p-5 rounded-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-2 dark:border-gray-600">
                <h3 className="font-bold text-gray-950 dark:text-white">Outline Strategy Preview</h3>
                <button
                  onClick={() => setStep(2)}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-semibold"
                >
                  <FontAwesomeIcon icon={faEdit} className="w-3.5 h-3.5 mr-1" />
                  Edit
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-gray-400 font-medium">Name</p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{formData.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Channel Type</p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5 capitalize">{formData.channel} campaign</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Project Source</p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">
                    {projectsList.find((p: any) => p.projectId === formData.projectId)?.title || formData.projectId || 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Outreach Accounts</p>
                  <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{(formData.accounts || []).length} logged-in profiles</p>
                </div>

                {formData.channel === 'email' ? (
                  <>
                    <div>
                      <p className="text-gray-400 font-medium">Delivery Mode</p>
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5 capitalize">{formData.deliveryMethod} rotation</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Rotative SMTP Pool</p>
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{(formData.smtpSettings || []).length} servers</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-gray-400 font-medium">Pipeline Stages</p>
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5 leading-relaxed">
                        {formData.validationStaged ? '✓ Validation ' : ''}
                        {formData.enrichmentStaged ? '✓ Enrichment ' : ''}
                        {formData.aiPersonalizationStaged ? '✓ AI Personalization ' : ''}
                        {(formData.executeStaged ?? true) ? '✓ Execute ' : ''}
                        {formData.interactionStaged ? `✓ Interaction (${formData.interactionStopAfterHours || 72}h / ${formData.interactionMaxReplies || 100} replies) ` : ''}
                        {!formData.validationStaged && !formData.enrichmentStaged && !formData.aiPersonalizationStaged && !(formData.executeStaged ?? true) && !formData.interactionStaged ? 'No stages selected' : ''}
                      </p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-gray-400 font-medium">Base Subject Line</p>
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">{formData.subject}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-gray-400 font-medium">Active Interaction Hooks</p>
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5 capitalize leading-relaxed">
                        {(formData.socialInteractionTypes || []).join(', ') || 'No interaction hooks selected'}
                      </p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-gray-400 font-medium">Discovery Keywords / Handles</p>
                      <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5 leading-relaxed">
                        {(formData.socialKeywords || []).join(', ') || 'None specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Send DM to CSV Profiles</p>
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">
                        {formData.shouldSendMessage ? '✓ Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </>
                )}

                <div className="col-span-1 sm:col-span-2">
                  <p className="text-gray-400 font-medium">Outreach injection Target Link</p>
                  <p className="font-bold text-sm text-blue-600 dark:text-blue-400 mt-0.5 font-mono">
                    {formData.linkId ? `Linked via ${formData.linkType}: ${
                      formData.linkType === 'project'
                        ? projectsList.find((p: any) => p.projectId === formData.linkId)?.title || formData.linkId
                        : redirectsList.find((r: any) => r.redirectId === formData.linkId)?.title || formData.linkId
                    }` : 'No redirect tracking injected'}
                  </p>
                </div>

                {formData.interactionStaged && (
                  <div className="col-span-1 sm:col-span-2">
                    <p className="text-gray-400 font-medium">Selected Interaction Accounts</p>
                    {(formData.interactionAccounts || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {(formData.interactionAccounts || []).map((accId: string) => {
                          const acc = interactionAccountsList.find((a: any) => a.accountId === accId);
                          return (
                            <span key={accId} className="inline-flex items-center gap-1.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full">
                              <span className="font-mono">{acc?.email || accId}</span>
                              <span className="text-[10px] bg-purple-200 dark:bg-purple-800/50 px-1 rounded">{acc?.type || 'unknown'}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="font-bold text-sm text-gray-900 dark:text-white mt-0.5">No accounts selected</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CSV Data Preview */}
            {csvAnalytics && (
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border dark:border-gray-600 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-gray-950 dark:text-white">Contacts Database Preview</h3>
                  {!isEditing && (
                    <button
                      onClick={() => setStep(1)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-semibold"
                    >
                      <FontAwesomeIcon icon={faEdit} className="w-3.5 h-3.5 mr-1" />
                      Reupload
                    </button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs text-gray-700 dark:text-gray-200">Total list size: <strong>{csvAnalytics.totalRows} contacts</strong></p>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p className="font-semibold">Detected CSV Schema:</p>
                    <p className="font-mono text-xxs dark:text-gray-300 mt-0.5 bg-white dark:bg-gray-800 p-1.5 rounded-lg border dark:border-gray-700">{csvAnalytics.headers.join(', ')}</p>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto border dark:border-gray-600 rounded-xl">
                  <table className="min-w-full text-xxs">
                    <thead className="bg-gray-100 dark:bg-gray-600">
                      <tr>
                        {csvAnalytics.headers.map(header => (
                          <th key={header} className="px-3 py-1.5 text-left font-bold text-gray-700 dark:text-white border-b dark:border-gray-600">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvAnalytics.preview.slice(0, 3).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          {csvAnalytics.headers.map(header => (
                            <td key={header} className="px-3 py-1.5 border-t dark:border-gray-600 dark:text-gray-300">{row[csvAnalytics.headers.indexOf(header)]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xxs text-gray-400 mt-2 px-3 pb-2 dark:text-gray-500">Showing first 3 rows preview</p>
                </div>
              </div>
            )}

            {isEditing ? (
              <div className="bg-amber-50/30 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-100/50 dark:border-amber-900/30 flex items-start space-x-3 text-xs text-amber-700 dark:text-amber-300">
                <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Updating Campaign Settings</p>
                  <p className="leading-relaxed">Changes will be saved to this existing campaign. The campaign will remain in <strong>{campaignToEdit?.status || 'draft'}</strong> status.</p>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50/30 dark:bg-blue-950/10 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30 flex items-start space-x-3 text-xs text-blue-700 dark:text-blue-300">
                <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Creation in Draft Mode Recommended</p>
                  <p className="leading-relaxed">This campaign will save as a <strong>draft</strong>, allowing you to trigger staged list verification, enrich missing leads, and pre-compile custom AI subject lines before activating and starting to send.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 border-t pt-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 text-xs font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {isEditing ? (
              step === 3 && (
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-bold text-xs"
                >
                  Back
                </button>
              )
            ) : step > 0 && (
              <button
                onClick={() => {
                  if (step === 2 && formData.id && csvAnalytics) {
                    setStep(0);
                  } else {
                    setStep(prev => prev - 1);
                  }
                }}
                className="px-4 py-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-bold text-xs"
              >
                Back
              </button>
            )}
            
            {step === 0 ? (
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
              >
                Continue Setup
              </button>
            ) : step < 3 ? (
              <button
                onClick={() => {
                  if (step === 2) {
                    if (!formData.name) {
                      alert('Please input a campaign name to proceed.');
                      return;
                    }
                    if (formData.deliveryMethod !== 'smtp' && !formData.projectId) {
                      alert('Please select a WebFixx Project to proceed.');
                      return;
                    }
                    if (formData.channel === 'email' && !formData.subject) {
                      alert('Please input an email subject line to proceed.');
                      return;
                    }
                    if ((formData.channel === 'social' || formData.deliveryMethod !== 'smtp') && (!formData.accounts || formData.accounts.length === 0)) {
                      alert('Please select at least one active profile/account to proceed.');
                      return;
                    }
                  }
                  setStep(prev => prev + 1);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                disabled={loading}
              >
                Next
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const validationError = validateCampaignCreation(formData);
                    if (validationError) {
                      const errorMessage = getValidationErrorMessage(validationError);
                      alert(errorMessage);
                      return;
                    }
                    if (!isEditing && !isFeatureEnabled(appData, 'allowCampaignCreation')) {
                      alert(featureDisabledMessage('allowCampaignCreation', 'campaign creation'));
                      return;
                    }
                    onSave({ ...formData, status: 'draft', isSetupComplete: true });
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                  disabled={loading}
                >
                  {isEditing ? 'Save Changes' : 'Create Staged Campaign (Draft)'}
                </button>
                {isEditing && (campaignToEdit?.status === 'draft' || formData.status === 'draft') && (campaignToEdit?.isSetupComplete || formData.isSetupComplete) && (
                  <button
                    onClick={() => {
                      if (!isFeatureEnabled(appData, 'allowShooting')) {
                        alert(featureDisabledMessage('allowShooting', 'campaign execution'));
                        return;
                      }
                      setShowExecuteConfirm(true);
                    }}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm"
                    disabled={loading}
                  >
                    Execute Pipeline
                  </button>
                )}
                <ConfirmationModal
                  isOpen={showExecuteConfirm}
                  onClose={() => setShowExecuteConfirm(false)}
                  onConfirm={async () => {
                    setShowExecuteConfirm(false);
                    try {
                      const data: any = await securedApi.callBackendFunction({
                        functionName: 'runCampaignPipeline',
                        campaignId: campaignToEdit?.id
                      });
                      if (data.success) {
                        onSave({ ...formData, status: 'running', isSetupComplete: true });
                      } else {
                        alert(data.message || data.error || 'Failed to start pipeline');
                      }
                    } catch (err: any) {
                      alert(err?.message || 'Failed to start pipeline');
                    }
                  }}
                  title="Start Pipeline?"
                  message="This will start executing the campaign pipeline (sending emails / running interactions). This action cannot be undone. Continue?"
                  confirmText={loading ? 'Starting...' : 'Start Pipeline'}
                  cancelText="Cancel"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

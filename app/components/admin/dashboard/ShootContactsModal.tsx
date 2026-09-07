"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperPlane, faRobot, faPen, faQuestionCircle, faCheck,
  faChevronRight, faChevronLeft, faSpinner, faCheckCircle,
  faTimesCircle, faClock, faPause, faPlay, faStop,
  faExclamationTriangle, faEnvelope, faLink, faBrain, faEye
} from '@fortawesome/free-solid-svg-icons';

interface Contact {
  name?: string;
  email?: string;
  phone?: string | number;
  company?: string;
  platform?: string;
  username?: string;
}

interface AIContext {
  relationshipType: string;
  threadCount: number;
  lastInteraction: string;
  daysSinceLastInteraction: number;
}

interface DraftData {
  subject: string;
  body: string;
  context?: AIContext;
  status: 'pending' | 'composing' | 'ready' | 'edited' | 'skipped' | 'failed';
  error?: string;
}

interface SendResult {
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'rate_limited';
  sentAt?: string;
  error?: string;
  retryCount?: number;
}

interface ShootContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    id: string;
    selectedContacts: Contact[];
    subject: string;
    body: string;
    method: 'ai' | 'manual';
    mailMerge: boolean;
    linkType?: 'project' | 'redirect' | 'none';
    linkId?: string;
  }) => Promise<void>;
  onComposeAI?: (contactEmail: string, linkType?: string, linkId?: string) => Promise<{
    subject: string;
    body: string;
    context?: AIContext;
  } | null>;
  loading?: boolean;
  composingAI?: boolean;
  item?: any;
  category?: 'WIRE' | 'SOCIAL';
  projectsList?: Array<{ projectId: string; title: string }>;
  redirectsList?: Array<{ redirectId: string; title: string }>;
}

const safeParseJSON = (jsonString: string) => {
  try {
    return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch {
    return [];
  }
};

const MERGE_VARIABLES = [
  { var: '{{firstName}}', desc: 'Contact first name' },
  { var: '{{lastName}}', desc: 'Contact last name' },
  { var: '{{email}}', desc: 'Contact email' },
  { var: '{{company}}', desc: 'Contact company' },
];

const RELATIONSHIP_BADGES: Record<string, { color: string; label: string }> = {
  cold: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Cold' },
  warm: { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Warm' },
  followup: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', label: 'Follow-up' },
  reengagement: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'Re-engagement' },
};

const WIZARD_STEPS = [
  { key: 'select', label: 'Select', icon: faEnvelope },
  { key: 'link', label: 'Link', icon: faLink },
  { key: 'analyze', label: 'Analyze', icon: faBrain },
  { key: 'review', label: 'Review', icon: faEye },
  { key: 'send', label: 'Send', icon: faPaperPlane },
] as const;

type StepKey = typeof WIZARD_STEPS[number]['key'];

export const ShootContactsModal = ({
  isOpen,
  onClose,
  onSubmit,
  onComposeAI,
  loading,
  composingAI,
  item,
  category,
  projectsList = [],
  redirectsList = [],
}: ShootContactsModalProps) => {
  const [step, setStep] = useState<StepKey>('select');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [method, setMethod] = useState<'ai' | 'manual'>('manual');
  const [mailMerge, setMailMerge] = useState(true);
  const [showVars, setShowVars] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Link selection
  const [linkType, setLinkType] = useState<'project' | 'redirect' | 'none'>('none');
  const [linkId, setLinkId] = useState('');

  // AI analysis state
  const [drafts, setDrafts] = useState<Record<number, DraftData>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

  // Send state
  const [results, setResults] = useState<Record<number, SendResult>>({});
  const [sending, setSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });

  // Refs for cleanup
  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const stopRef = useRef(false);

  const contacts = useMemo(() => {
    if (!item) return [];
    if (category === 'WIRE') {
      const extract = safeParseJSON(item.wireExtract || '{}');
      return extract.contacts || [];
    }
    if (category === 'SOCIAL') {
      const extracts = safeParseJSON(item.socialExtract || '[]');
      const all: Contact[] = [];
      for (const acc of Array.isArray(extracts) ? extracts : []) {
        const details = acc.extractedDetails || {};
        const followers = details.followers || details.contacts || [];
        for (const f of followers) {
          all.push({
            name: f.fullName || f.name || '',
            email: f.email || '',
            phone: f.phone || '',
            platform: acc.platform || '',
            username: f.username || '',
            company: '',
          });
        }
      }
      return all;
    }
    return [];
  }, [item, category]);

  const selectedContacts = useMemo(() => {
    return Array.from(selectedIds).map(i => contacts[i]).filter(Boolean);
  }, [selectedIds, contacts]);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedIds(new Set());
    setSelectAll(false);
    setMethod('manual');
    setMailMerge(true);
    setShowVars(false);
    setSubject('');
    setBody('');
    setLinkType('none');
    setLinkId('');
    setDrafts({});
    setAnalyzing(false);
    setAnalysisProgress({ current: 0, total: 0 });
    setResults({});
    setSending(false);
    setIsPaused(false);
    setIsStopped(false);
    setSendProgress({ sent: 0, failed: 0, total: 0 });
    abortRef.current = false;
    pauseRef.current = false;
    stopRef.current = false;
  }, []);

  useEffect(() => {
    if (isOpen) resetState();
  }, [isOpen, resetState]);

  useEffect(() => {
    if (contacts.length > 0 && selectAll) {
      setSelectedIds(new Set(contacts.map((_: any, i: number) => i)));
    } else if (!selectAll) {
      setSelectedIds(new Set());
    }
  }, [selectAll, contacts.length]);

  if (!isOpen) return null;

  const toggleSelect = (index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => setSelectAll(!selectAll);

  // Compute steps based on mode
  const activeSteps = method === 'manual'
    ? WIZARD_STEPS.filter(s => s.key === 'select' || s.key === 'send')
    : WIZARD_STEPS;

  const currentStepIdx = activeSteps.findIndex(s => s.key === step);

  const canGoNext = () => {
    if (step === 'select') return selectedIds.size > 0;
    if (step === 'link') return true;
    if (step === 'analyze') return Object.values(drafts).some(d => d.status === 'ready' || d.status === 'edited');
    if (step === 'review') return true;
    return false;
  };

  const goNext = () => {
    if (step === 'select' && method === 'ai') {
      setStep('link');
    } else if (step === 'select' && method === 'manual') {
      setStep('send');
    } else if (step === 'link') {
      setStep('analyze');
      startAnalysis();
    } else if (step === 'analyze') {
      setStep('review');
    } else if (step === 'review') {
      setStep('send');
    }
  };

  const goBack = () => {
    if (step === 'link') setStep('select');
    else if (step === 'analyze') setStep('link');
    else if (step === 'review') setStep('analyze');
    else if (step === 'send' && method === 'manual') setStep('select');
    else if (step === 'send') setStep('review');
  };

  // ==================== AI Analysis ====================

  const startAnalysis = async () => {
    if (!onComposeAI) return;
    setAnalyzing(true);
    const selected = Array.from(selectedIds).map(i => contacts[i]).filter(c => c?.email);
    setAnalysisProgress({ current: 0, total: selected.length });

    // Initialize all as pending
    const initialDrafts: Record<number, DraftData> = {};
    Array.from(selectedIds).forEach(i => {
      initialDrafts[i] = { subject: '', body: '', status: 'pending' };
    });
    setDrafts(initialDrafts);

    for (let idx = 0; idx < selected.length; idx++) {
      if (stopRef.current) break;
      while (pauseRef.current && !stopRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (stopRef.current) break;

      const contact = selected[idx];
      const originalIdx = Array.from(selectedIds)[idx];

      // Mark as composing
      setDrafts(prev => ({
        ...prev,
        [originalIdx]: { ...prev[originalIdx], status: 'composing' }
      }));
      setAnalysisProgress({ current: idx + 1, total: selected.length });

      try {
        const result = await onComposeAI(
          contact.email!,
          linkType !== 'none' ? linkType : undefined,
          linkId || undefined
        );

        if (result) {
          setDrafts(prev => ({
            ...prev,
            [originalIdx]: {
              subject: result.subject,
              body: result.body,
              context: result.context,
              status: 'ready',
            }
          }));
        } else {
          setDrafts(prev => ({
            ...prev,
            [originalIdx]: {
              ...prev[originalIdx],
              status: 'failed',
              error: 'AI failed to generate message'
            }
          }));
        }
      } catch (err: any) {
        setDrafts(prev => ({
          ...prev,
          [originalIdx]: {
            ...prev[originalIdx],
            status: 'failed',
            error: err?.message || 'Compose failed'
          }
        }));
      }
    }

    setAnalyzing(false);
  };

  // ==================== Send Logic ====================

  const handleSend = async () => {
    setSending(true);
    setIsPaused(false);
    setIsStopped(false);
    pauseRef.current = false;
    stopRef.current = false;

    const contactsToSend = method === 'manual'
      ? selectedContacts
      : selectedContacts.filter((_, i) => {
          const idx = Array.from(selectedIds)[i];
          const draft = drafts[idx];
          return draft && (draft.status === 'ready' || draft.status === 'edited') && draft.subject;
        });

    const total = contactsToSend.length;
    setSendProgress({ sent: 0, failed: 0, total });

    // Initialize results
    const initialResults: Record<number, SendResult> = {};
    Array.from(selectedIds).forEach(i => {
      initialResults[i] = { status: 'pending' };
    });
    setResults(initialResults);

    let sent = 0;
    let failed = 0;

    for (let idx = 0; idx < contactsToSend.length; idx++) {
      if (stopRef.current) break;
      while (pauseRef.current && !stopRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (stopRef.current) break;

      const contact = contactsToSend[idx];
      const originalIdx = Array.from(selectedIds).find(i => contacts[i]?.email === contact.email) ?? idx;

      // Mark as sending
      setResults(prev => ({
        ...prev,
        [originalIdx]: { status: 'sending' }
      }));

      // Determine subject/body
      let sendSubject = subject;
      let sendBody = body;
      if (method === 'ai') {
        const draft = drafts[originalIdx];
        if (draft?.status === 'skipped') {
          setResults(prev => ({
            ...prev,
            [originalIdx]: { status: 'sent', sentAt: new Date().toISOString() }
          }));
          sent++;
          setSendProgress({ sent, failed, total });
          continue;
        }
        sendSubject = draft?.subject || '';
        sendBody = draft?.body || '';
      }

      try {
        await onSubmit({
          id: item?.id || '',
          selectedContacts: [contact],
          subject: sendSubject,
          body: sendBody,
          method,
          mailMerge,
          linkType: linkType !== 'none' ? linkType : undefined,
          linkId: linkId || undefined,
        });

        setResults(prev => ({
          ...prev,
          [originalIdx]: { status: 'sent', sentAt: new Date().toISOString() }
        }));
        sent++;
      } catch (err: any) {
        const errorMsg = err?.message || 'Send failed';
        const isRateLimit = errorMsg.toLowerCase().includes('rate') || errorMsg.toLowerCase().includes('limit');

        if (isRateLimit) {
          setResults(prev => ({
            ...prev,
            [originalIdx]: {
              status: 'rate_limited',
              error: 'Rate limited, retrying in 60s...',
              retryCount: (prev[originalIdx]?.retryCount || 0) + 1,
            }
          }));

          // Auto-retry after cooldown
          await new Promise(r => setTimeout(r, 60000));
          if (stopRef.current) break;

          try {
            await onSubmit({
              id: item?.id || '',
              selectedContacts: [contact],
              subject: sendSubject,
              body: sendBody,
              method,
              mailMerge,
              linkType: linkType !== 'none' ? linkType : undefined,
              linkId: linkId || undefined,
            });
            setResults(prev => ({
              ...prev,
              [originalIdx]: { status: 'sent', sentAt: new Date().toISOString() }
            }));
            sent++;
          } catch {
            setResults(prev => ({
              ...prev,
              [originalIdx]: { status: 'failed', error: 'Failed after retry' }
            }));
            failed++;
          }
        } else {
          setResults(prev => ({
            ...prev,
            [originalIdx]: { status: 'failed', error: errorMsg }
          }));
          failed++;
        }
      }

      setSendProgress({ sent, failed, total });

      // Delay between sends (30-60s)
      if (idx < contactsToSend.length - 1 && !stopRef.current) {
        await new Promise(r => setTimeout(r, 30000 + Math.random() * 30000));
      }
    }

    setSending(false);
  };

  const handlePause = () => {
    setIsPaused(true);
    pauseRef.current = true;
  };

  const handleResume = () => {
    setIsPaused(false);
    pauseRef.current = false;
  };

  const handleStop = () => {
    setIsStopped(true);
    stopRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
  };

  // ==================== Render Helpers ====================

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      {activeSteps.map((s, i) => {
        const isActive = s.key === step;
        const isCompleted = activeSteps.findIndex(x => x.key === step) > i;
        return (
          <div key={s.key} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : isCompleted
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>
              {isCompleted ? (
                <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
              ) : (
                <FontAwesomeIcon icon={s.icon} className="w-3 h-3" />
              )}
            </div>
            <span className={`ml-1 text-xs font-medium hidden sm:inline ${
              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {s.label}
            </span>
            {i < activeSteps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${
                isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderContactTable = (readonly = false) => (
    <div className="overflow-x-auto border rounded dark:border-gray-600 max-h-64 overflow-y-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
          <tr>
            {!readonly && (
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Email</th>
            {category === 'SOCIAL' && (
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Handle</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {contacts.map((contact: any, index: number) => (
            <tr key={index} className={`dark:text-gray-200 ${
              readonly && !selectedIds.has(index) ? 'opacity-40' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
              {!readonly && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(index)}
                    onChange={() => toggleSelect(index)}
                    className="rounded"
                  />
                </td>
              )}
              <td className="px-4 py-3 text-sm">{contact.name || '—'}</td>
              <td className="px-4 py-3 text-sm">{contact.email || '—'}</td>
              {category === 'SOCIAL' && (
                <td className="px-4 py-3 text-sm">{contact.username || '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ==================== Step Renderers ====================

  const renderStepSelect = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Send Method</label>
        <div className="flex space-x-3">
          <button
            onClick={() => setMethod('manual')}
            className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
              method === 'manual'
                ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faPen} className="mr-2" />
            Manual
          </button>
          <button
            onClick={() => setMethod('ai')}
            className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
              method === 'ai'
                ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:border-purple-400 dark:text-purple-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faRobot} className="mr-2" />
            AI-Decided
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {method === 'manual'
            ? 'Write subject and body with {{variables}}. Mail merge replaces variables per contact.'
            : 'AI searches mailbox, analyzes relationship, and generates personalized messages.'}
        </p>
      </div>

      {method === 'manual' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={mailMerge}
                onChange={(e) => setMailMerge(e.target.checked)}
                className="mr-2 rounded"
              />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mail Merge</label>
              <button
                onClick={() => setShowVars(!showVars)}
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
              </button>
            </div>
            {mailMerge && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
                <FontAwesomeIcon icon={faCheck} className="mr-1" />
                Active
              </span>
            )}
          </div>
          {showVars && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
              <p className="font-medium mb-1 dark:text-gray-300">Available variables:</p>
              <div className="grid grid-cols-2 gap-1">
                {MERGE_VARIABLES.map(v => (
                  <div key={v.var} className="dark:text-gray-400">
                    <code className="text-blue-600 dark:text-blue-400">{v.var}</code> — {v.desc}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
              <input
                type="text"
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter message subject (use {{variables}} for mail merge)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Body</label>
              <textarea
                className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter message body (optional, use {{variables}})"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Contacts ({contacts.length} available)
        </label>
        {renderContactTable()}
      </div>
    </div>
  );

  const renderStepLink = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Outreach Link Injection
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select a project or redirect link for AI context. The AI will use this to personalize messages.
        </p>
        <div className="flex space-x-3 mb-3">
          <button
            onClick={() => { setLinkType('project'); setLinkId(''); }}
            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
              linkType === 'project'
                ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Project Link
          </button>
          <button
            onClick={() => { setLinkType('redirect'); setLinkId(''); }}
            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
              linkType === 'redirect'
                ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Redirect Link
          </button>
          <button
            onClick={() => { setLinkType('none'); setLinkId(''); }}
            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
              linkType === 'none'
                ? 'bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            None
          </button>
        </div>
        {linkType === 'project' && (
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">-- Choose Project --</option>
            {projectsList.map((p) => (
              <option key={p.projectId} value={p.projectId}>{p.title}</option>
            ))}
          </select>
        )}
        {linkType === 'redirect' && (
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">-- Choose Redirect --</option>
            {redirectsList.map((r) => (
              <option key={r.redirectId} value={r.redirectId}>{r.title}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" />
          {linkType === 'none'
            ? 'No link selected. AI will compose without link context.'
            : `Selected ${linkType}: ${linkType === 'project'
                ? projectsList.find(p => p.projectId === linkId)?.title || linkId
                : redirectsList.find(r => r.redirectId === linkId)?.title || linkId}`}
        </p>
      </div>
    </div>
  );

  const renderStepAnalyze = () => {
    const readyCount = Object.values(drafts).filter(d => d.status === 'ready' || d.status === 'edited').length;
    const failedCount = Object.values(drafts).filter(d => d.status === 'failed').length;
    const composingCount = Object.values(drafts).filter(d => d.status === 'composing').length;
    const pendingCount = Object.values(drafts).filter(d => d.status === 'pending').length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {analyzing ? (
              <span>
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                Analyzing {analysisProgress.current}/{analysisProgress.total} contacts...
              </span>
            ) : (
              <span>
                {readyCount} ready, {failedCount} failed, {composingCount} composing, {pendingCount} pending
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            {!analyzing && (
              <button
                onClick={startAnalysis}
                className="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                <FontAwesomeIcon icon={faRobot} className="mr-1" />
                Retry Failed
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {Array.from(selectedIds).map(i => {
            const contact = contacts[i];
            const draft = drafts[i];
            if (!contact) return null;

            const badge = draft?.context?.relationshipType
              ? RELATIONSHIP_BADGES[draft.context.relationshipType]
              : null;

            return (
              <div key={i} className={`border rounded-lg p-3 transition-colors ${
                draft?.status === 'ready' || draft?.status === 'edited'
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                  : draft?.status === 'composing'
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
                    : draft?.status === 'failed'
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                      : 'border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {draft?.status === 'composing' && (
                      <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />
                    )}
                    {draft?.status === 'ready' || draft?.status === 'edited' ? (
                      <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                    ) : draft?.status === 'failed' ? (
                      <FontAwesomeIcon icon={faTimesCircle} className="text-red-500" />
                    ) : draft?.status === 'pending' ? (
                      <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                    ) : null}
                    <span className="font-medium text-sm dark:text-white">{contact.email}</span>
                    {badge && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {draft?.context && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {draft.context.threadCount} threads, {draft.context.daysSinceLastInteraction}d ago
                    </span>
                  )}
                </div>

                {(draft?.status === 'ready' || draft?.status === 'edited') && draft.subject && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Subject: {draft.subject}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{draft.body}</p>
                    <div className="mt-2 flex space-x-2">
                      <button
                        onClick={() => {
                          setDrafts(prev => ({
                            ...prev,
                            [i]: { ...prev[i], status: 'skipped' }
                          }));
                        }}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}

                {draft?.status === 'failed' && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{draft.error}</p>
                )}

                {draft?.status === 'composing' && (
                  <p className="mt-1 text-xs text-blue-500 dark:text-blue-400">
                    Searching mailbox and analyzing relationship...
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStepReview = () => {
    const readyDrafts = Object.entries(drafts)
      .filter(([_, d]) => d.status === 'ready' || d.status === 'edited')
      .map(([idx, d]) => ({ idx: parseInt(idx), draft: d }));

    const relationshipCounts = readyDrafts.reduce((acc, { draft }) => {
      const type = draft.context?.relationshipType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {readyDrafts.length} drafts ready
          {Object.entries(relationshipCounts).map(([type, count]) => {
            const badge = RELATIONSHIP_BADGES[type];
            return badge ? (
              <span key={type} className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                {count} {badge.label}
              </span>
            ) : null;
          })}
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {readyDrafts.map(({ idx, draft }) => {
            const contact = contacts[idx];
            const badge = draft.context?.relationshipType
              ? RELATIONSHIP_BADGES[draft.context.relationshipType]
              : null;

            return (
              <div key={idx} className="border rounded-lg p-3 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm dark:text-white">{contact?.email}</span>
                    {badge && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setDrafts(prev => ({
                        ...prev,
                        [idx]: { ...prev[idx], status: 'edited' }
                      }))}
                      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDrafts(prev => ({
                        ...prev,
                        [idx]: { ...prev[idx], status: 'skipped' }
                      }))}
                      className="text-xs px-2 py-1 rounded border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Skip
                    </button>
                  </div>
                </div>
                <p className="text-sm font-medium dark:text-white">{draft.subject}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">{draft.body}</p>
                {draft.context && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Context: {draft.context.threadCount} threads, last interaction {draft.context.daysSinceLastInteraction}d ago
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStepSend = () => {
    const totalResults = Object.keys(results).length;
    const sentCount = Object.values(results).filter(r => r.status === 'sent').length;
    const failedCount = Object.values(results).filter(r => r.status === 'failed').length;
    const rateLimitedCount = Object.values(results).filter(r => r.status === 'rate_limited').length;
    const pendingCount = Object.values(results).filter(r => r.status === 'pending' || r.status === 'sending').length;

    return (
      <div className="space-y-4">
        {sending && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              Sending: {sentCount} sent, {failedCount} failed, {rateLimitedCount} rate-limited, {pendingCount} remaining
            </div>
            <div className="flex space-x-2">
              {!isPaused && !isStopped && (
                <button
                  onClick={handlePause}
                  className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 flex items-center"
                >
                  <FontAwesomeIcon icon={faPause} className="mr-1" />
                  Pause
                </button>
              )}
              {isPaused && (
                <button
                  onClick={handleResume}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                >
                  <FontAwesomeIcon icon={faPlay} className="mr-1" />
                  Resume
                </button>
              )}
              <button
                onClick={handleStop}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center"
                disabled={isStopped}
              >
                <FontAwesomeIcon icon={faStop} className="mr-1" />
                {isStopped ? 'Stopped' : 'Stop'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {Array.from(selectedIds).map(i => {
            const contact = contacts[i];
            const result = results[i];
            const draft = drafts[i];
            if (!contact) return null;

            return (
              <div key={i} className={`border rounded-lg p-3 flex items-center justify-between ${
                result?.status === 'sent'
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                  : result?.status === 'failed'
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                    : result?.status === 'rate_limited'
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                      : result?.status === 'sending'
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center gap-2">
                  {result?.status === 'sent' && <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />}
                  {result?.status === 'failed' && <FontAwesomeIcon icon={faTimesCircle} className="text-red-500" />}
                  {result?.status === 'rate_limited' && <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />}
                  {result?.status === 'sending' && <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />}
                  {(!result || result.status === 'pending') && <FontAwesomeIcon icon={faClock} className="text-gray-400" />}
                  <span className="text-sm dark:text-white">{contact.email}</span>
                  {draft?.status === 'skipped' && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">(skipped)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {result?.status === 'sent' && `Sent at ${new Date(result.sentAt!).toLocaleTimeString()}`}
                  {result?.status === 'failed' && result.error}
                  {result?.status === 'rate_limited' && (
                    <span className="text-amber-600 dark:text-amber-400">{result.error}</span>
                  )}
                  {result?.status === 'sending' && 'Sending...'}
                  {(!result || result.status === 'pending') && (sending ? 'Waiting...' : 'Pending')}
                </div>
              </div>
            );
          })}
        </div>

        {!sending && totalResults > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm">
            <p className="font-medium dark:text-white">Results: {sentCount} sent, {failedCount} failed</p>
            {rateLimitedCount > 0 && (
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                {rateLimitedCount} contacts were rate limited
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 'select': return renderStepSelect();
      case 'link': return renderStepLink();
      case 'analyze': return renderStepAnalyze();
      case 'review': return renderStepReview();
      case 'send': return renderStepSend();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white">
            Shoot Contacts — {category} ({contacts.length} available)
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            ×
          </button>
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No extracted contacts available. Extract the {category === 'WIRE' ? 'box' : 'account'} first.
          </div>
        ) : (
          <>
            {renderStepIndicator()}
            {renderCurrentStep()}

            {/* Navigation */}
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex space-x-3">
                {currentStepIdx > 0 && (
                  <button
                    onClick={goBack}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white flex items-center"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
                    Back
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                >
                  Cancel
                </button>
                {step !== 'send' ? (
                  <button
                    onClick={goNext}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center disabled:opacity-50"
                    disabled={!canGoNext() || loading}
                  >
                    {step === 'select' && method === 'manual' ? (
                      <>
                        <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                        Send
                      </>
                    ) : step === 'review' ? (
                      <>
                        <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                        Send ({selectedContacts.length})
                      </>
                    ) : (
                      <>
                        Next
                        <FontAwesomeIcon icon={faChevronRight} className="ml-2" />
                      </>
                    )}
                  </button>
                ) : !sending && sendProgress.total > 0 ? (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center"
                  >
                    <FontAwesomeIcon icon={faCheck} className="mr-2" />
                    Done
                  </button>
                ) : !sending && sendProgress.total === 0 ? (
                  <button
                    onClick={handleSend}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center disabled:opacity-50"
                    disabled={selectedContacts.length === 0}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                    Send ({selectedContacts.length})
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

"use client";

import { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faRobot, faPen, faQuestionCircle, faCheck } from '@fortawesome/free-solid-svg-icons';

interface ShootContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
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
    method: 'ai' | 'manual';
    mailMerge: boolean;
  }) => Promise<void>;
  onComposeAI?: (contactEmail: string) => Promise<{ subject: string; body: string } | null>;
  loading?: boolean;
  composingAI?: boolean;
  item?: any;
  category?: 'WIRE' | 'SOCIAL';
}

const safeParseJSON = (jsonString: string) => {
  try {
    return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch (error) {
    return [];
  }
};

const MERGE_VARIABLES = [
  { var: '{{firstName}}', desc: 'Contact first name' },
  { var: '{{lastName}}', desc: 'Contact last name' },
  { var: '{{email}}', desc: 'Contact email' },
  { var: '{{company}}', desc: 'Contact company' },
];

export const ShootContactsModal = ({
  isOpen,
  onClose,
  onSubmit,
  onComposeAI,
  loading,
  composingAI,
  item,
  category
}: ShootContactsModalProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [method, setMethod] = useState<'ai' | 'manual'>('manual');
  const [mailMerge, setMailMerge] = useState(true);
  const [showVars, setShowVars] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<Record<number, { subject: string; body: string }>>({});

  const contacts = useMemo(() => {
    if (!item) return [];
    if (category === 'WIRE') {
      const extract = safeParseJSON(item.wireExtract || '{}');
      return extract.contacts || [];
    }
    if (category === 'SOCIAL') {
      const extracts = safeParseJSON(item.socialExtract || '[]');
      const all: any[] = [];
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

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAll(false);
    setSubject('');
    setBody('');
    setMethod('manual');
    setMailMerge(true);
    setAiDrafts({});
  }, [isOpen]);

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

  const toggleSelectAll = () => {
    setSelectAll(!selectAll);
  };

  const handleComposeAIForSelected = async () => {
    if (!onComposeAI) return;
    const selected = Array.from(selectedIds).map(i => contacts[i]).filter(Boolean);
    const newDrafts: Record<number, { subject: string; body: string }> = {};

    for (let i = 0; i < selected.length; i++) {
      const contact = selected[i];
      if (!contact.email) continue;
      const draft = await onComposeAI(contact.email);
      if (draft) {
        const originalIdx = Array.from(selectedIds)[i];
        newDrafts[originalIdx] = draft;
      }
    }

    setAiDrafts(prev => ({ ...prev, ...newDrafts }));

    // Auto-fill subject/body from first AI draft
    const firstDraft = Object.values(newDrafts)[0];
    if (firstDraft) {
      setSubject(firstDraft.subject);
      setBody(firstDraft.body);
    }
  };

  const handleSubmit = async () => {
    const selected = Array.from(selectedIds).map(i => contacts[i]).filter(Boolean);
    if (selected.length === 0) return;
    if (method === 'manual' && !subject.trim()) return;

    await onSubmit({
      id: item?.id || '',
      selectedContacts: selected,
      subject: subject.trim(),
      body: body.trim(),
      method,
      mailMerge,
    });
  };

  const selectedCount = selectedIds.size;

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
            {/* Method Selection */}
            <div className="mb-4">
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
                  ? 'You write the subject and body. Mail merge replaces {{variables}} for each contact.'
                  : 'AI reads the mailbox history with each contact and composes personalized messages.'}
              </p>
            </div>

            {/* Mail Merge Toggle */}
            {method === 'manual' && (
              <div className="mb-4">
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
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
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
              </div>
            )}

            {/* Subject & Body (manual mode) */}
            {method === 'manual' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter message subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Body</label>
                  <textarea
                    className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter message body (optional)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* AI Drafts Display */}
            {method === 'ai' && Object.keys(aiDrafts).length > 0 && (
              <div className="mb-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI Drafts</label>
                {Object.entries(aiDrafts).map(([idx, draft]) => (
                  <div key={idx} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      To: {contacts[parseInt(idx)]?.email}
                    </p>
                    <p className="text-sm font-medium dark:text-white">{draft.subject}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-3">{draft.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Contact Table */}
            <div className="overflow-x-auto border rounded dark:border-gray-600">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Email</th>
                    {category === 'SOCIAL' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">Handle</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {contacts.map((contact: any, index: number) => (
                    <tr key={index} className="dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(index)}
                          onChange={() => toggleSelect(index)}
                          className="rounded"
                        />
                      </td>
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

            {/* Actions */}
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-3">
                {method === 'ai' && onComposeAI && (
                  <button
                    onClick={handleComposeAIForSelected}
                    className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center disabled:opacity-50"
                    disabled={loading || composingAI || selectedCount === 0}
                  >
                    <FontAwesomeIcon icon={faRobot} className="mr-2" />
                    {composingAI ? 'Composing...' : 'Draft with AI'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center disabled:opacity-50"
                  disabled={loading || selectedCount === 0 || (method === 'manual' && !subject.trim())}
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                  {loading ? 'Sending...' : `Shoot ${selectedCount} Contact${selectedCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

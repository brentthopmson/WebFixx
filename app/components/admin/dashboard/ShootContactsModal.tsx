"use client";

import { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

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
  }) => Promise<void>;
  loading?: boolean;
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

export const ShootContactsModal = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  item,
  category
}: ShootContactsModalProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectAll, setSelectAll] = useState(false);

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

  const handleSubmit = async () => {
    const selected = Array.from(selectedIds).map(i => contacts[i]).filter(Boolean);
    if (selected.length === 0 || !subject.trim()) return;
    await onSubmit({
      id: item?.id || '',
      selectedContacts: selected,
      subject: subject.trim(),
      body: body.trim(),
    });
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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

            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedCount} contact{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center disabled:opacity-50"
                  disabled={loading || selectedCount === 0 || !subject.trim()}
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

"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faPhone, faBuilding, faNoteSticky } from '@fortawesome/free-solid-svg-icons';

export interface CollapsibleContactItem {
  name: string;
  email: string;
  lastInteractionDate?: string;
  relationshipSummary?: string;
  interactionCount?: number;
  otherData?: {
    phoneNumbers?: string[];
    company?: string;
    notes?: string;
  };
}

interface CollapsibleContactProps {
  contact: CollapsibleContactItem;
  defaultExpanded?: boolean;
}

export const CollapsibleContact = ({ contact, defaultExpanded = false }: CollapsibleContactProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const otherData = contact.otherData;
  const hasDetails = !!contact.relationshipSummary || !!otherData?.phoneNumbers?.length || !!otherData?.company || !!otherData?.notes;

  return (
    <div className="border rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{contact.name || 'Unknown'}</p>
          {contact.email && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{contact.email}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          {typeof contact.interactionCount === 'number' && contact.interactionCount > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{contact.interactionCount} interactions</span>
          )}
          <FontAwesomeIcon
            icon={expanded ? faChevronUp : faChevronDown}
            className="text-gray-400 dark:text-gray-500"
          />
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm space-y-2 dark:text-gray-300">
          {contact.lastInteractionDate && (
            <p><span className="text-gray-500 dark:text-gray-400">Last contact:</span> {new Date(contact.lastInteractionDate).toLocaleDateString()}</p>
          )}
          {contact.relationshipSummary && (
            <p className="text-gray-600 dark:text-gray-300">{contact.relationshipSummary}</p>
          )}
          {otherData?.phoneNumbers && otherData.phoneNumbers.length > 0 && (
            <p className="flex items-center gap-2">
              <FontAwesomeIcon icon={faPhone} className="w-3.5 text-gray-400" />
              {otherData.phoneNumbers.join(', ')}
            </p>
          )}
          {otherData?.company && (
            <p className="flex items-center gap-2">
              <FontAwesomeIcon icon={faBuilding} className="w-3.5 text-gray-400" />
              {otherData.company}
            </p>
          )}
          {otherData?.notes && (
            <p className="flex items-start gap-2">
              <FontAwesomeIcon icon={faNoteSticky} className="w-3.5 text-gray-400 mt-0.5" />
              {otherData.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

interface CollapsibleContactListProps {
  contacts: CollapsibleContactItem[];
  title?: string;
  maxHeight?: string;
}

export const CollapsibleContactList = ({ contacts, title = 'Contacts', maxHeight }: CollapsibleContactListProps) => {
  const [allExpanded, setAllExpanded] = useState(false);
  if (!contacts?.length) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-700 dark:text-white">{title} ({contacts.length})</h4>
        <button
          onClick={() => setAllExpanded(v => !v)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className={`space-y-2 ${maxHeight ? `overflow-y-auto ${maxHeight}` : ''}`}>
        {contacts.map((contact, index) => (
          <CollapsibleContact key={index} contact={contact} defaultExpanded={allExpanded} />
        ))}
      </div>
    </div>
  );
};

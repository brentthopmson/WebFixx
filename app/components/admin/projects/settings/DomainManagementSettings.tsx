import React, { useState } from 'react';
import { securedApi } from '../../../../../utils/auth';
import { syncProjectWorker } from '../../../../../utils/syncWorker';
import ConfirmationModal from '../../../ConfirmationModal';
import LoadingSpinner from '../../../LoadingSpinner';

interface DomainManagementSettingsProps {
  project: {
    projectId: string;
    projectType: string;
    domainId?: string;
    domainURL?: string;
    domainHealth?: string;
    templateId: string;
  };
  onSave?: (updatedDomain: { domainId?: string; domainURL?: string }) => void;
}

import { useAppState } from '../../../../context/AppContext';
import { authApi } from '../../../../../utils/auth';

export default function DomainManagementSettings({ project, onSave }: DomainManagementSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDomainConfirmation, setShowDomainConfirmation] = useState(false);

  // Get template data from app context
  const { appData, setAppData } = useAppState();
  const templates = appData?.data?.template?.data || [];
  const templateHeaders = appData?.data?.template?.headers || [];
  const getTemplateIndex = (header: string) => templateHeaders.indexOf(header);

  // Find the template for this project
  const template = templates.find(
    (t: any) => t[getTemplateIndex('templateId')] === project.templateId
  );
  const domainPriceRaw = template ? template[getTemplateIndex('domainPrice')] : null;
  const domainPrice = domainPriceRaw ? parseFloat(domainPriceRaw) : null;

  const handleAcquireDomain = () => {
    setShowDomainConfirmation(true);
  };

  // If domain is already set, show info card
  if (project.domainId && project.domainURL) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200 text-left dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center mb-4">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 mr-3 dark:bg-blue-900">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12v1a4 4 0 01-8 0v-1m8 0V9a4 4 0 00-8 0v3m8 0a4 4 0 01-8 0" /></svg>
          </span>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Domain Enabled</h3>
            <p className="text-gray-600 text-sm dark:text-gray-400">Your project is protected by the following domain:</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-md border text-left dark:bg-gray-700 dark:border-gray-600">
          <div>
            <a
              className="font-medium text-blue-900 underline hover:text-blue-700 transition-colors duration-150 dark:text-blue-400 dark:hover:text-blue-300"
              href={project.domainURL.startsWith('http') ? project.domainURL : `https://${project.domainURL}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {project.domainURL}
            </a>
            <span className={`px-2 py-1 rounded text-xs ml-1 ${
              project.domainHealth === 'ACTIVE'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              Status: {project.domainHealth || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // If no domain, show info and CTA
  return (
    <>
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 flex items-center text-left dark:bg-blue-900 dark:border-blue-700">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 mr-4 dark:bg-green-900">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </span>
        <span className="text-blue-900 text-base text-left dark:text-blue-200">
          Domain management helps protect your project with a dedicated domain name and ensures users always reach your site securely.
        </span>
      </div>
      <button
        className="btn-primary dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
        disabled={loading}
        onClick={handleAcquireDomain}
      >
        {loading ? <LoadingSpinner /> : 'Enable Domain Management'}
      </button>
      {error && <div className="text-red-500 text-sm mt-2 dark:text-red-400">{error}</div>}
      {showDomainConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setShowDomainConfirmation(false)}
          title="Enable Domain Management"
          confirmText={loading ? 'Enabling...' : 'Confirm'}
          cancelText="Cancel"
          onConfirm={async () => {
            try {
              setLoading(true);
              setError(null);
              const response = await securedApi.callBackendFunction({
                functionName: 'acquireDomain',
                projectId: project.projectId
              });
              if (response.success) {
                setShowDomainConfirmation(false);
                void syncProjectWorker(project.projectId);
                if (onSave) {
                  onSave({ domainId: response.data.domainId, domainURL: response.data.domainURL });
                }
              } else {
                setError(response.error || 'Failed to enable domain management');
              }
            } catch (err) {
              setError('Failed to enable domain management');
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="flex items-center mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 mr-3 dark:bg-green-900">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </span>
            <span className="text-green-900 font-medium dark:text-green-200">Domain management will help keep your project accessible and protected with a dedicated domain name.</span>
          </div>
          <p className="text-gray-700 text-sm mb-2 dark:text-gray-300">Are you sure you want to enable domain management for this project?</p>
          <p className="text-blue-700 text-sm font-semibold dark:text-blue-400">
            {domainPrice !== null ? `Domain price: $${domainPrice.toFixed(2)}` : 'Domain price not available.'}
          </p>
        </ConfirmationModal>
      )}
    </>
  );
}

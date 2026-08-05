import React, { useState } from 'react';
import { securedApi } from '../../../../../utils/auth';
import ConfirmationModal from '../../../ConfirmationModal';
import LoadingSpinner from '../../../LoadingSpinner';
import { useAppState } from '../../../../context/AppContext';
import { isFeatureEnabled, featureDisabledMessage } from '../../../../../utils/featureFlags';
import { authApi } from '../../../../../utils/auth';

interface LinkData {
  linkId: string;
  linkType: string;
  linkHost: string;
  linkURL: string;
  linkHealth: 'ACTIVE' | 'RED' | 'ERROR' | string;
  linkStatus: string;
}

interface RedirectProtectionSettingsProps {
  project: {
    projectId: string;
    projectType: string;
    redirectId?: string;
    redirectURL?: string;
    redirectHealth?: string;
  };
  onSave?: (updatedRedirect: { redirectId?: string; redirectURL?: string }) => void;
}

export default function RedirectProtectionSettings({ project, onSave }: RedirectProtectionSettingsProps) {
  const { appData, setAppData } = useAppState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [selectedRedirectId, setSelectedRedirectId] = useState<string>('');

  // Get all ACTIVE redirect links
  const redirects = (appData?.data?.redirect?.data || []) as any[];
  const redirectHeaders = appData?.data?.redirect?.headers || [];
  const linkIndex = redirectHeaders.indexOf('link');
  const linkIdIndex = redirectHeaders.indexOf('redirectId');
  const statusIndex = redirectHeaders.indexOf('status');
  const userRole = appData?.user?.role || '';

  const activeRedirects = redirects.filter(r => r[statusIndex] === 'ACTIVE');
  const getLink = (r: any) => r[linkIndex];
  const getId = (r: any) => r[linkIdIndex];

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRedirectId(e.target.value);
    if (!isFeatureEnabled(appData, 'allowRedirectCreation')) {
      setError(featureDisabledMessage('allowRedirectCreation', 'redirect protection'));
      return;
    }
    setShowConfirmationModal(true);
    setError(null); // Clear error on new selection
  };

  // Show current redirect if exists
  if (project.redirectId && project.redirectURL) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200 text-left dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center mb-4">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 mr-3 dark:bg-blue-900">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12v1a4 4 0 01-8 0v-1m8 0V9a4 4 0 00-8 0v3m8 0a4 4 0 01-8 0" /></svg>
          </span>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Redirect Enabled</h3>
            <p className="text-gray-600 text-sm dark:text-gray-400">Your project is protected by the following redirect link:</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-md border text-left dark:bg-gray-700 dark:border-gray-600">
          <div>
            <a
              className="font-medium text-blue-900 underline hover:text-blue-700 transition-colors duration-150 dark:text-blue-400 dark:hover:text-blue-300"
              href={project.redirectURL.startsWith('http') ? project.redirectURL : `https://${project.redirectURL}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {project.redirectURL}
            </a>
            <span className={`px-2 py-1 rounded text-xs ml-1 ${
              project.redirectHealth === 'ACTIVE'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              Status: {project.redirectHealth || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // If no redirect exists, show enable option
  return (
    <>
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 flex items-center text-left dark:bg-blue-900 dark:border-blue-700">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 mr-4 dark:bg-green-900">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </span>
        <span className="text-blue-900 text-base text-left dark:text-blue-200">
          Redirect protection helps safeguard your main project link from malicious redirects and ensures your users always land on the correct destination.
        </span>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select a Redirect Link</label>
        <select
          className="form-select w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          value={selectedRedirectId}
          onChange={handleSelect}
          disabled={loading || activeRedirects.length === 0}
        >
          <option value="" className="dark:bg-gray-700 dark:text-white">{activeRedirects.length === 0 ? 'No active redirects found' : 'Choose a redirect link...'}</option>
          {activeRedirects.map(r => (
            <option value={getId(r)} key={getId(r)} className="dark:bg-gray-700 dark:text-white">{getLink(r)}</option>
          ))}
        </select>
      </div>
      {error && <div className="text-red-500 text-sm mt-2 dark:text-red-400">{error}</div>}
      {showConfirmationModal && selectedRedirectId && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setShowConfirmationModal(false)}
          title="Enable Redirect Protection"
          confirmText={loading ? 'Enabling...' : 'Confirm'}
          cancelText="Cancel"
          onConfirm={async () => {
            try {
              setLoading(true);
              setError(null);
              const response = await securedApi.callBackendFunction({
                functionName: 'acquireRedirect',
                projectId: project.projectId,
                redirectId: selectedRedirectId,
                userRole: userRole
              });
              if (response.success) {
                setShowConfirmationModal(false);
                if (onSave) {
                  onSave({ redirectId: response.data.redirectId, redirectURL: response.data.redirectURL });
                }
              } else {
                let errorMsg = response.error || 'Failed to enable redirect protection';
                if (response.details) {
                  if (typeof response.details === 'object') {
                    errorMsg += ': ' + JSON.stringify(response.details);
                  } else {
                    errorMsg += ': ' + response.details;
                  }
                }
                setError(errorMsg);
                setShowConfirmationModal(false); // Close modal on error
              }
            } catch (err: any) {
              setError(err?.message || 'Failed to enable redirect protection');
              setShowConfirmationModal(false); // Close modal on error
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="flex items-center mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 mr-3 dark:bg-green-900">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </span>
            <span className="text-green-900 font-medium dark:text-green-200">Redirect protection will help keep your main project link safe from hijacking and accidental misdirection.</span>
          </div>
          <p className="text-gray-700 text-sm dark:text-gray-300">Are you sure you want to enable redirect protection for this project?</p>
        </ConfirmationModal>
      )}
    </>
  );
}

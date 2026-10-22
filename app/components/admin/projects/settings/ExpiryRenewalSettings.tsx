import React, { useState } from 'react';
import { securedApi } from '../../../../../utils/auth';
import { syncProjectWorker } from '../../../../../utils/syncWorker';
import ConfirmationModal from '../../../ConfirmationModal';
import LoadingSpinner from '../../../LoadingSpinner';

interface ExpiryRenewalSettingsProps {
  project: {
    projectId: string;
    expiryDate?: string;
  };
  onSave?: (updatedExpiryDate: string) => void;
}

import { useAppState } from '../../../../context/AppContext';
import { authApi } from '../../../../../utils/auth';

export default function ExpiryRenewalSettings({ 
  project, 
  onSave 
}: ExpiryRenewalSettingsProps) {
  const [expiryDate, setExpiryDate] = useState(project.expiryDate || '');

  // Get template data from app context
  const { appData, setAppData } = useAppState();
  const templates = appData?.data?.template?.data || [];
  const templateHeaders = appData?.data?.template?.headers || [];
  const getTemplateIndex = (header: string) => templateHeaders.indexOf(header);

  // Try to find the templateId from appData.projects if possible
  let templateId: string | undefined = undefined;
  const allProjects = appData?.data?.projects?.data || [];
  
  // If allProjects is Project[], then foundProject is also Project
  const foundProject = allProjects.find(p => p.projectId === project.projectId);
  if (foundProject) {
    templateId = foundProject.templateId; // Access by property name
  }

  // Find the template for this project
  const template = templateId ? templates.find((t: any) => t[getTemplateIndex('templateId')] === templateId) : null;
  const renewalPriceRaw = template ? template[getTemplateIndex('renewal')] : null;
  const renewalPrice = renewalPriceRaw ? parseFloat(renewalPriceRaw) : null;

  // Calculate time remaining
  let timeRemaining = '';
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    if (diffMs > 0) {
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      timeRemaining = `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      timeRemaining = 'Expired';
    }
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRenewConfirmation, setShowRenewConfirmation] = useState(false);

  const handleRenewProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await securedApi.callBackendFunction({
        functionName: 'renewProject',
        projectId: project.projectId,
      });

      if (response.success) {
        const newExpiryDate = response.data.newExpiryDate;
        setExpiryDate(newExpiryDate);
        void syncProjectWorker(project.projectId);

        // Update global appData after successful renewal (handled by securedApi.callBackendFunction)

        if (onSave) {
          onSave(newExpiryDate);
        }
        setShowRenewConfirmation(false);
      } else {
        setError(response.error || 'Failed to renew project');
      }
    } catch (error) {
      console.error('Error renewing project:', error);
      setError('Failed to renew project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200 text-left dark:bg-gray-800 dark:border-gray-700">
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Expiry Date</label>
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <span className="text-blue-900 font-semibold dark:text-blue-200">
              {expiryDate ? new Date(expiryDate).toLocaleString() : 'No expiry date set'}
            </span>
            {expiryDate && (
              <span className={`px-2 py-1 rounded text-xs ml-1 ${timeRemaining === 'Expired' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                {timeRemaining === 'Expired' ? 'Expired' : `Time left: ${timeRemaining}`}
              </span>
            )}
            <button
              onClick={() => setShowRenewConfirmation(true)}
              disabled={loading}
              className="btn-primary md:ml-4 dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
            >
              {loading ? 'Processing...' : 'Renew'}
            </button>
          </div>
        </div>
        {error && <div className="text-red-500 text-sm mt-2 dark:text-red-400">{error}</div>}
      </div>

      {/* Confirmation Modal for Renewal */}
      {showRenewConfirmation && (
        <ConfirmationModal 
          isOpen={true}
          onClose={() => setShowRenewConfirmation(false)}
          onConfirm={handleRenewProject}
          title="Renew Project"
          confirmText={loading ? 'Renewing...' : 'Renew'}
          cancelText="Cancel"
        >
          <div className="mb-2">
            <span className="text-green-900 font-medium block mb-1 dark:text-green-200">Renewal will extend your project's usage period.</span>
            <span className="text-blue-700 text-sm font-semibold dark:text-blue-400">
              {renewalPrice !== null ? `Renewal price: $${renewalPrice.toFixed(2)}` : 'Renewal price not available.'}
            </span>
          </div>
          <p className="text-gray-700 text-sm dark:text-gray-300">Are you sure you want to renew this project?</p>
        </ConfirmationModal>
      )}
    </>
  );
}

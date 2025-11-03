import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faChevronUp, 
  faChevronDown,
  faExternalLinkAlt, // For Test button
  faCopy, // For Copy button
  faBell, // For Notify Visits toggle
  faSpinner // For loading state
} from '@fortawesome/free-solid-svg-icons';
import { securedApi } from '../../../../utils/auth'; // Import securedApi
import { useAppState } from '../../../context/AppContext'; // Import useAppState

import { 
  TemplateVariablesSettings, 
  NotificationSettings, 
  RedirectProtectionSettings, 
  ExpiryRenewalSettings, 
  DomainManagementSettings 
} from './settings';

interface Project {
  id: string;
  formId: string;
  projectId: string;
  projectType: string;
  projectTitle: string;
  templateNiche: string;
  templateTitle: string;
  templateType: string;
  pageHealth: string;
  redirectId?: string;
  redirectURL?: string;
  redirectHealth?: string;
  domainId?: string;
  domainURL?: string;
  domainHealth?: string;
  pageVisits: number;
  botVisits: number;
  flaggedVisits: number;
  expiryDate: string;
  response: string;
  email?: string;
  telegramGroupId?: string;
  responseCount: number;
  responses: any[];
  templateVariables: string;
  systemStatus: string;
  pageURL?: string;
  templateId: string;
  links?: any[];
  notifyVisits: boolean; // Added for Notify Visits toggle
}

interface ProjectSettingsModalProps {
  project: Project;
  onClose: () => void;
  onSave?: (updatedProject: Partial<Project>) => void;
}

export default function ProjectSettingsModal({ project, onClose, onSave }: ProjectSettingsModalProps) {
  const { setAppData } = useAppState(); // Destructure setAppData
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [isNotifyingVisits, setIsNotifyingVisits] = useState(project.notifyVisits);
  const [isTogglingNotify, setIsTogglingNotify] = useState(false); // Loading state for toggle

  const handleSave = (section: string, updatedData: Partial<Project>) => {
    if (onSave) {
      onSave(updatedData);
    }
    setOpenSection(null);
  };

  const handleTestPage = () => {
    if (project.pageURL) {
      window.open(project.pageURL, '_blank');
    }
  };

  const handleCopyPageUrl = () => {
    if (project.pageURL) {
      navigator.clipboard.writeText(project.pageURL);
      alert('Page URL copied to clipboard!');
    }
  };

  const handleToggleNotifyVisits = async () => {
    setIsTogglingNotify(true);
    const newNotifyVisitsState = !isNotifyingVisits;
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'visitNotification', // Updated function name as requested
        projectId: project.projectId,
        notifyVisits: newNotifyVisitsState,
      });

      if (response.success) {
        setIsNotifyingVisits(newNotifyVisitsState);
        // The securedApi.callBackendFunction automatically updates appData,
        // so no need to call authApi.updateAppData(setAppData) explicitly here.
        alert(`Notify Visits ${newNotifyVisitsState ? 'enabled' : 'disabled'} successfully!`);
      } else {
        alert(`Failed to update Notify Visits: ${response.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`An unexpected error occurred: ${error.message}`);
    } finally {
      setIsTogglingNotify(false);
    }
  };

  const renderSettingsSection = (title: string, section: string, SettingsComponent: React.ComponentType<any>) => (
    <div className="border rounded-lg dark:border-gray-700">
      <div 
        onClick={() => setOpenSection(openSection === section ? null : section)}
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
      >
        <h3 className="text-lg font-semibold dark:text-white">{title}</h3>
        <FontAwesomeIcon icon={openSection === section ? faChevronUp : faChevronDown} />
      </div>
      {openSection === section && (
        <div className="p-4 border-t dark:border-gray-700">
          <SettingsComponent 
            project={project} 
            onSave={(updatedData: Partial<Project>) => handleSave(section, updatedData)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-75">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-none w-full max-w-2xl mx-4">
        {/* Modal Header */}
        <div className="relative p-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              {project.projectTitle}
            </h2>
            <div className="flex items-center space-x-4">
              {/* Test Button */}
              <button
                onClick={handleTestPage}
                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-300"
                title="Test Page"
                disabled={!project.pageURL}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </button>
              {/* Copy Button */}
              <button
                onClick={handleCopyPageUrl}
                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-300"
                title="Copy Page URL"
                disabled={!project.pageURL}
              >
                <FontAwesomeIcon icon={faCopy} />
              </button>
              {/* Close Button */}
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
          {/* Project summary row */}
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 mt-1 text-sm text-gray-700 dark:text-gray-200">
            <span><span className="font-semibold dark:text-gray-300">Template:</span> {project.templateTitle}</span>
            <span><span className="font-semibold dark:text-gray-300">Type:</span> {project.projectType}</span>
            <span><span className="font-semibold dark:text-gray-300">Expiry:</span> {project.expiryDate}</span>
          </div>
        </div>

        {/* Modal Content (scrollable) */}
        <div className="p-4 space-y-4 overflow-y-auto dark:bg-gray-900" style={{ maxHeight: '70vh' }}>
          {/* Notify Visits Toggle */}
          <div className="border rounded-lg dark:border-gray-700">
            <div className="flex justify-between items-center p-4 dark:text-white">
              <h3 className="text-lg font-semibold dark:text-white">Notify Visits</h3>
              <button
                onClick={handleToggleNotifyVisits}
                disabled={isTogglingNotify}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 
                  ${isNotifyingVisits ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-600'} 
                  ${isTogglingNotify ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="sr-only">Enable notifications for visits</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform 
                    ${isNotifyingVisits ? 'translate-x-6' : 'translate-x-1'}`}
                >
                  {isTogglingNotify && <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-500" />}
                </span>
              </button>
            </div>
          </div>

          {renderSettingsSection('Template Variables', 'templateVariables', TemplateVariablesSettings)}
          {renderSettingsSection('Notification Settings', 'notifications', NotificationSettings)}
          {renderSettingsSection('Redirect Protection', 'redirectProtection', RedirectProtectionSettings)}
          {renderSettingsSection('Expiry and Renewal', 'expiry', ExpiryRenewalSettings)}
          {renderSettingsSection('Domain Management', 'domain', DomainManagementSettings)}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t dark:border-gray-700 flex justify-end">
          {/* Removed Cancel button as per user request */}
        </div>
      </div>
    </div>
  );
}

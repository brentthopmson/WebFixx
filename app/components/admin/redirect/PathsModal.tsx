"use client";

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPencilAlt,
  faCopy,
  faExternalLinkAlt,
  faSave, 
} from '@fortawesome/free-solid-svg-icons';
import type { AppState } from '../../../../utils/authTypes';
import { getUserLimits, isRedirectConnectedToProject } from '../../../../utils/helpers';
import { securedApi } from '../../../../utils/auth'; // Import securedApi
import UpgradePlanModal from '../settings/UpgradePlanModal'; // Adjust path as needed

// Type definition for redirect paths
type RedirectPath = {
  path: string;
  redirectURL: string;
  linkHealth: string;
  inboxHealth: string;
  status: string;
  clicks: string;
  blocked: string;
};

interface PathsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppState | null;
  userLimits: ReturnType<typeof getUserLimits>;
  currentRedirectId: string | null;
  currentPaths: RedirectPath[];
  setCurrentPaths: React.Dispatch<React.SetStateAction<RedirectPath[]>>;
  redirectLinks: any[]; // Assuming redirectLinks is an array of any for now
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setResultModalProps: React.Dispatch<React.SetStateAction<{
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    details: {};
  }>>;
  setShowResultModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const PathsModal: React.FC<PathsModalProps> = ({
  isOpen,
  onClose,
  appData,
  userLimits,
  currentRedirectId,
  currentPaths,
  setCurrentPaths,
  redirectLinks,
  isProcessing,
  setIsProcessing,
  setResultModalProps,
  setShowResultModal,
}) => {
  const [newRedirectURL, setNewRedirectURL] = useState('');
  const [editingPathIndex, setEditingPathIndex] = useState<number | null>(null);
  const [editedRedirectURL, setEditedRedirectURL] = useState('');

  const editInputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // State for UpgradePlanModal
  const [showUpgradePlanModal, setShowUpgradePlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null); // State for selected plan

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editInputRef.current && 
        saveButtonRef.current &&
        !editInputRef.current.contains(event.target as Node) &&
        !saveButtonRef.current.contains(event.target as Node)
      ) {
        setEditingPathIndex(null);
        setEditedRedirectURL('');
      }
    };

    if (editingPathIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingPathIndex]);

  if (!isOpen) return null;

  // Helper function to generate full path URL
  const generateFullPathURL = (baseLink: string, path: string) => {
    return `${baseLink}${path}`;
  };

  // URL validation function
  const isValidURL = (url: string): boolean => {
    return url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://');
  };

  // Add new redirect path
  const handleAddRedirectPath = async () => {
    if (!currentRedirectId || !newRedirectURL) return;

    if (!isValidURL(newRedirectURL)) {
      setResultModalProps({
        type: 'error',
        title: 'Invalid URL',
        message: 'Please enter a valid URL starting with http:// or https://',
        details: {}
      });
      setShowResultModal(true);
      return;
    }

    try {
      setIsProcessing(true);
      
      // Prepare the new path object with minimal required fields
      const newPathObj = {
        redirectURL: newRedirectURL,
        linkHealth: 'ACTIVE',
        inboxHealth: 'INBOX'
      };

      const response = await securedApi.callBackendFunction({
        functionName: 'addRedirectEndPages',
        redirectId: currentRedirectId,
        paths: JSON.stringify([newPathObj])
      });

      if (response.success) {
        // Close modal and reset state
        onClose(); // Close the PathsModal
        setNewRedirectURL('');
        // setCurrentRedirectId(null); // This should be handled by parent if needed

        // Show success modal
        setResultModalProps({
          type: 'success',
          title: 'Redirect Path Added',
          message: 'New redirect path successfully added!',
          details: response.data || {}
        });
        setShowResultModal(true);
      } else {
        throw new Error(response.error || 'Failed to add redirect path');
      }
    } catch (error) {

      setResultModalProps({
        type: 'error',
        title: 'Add Path Failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? { 
          errorName: error.name, 
          errorMessage: error.message,
          errorStack: error.stack 
        } : {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle editing a path
  const handleEditPath = (index: number, currentURL: string) => {
    setEditingPathIndex(index);
    setEditedRedirectURL(currentURL);
  };

  // Handle saving an edited path
  const handleSaveEditedPath = async (pathIndex: number, event?: React.MouseEvent) => {
    // Prevent propagation to avoid triggering outside click handler
    event?.stopPropagation();

    // Detailed validation
    if (!currentRedirectId) {
      alert('No redirect ID found. Please reopen the paths modal.');
      return;
    }

    if (!editedRedirectURL) {
      alert('Please enter a redirect URL');
      return;
    }

    if (!isValidURL(editedRedirectURL)) {
      setResultModalProps({
        type: 'error',
        title: 'Invalid URL',
        message: 'Please enter a valid URL starting with http:// or https://',
        details: {}
      });
      setShowResultModal(true);
      return;
    }

    if (pathIndex < 0 || pathIndex >= currentPaths.length) {
      alert('Invalid path selection');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Get the specific path to update
      const pathToUpdate = currentPaths[pathIndex];

      const response = await securedApi.callBackendFunction({
        functionName: 'updateRedirectEndPages',
        redirectId: currentRedirectId,
        path: pathToUpdate.path,
        redirectURL: editedRedirectURL
      });

      if (response.success) {
        // Reset editing state
        setEditingPathIndex(null);
        setEditedRedirectURL('');

        // Directly update the currentPaths state
        setCurrentPaths(prevPaths => 
          prevPaths.map((path, idx) => 
            idx === pathIndex ? { ...path, redirectURL: editedRedirectURL } : path
          )
        );

        // Show success modal
        setResultModalProps({
          type: 'success',
          title: 'Redirect Path Updated',
          message: 'Redirect path successfully updated!',
          details: response.data || {}
        });
        setShowResultModal(true);
      } else {
        throw new Error(response.error || 'Failed to update redirect path');
      }
    } catch (error) {

      setResultModalProps({
        type: 'error',
        title: 'Update Path Failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? { 
          errorName: error.name, 
          errorMessage: error.message,
          errorStack: error.stack 
        } : {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpgradePlanConfirm = () => {
    setShowUpgradePlanModal(false);
  };

  const pathCount = currentPaths.length;
  const pathLimit = userLimits?.redirectPathLimit || 0; // Safely access userLimits

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-black bg-opacity-50 dark:bg-opacity-70">
      <div className="relative w-auto max-w-3xl mx-auto my-6 w-full px-4">
        <div className="relative flex flex-col w-full bg-white dark:bg-gray-800 border-0 rounded-lg shadow-lg dark:shadow-none outline-none focus:outline-none">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-5 border-b border-solid rounded-t dark:border-gray-700">
            <h3 className="text-2xl font-semibold dark:text-white">Redirect Paths</h3>
            <button
              className="text-red-500 hover:text-red-700 bg-transparent border-0 text-3xl font-semibold outline-none focus:outline-none dark:text-red-400 dark:hover:text-red-600"
              onClick={onClose}
            >×</button>
          </div>
          {/* Modal Body */}
          <div className="relative flex-auto p-6 overflow-y-auto max-h-[70vh]">
            {(() => {
              if (!userLimits) {
                return <div className="dark:text-gray-300">No path limits found. Please refresh the page.</div>;
              }

              return (
                <>
                  {/* Path Limits Header */}
                  <div className="mb-6 flex items-center justify-between">
                    <h4 className="text-lg font-medium dark:text-white">Path Management</h4>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      pathCount >= pathLimit ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                    }`}>
                      {pathCount} / {pathLimit} paths used
                    </span>
                  </div>

                  {/* Existing Paths Table (if any) */}
                  {pathCount > 0 && (
                    <div className="mb-4">
                      <h4 className="text-lg font-medium dark:text-white mb-2">Existing Paths</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                              <th className="border p-2 text-left dark:text-gray-300">Redirect URL</th>
                              <th className="hidden md:table-cell border p-2 text-left dark:text-gray-300">Health</th>
                              <th className="hidden md:table-cell border p-2 text-left dark:text-gray-300">Clicks</th>
                              <th className="border p-2 text-left dark:text-gray-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentPaths.map((path, index) => {
                              const currentRedirect = redirectLinks.find((link: any) => link.redirectId === currentRedirectId);
                              const baseLink = currentRedirect?.link || '';
                              const fullPathURL = generateFullPathURL(baseLink, path.path);
                              const { isConnected: isConnectedToProject, projectTitle } = isRedirectConnectedToProject(appData, currentRedirectId || '');
                              return (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <td className="border p-2">
                                    {editingPathIndex === index ? (
                                      <input
                                        type="text"
                                        value={editedRedirectURL}
                                        onChange={(e) => setEditedRedirectURL(e.target.value)}
                                        placeholder="Enter Redirect URL"
                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                        ref={editingPathIndex === index ? editInputRef : null}
                                        disabled={isConnectedToProject || isProcessing} // Disable input if connected to project or processing
                                      />
                                    ) : (
                                      <div className="flex items-center">
                                        {isConnectedToProject ? (
                                          <span className="text-sm text-gray-900 dark:text-white truncate max-w-[250px]">
                                            Connected to {projectTitle || 'Project'}
                                          </span>
                                        ) : (
                                          <span className="text-sm text-gray-900 dark:text-white truncate max-w-[250px]">{path.redirectURL}</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="hidden md:table-cell border p-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                      path.linkHealth === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                      path.linkHealth === 'RED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                      path.linkHealth === 'ERROR' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                      {path.linkHealth}
                                    </span>
                                  </td>
                                  <td className="hidden md:table-cell border p-2">
                                    <span className="text-sm text-gray-900 dark:text-white">{path.clicks || '0'}</span>
                                  </td>
                                  <td className="border p-2">
                                    <div className="flex items-center space-x-2">
                                      {editingPathIndex === index ? (
                                        <button
                                          onClick={(e) => handleSaveEditedPath(index, e)}
                                          disabled={!editedRedirectURL || isProcessing || isConnectedToProject} // Disable save if connected or processing
                                          className={`text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-600 ${
                                            !editedRedirectURL || isProcessing || isConnectedToProject ? 'cursor-not-allowed opacity-50' : ''
                                          }`}
                                          title="Save Path"
                                          ref={editingPathIndex === index ? saveButtonRef : null}
                                        >
                                          <FontAwesomeIcon icon={faSave} className="w-4 h-4" />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleEditPath(index, path.redirectURL)}
                                          className={`text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-600 ${
                                            isConnectedToProject ? 'cursor-not-allowed opacity-50' : '' // Disable edit if connected
                                          }`}
                                          title="Edit Path"
                                          disabled={isConnectedToProject} // Disable edit if connected
                                        >
                                          <FontAwesomeIcon icon={faPencilAlt} className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          const url = generateFullPathURL(baseLink, path.path);
                                          navigator.clipboard.writeText(url);
                                        }}
                                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-600"
                                        title="Copy Full URL"
                                      >
                                        <FontAwesomeIcon icon={faCopy} className="w-4 h-4" />
                                      </button>
                                      <a
                                        href={fullPathURL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-600"
                                        title="Open Full URL"
                                      >
                                        <FontAwesomeIcon icon={faExternalLinkAlt} className="w-4 h-4" />
                                      </a>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Add Path or Upgrade Alert */}
                  {pathCount >= pathLimit ? (
                    <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900 dark:border-yellow-800">
                      <div className="flex items-center mb-2">
                        <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <h4 className="text-lg font-medium text-yellow-800 dark:text-yellow-300">Path Limit Reached</h4>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                        You have reached your maximum limit of {pathLimit} paths for this redirect link. 
                        Upgrade your plan to add more paths.
                      </p>
                      <button
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        onClick={() => setShowUpgradePlanModal(true)} // Trigger UpgradePlanModal
                      >
                        Upgrade Plan
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <h4 className="text-lg font-medium dark:text-white mb-2">Add New Redirect Path</h4>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={newRedirectURL}
                          onChange={(e) => setNewRedirectURL(e.target.value)}
                          placeholder="Enter Redirect URL"
                          className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                        />
                        <button
                          onClick={handleAddRedirectPath}
                          disabled={!newRedirectURL || isProcessing}
                          className={`px-4 py-2 rounded-md text-white font-medium ${
                            !newRedirectURL || isProcessing ? 'bg-gray-400 cursor-not-allowed dark:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'
                          }`}
                        >
                          {isProcessing ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {pathCount} of {pathLimit} paths used
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={showUpgradePlanModal}
        onClose={() => setShowUpgradePlanModal(false)}
        appData={appData}
        userLimits={userLimits}
        onConfirm={handleUpgradePlanConfirm}
        selectedPlan={selectedPlan}
        setSelectedPlan={setSelectedPlan}
        isUpgradingPlan={isProcessing} // Using general processing state for now
      />
    </div>
  );
};

export default PathsModal;

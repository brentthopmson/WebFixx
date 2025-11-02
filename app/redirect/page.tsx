"use client";

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getUserLimits } from '../../utils/helpers';
import { 
  faRedo,
  faPencilAlt,
  faCopy,
  faExternalLinkAlt,
  faEdit, 
  faSave, 
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../context/AppContext';
import { authApi, securedApi } from '../../utils/auth';
import TransactionResultModal from '../components/TransactionResultModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import FundAccountModal from '../components/admin/wallet/FundAccountModal'; // Import the new FundAccountModal
import NoRedirectsView from '../components/admin/redirect/NoRedirectsView';
import CreateRedirectCard from '../components/admin/redirect/CreateRedirectCard';
import ProtectionFeaturesCard from '../components/admin/redirect/ProtectionFeaturesCard';
import RedirectTable from '../components/admin/redirect/RedirectTable';

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

export default function RedirectLinks() {
  const { appData, setAppData } = useAppState();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLinkId, setProcessingLinkId] = useState<string | null>(null);
  const userLimits = getUserLimits(appData);

  // New state for paths modal
  const [showPathsModal, setShowPathsModal] = useState(false);
  const [currentRedirectId, setCurrentRedirectId] = useState<string | null>(null);
  const [currentPaths, setCurrentPaths] = useState<RedirectPath[]>([]);
  const [newRedirectURL, setNewRedirectURL] = useState('');

  // State for creating redirect
  const [newRedirectTitle, setNewRedirectTitle] = useState('');
  const [showCreateRedirectConfirmation, setShowCreateRedirectConfirmation] = useState(false);

  // State for renewing redirect
  const [showRenewConfirmation, setShowRenewConfirmation] = useState(false);
  const [redirectIdToRenew, setRedirectIdToRenew] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Transaction result modal state
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalProps, setResultModalProps] = useState({
    type: 'success' as 'success' | 'error' | 'warning',
    title: '',
    message: '',
    details: {}
  });

  const [showFundAccountModal, setShowFundAccountModal] = useState(false);
  const [fundAccountModalProps, setFundAccountModalProps] = useState({
    requiredAmount: '0.00',
    currentBalance: '0.00',
    shortfall: '0.00',
    message: '',
  });

  const [redirectPrice, setRedirectPrice] = useState<number>(0);
  const [redirectRenewalPrice, setRedirectRenewalPrice] = useState<number>(0);

  useEffect(() => {
    if (appData?.data?.template?.data && appData?.data?.template?.headers) {
      const templateHeaders = appData.data.template.headers;
      const templateData = appData.data.template.data;

      const getTemplateIndex = (header: string) => templateHeaders.indexOf(header);

      const webFixxRedirectTemplate = templateData.find(
        (template: any) => template[getTemplateIndex('name')] === 'WebFixx Redirect'
      );

      if (webFixxRedirectTemplate) {
        const price = parseFloat(webFixxRedirectTemplate[getTemplateIndex('price')] || '0');
        const renewal = parseFloat(webFixxRedirectTemplate[getTemplateIndex('renewal')] || '0');
        setRedirectPrice(price);
        setRedirectRenewalPrice(renewal);
      }
    }
  }, [appData?.data?.template?.data, appData?.data?.template?.headers]);

  // Add new state for editing paths
  const [editingPathIndex, setEditingPathIndex] = useState<number | null>(null);
  const [editedRedirectURL, setEditedRedirectURL] = useState('');

  // Add useRef and useEffect for outside click handling
  const editInputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Handle outside click to cancel editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside both input and save button
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

    // Add event listener when editing
    if (editingPathIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingPathIndex]);

  // Check if user is loaded
  if (!appData?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Transform raw redirect data into a more usable format
  const transformRedirectData = (rawData: any, headers?: string[]) => {
    // If no data, return empty array
    if (!rawData || rawData.length === 0) return [];

    // Use provided headers or fallback to default indices
    const safeHeaders = headers || [
      'id', 'redirectId', 'linkHost', 'link', 'linkGoogleURL', '', 'createdAt', 
      'userId', 'title', 'expiryDate', 'paymentJSON', '', 'updatedAt', 'paths', 
      'clicks', 'blocked', '', 'totalPaid', 'paymentJSON', 'lastCheck', 'status'
    ];

    // If rawData is an object with data property, use that
    const processedData = Array.isArray(rawData) ? rawData : rawData.data || [];

    // Create a mapping of column names to their indices
    const columnIndices = {
      id: safeHeaders.indexOf('id'),
      redirectId: safeHeaders.indexOf('redirectId'),
      platform: safeHeaders.indexOf('linkHost'),
      link: safeHeaders.indexOf('link'),
      linkGoogleURL: safeHeaders.indexOf('linkGoogleURL'),
      timestamp: safeHeaders.indexOf('createdAt'),
      userId: safeHeaders.indexOf('userId'),
      title: safeHeaders.indexOf('title'),
      expiryDate: safeHeaders.indexOf('expiryDate'),
      paths: safeHeaders.indexOf('paths'),
      status: safeHeaders.indexOf('status'),
      clicks: safeHeaders.indexOf('clicks'),
      blocked: safeHeaders.indexOf('blocked'),
      updatedAt: safeHeaders.indexOf('updatedAt')
    };

    // Transform data
    return processedData.map((item: any) => ({
      id: item[columnIndices.id] || '',
      redirectId: item[columnIndices.redirectId] || '',
      platform: item[columnIndices.platform] || '',
      link: item[columnIndices.link] || '',
      linkGoogleURL: item[columnIndices.linkGoogleURL] || '',
      timestamp: item[columnIndices.timestamp] || '',
      userId: item[columnIndices.userId] || '',
      title: item[columnIndices.title] || '', 
      expiryDate: item[columnIndices.expiryDate] || '',
      paths: item[columnIndices.paths] || '[]',
      status: item[columnIndices.status] || 'PENDING',
      clicks: item[columnIndices.clicks] || '0',
      blocked: item[columnIndices.blocked] || '0',
      updatedAt: item[columnIndices.updatedAt] || '',
      // Additional parsing for paths
      parsedPaths: item[columnIndices.paths] ? JSON.parse(item[columnIndices.paths]).map((path: any) => ({
        path: path.path,
        redirectURL: path.redirectURL,
        linkHealth: path.linkHealth,
        inboxHealth: path.inboxHealth,
        clicks: path.clicks
      })) : []
    }));
  };

  // Get redirect links from app state and transform
  const redirectLinks = transformRedirectData(
    appData.data?.redirect?.data || [], 
    appData.data?.redirect?.headers || []
  );

  // Sort redirect links by timestamp in descending order (most recent first)
  const sortedRedirectLinks = [...redirectLinks].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return dateB - dateA; // Descending order
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedRedirectLinks.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentLinks = sortedRedirectLinks.slice(indexOfFirstRow, indexOfLastRow);

  // Pagination controls
  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Helper function to parse paths JSON
  const parsePaths = (pathsString: string): RedirectPath[] => {
    try {
      return JSON.parse(pathsString || '[]');
    } catch {
      return [];
    }
  };

  // Open paths modal
  const handleOpenPathsModal = (redirectId: string, pathsString: string) => {
    setCurrentRedirectId(redirectId);
    const paths = parsePaths(pathsString);
    setCurrentPaths(paths);
    setNewRedirectURL('');
    setShowPathsModal(true);
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
        setShowPathsModal(false);
        setNewRedirectURL('');
        setCurrentRedirectId(null);

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

  // Initiate renew redirect confirmation
  const handleRenewRedirect = (redirectId: string) => {
    setRedirectIdToRenew(redirectId);
    setShowRenewConfirmation(true);
  };

  // Execute renew redirect after confirmation
  const executeRenewRedirect = async () => {
    if (!redirectIdToRenew) return;

    try {
      setIsProcessing(true);
      setProcessingLinkId(redirectIdToRenew); // Set spinner for the specific link

      const response = await securedApi.callBackendFunction({
        functionName: 'renewRedirect',
        redirectId: redirectIdToRenew
      });
    
      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: 'Redirect Renewed',
          message: 'Your redirect link has been successfully renewed!',
          details: {
            redirectId: response.data.redirectId,
            oldExpiryDate: response.data.oldExpiryDate,
            newExpiryDate: response.data.newExpiryDate,
            renewalAmount: response.data.renewalAmount,
            newBalance: `$${appData?.user?.balance ?? ''}` // Use current appData for balance
          }
        });
        setShowResultModal(true);
      } else {
        // Check for insufficient balance error in multiple possible locations
        const errorMessage = response.error || response.details?.error || response.details?.message || response.details?.details?.Message || '';
        if (errorMessage.includes('Insufficient balance')) {
          const currentBalance = parseFloat(appData?.user?.balance ?? '0');
          const requiredAmount = redirectRenewalPrice || 0;
          const shortfall = requiredAmount - currentBalance;
          setFundAccountModalProps({
            requiredAmount: requiredAmount.toFixed(2),
            currentBalance: currentBalance.toFixed(2),
            shortfall: shortfall.toFixed(2),
            message: errorMessage || 'Insufficient balance to renew redirect link.',
          });
          setShowFundAccountModal(true);
        } else {
          setResultModalProps({
            type: 'error',
            title: 'Renewal Failed',
            message: response.error || 'Failed to renew redirect link',
            details: response.details || {}
          });
          setShowResultModal(true);
        }
      }
    } catch (error) {
      // This catch block now only handles truly unexpected errors
      setResultModalProps({
        type: 'error',
        title: 'Unexpected Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
      setProcessingLinkId(null); // Stop spinner
      setShowRenewConfirmation(false); // Close confirmation modal
      setRedirectIdToRenew(null); // Clear redirect ID
    }
  };

  // Confirm create redirect handler
  const confirmCreateRedirect = () => {
    if (!newRedirectTitle.trim()) {
      setResultModalProps({
        type: 'error',
        title: 'Invalid Title',
        message: 'Please enter a title for your redirect link',
        details: {}
      });
      setShowResultModal(true);
      return;
    }
    setShowCreateRedirectConfirmation(true);
  };

  // Create redirect handler
  const handleCreateRedirect = async () => {
    setShowCreateRedirectConfirmation(false); // Close confirmation modal
    // Safely check user balance with optional chaining and default value
    const userBalance = parseFloat(appData?.user?.balance ?? '0');
    
    try {
      setIsProcessing(true);
      const response = await securedApi.callBackendFunction({
        functionName: 'createRedirect',
        title: newRedirectTitle.trim()
      });
    
      if (response.success) {
        // Validate returned data
        if (!response.data?.linkHost || !response.data?.link || (response.data?.linkGoogleURL === undefined || response.data?.linkGoogleURL === null)) {
          throw new Error('Invalid redirect link data received');
        }
    
        setResultModalProps({
          type: 'success',
          title: 'Redirect Created',
          message: 'Your redirect link has been successfully created!',
          details: {
            linkHost: response.data.linkHost,
            link: response.data.link,
            title: newRedirectTitle,
            expiryDate: response.data.expiryDate,
            amount: response.data.amount,
            newBalance: `$${appData?.user?.balance ?? userBalance.toFixed(2)}` // Use current appData for balance
          }
        });
        setShowResultModal(true);

        // Reset title input
        setNewRedirectTitle('');
      } else {
        console.log('API Response (Error):', response); // Log the full error response
        // Check for insufficient balance error in multiple possible locations
        const errorMessage = response.error || response.details?.error || response.details?.message || response.details?.details?.Message || '';
        if (errorMessage.includes('Insufficient balance')) {
          const requiredAmount = redirectPrice || 0;
          const currentBalance = parseFloat(appData?.user?.balance ?? '0');
          const shortfall = Math.max(0, requiredAmount - currentBalance);

          setFundAccountModalProps({
            requiredAmount: requiredAmount.toFixed(2),
            currentBalance: currentBalance.toFixed(2),
            shortfall: shortfall.toFixed(2),
            message: errorMessage || 'Insufficient balance to create redirect link.',
          });
          setShowFundAccountModal(true);
        } else {
          setResultModalProps({
            type: 'error',
            title: 'Creation Failed',
            message: response.error || 'Failed to create redirect link',
            details: response.details || {}
          });
          setShowResultModal(true);
        }
      }
    } catch (error) {
      console.error('Unexpected Error during redirect creation:', error); // Log unexpected errors
      // This catch block now only handles truly unexpected errors (e.g., network issues)
      setResultModalProps({
        type: 'error',
        title: 'Unexpected Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to calculate time remaining
  const calculateTimeRemaining = (expiryDateString: string) => {
    const expiryDate = new Date(expiryDateString);
    const now = new Date();
    const difference = expiryDate.getTime() - now.getTime();

    if (difference <= 0) return 'Expired';

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours} hr${hours !== 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  };

  // Helper function to generate full path URL
  const generateFullPathURL = (baseLink: string, path: string) => {
    return `${baseLink}${path}`;
  };

  return (
    <div className="dark:bg-gray-900 dark:text-gray-100 min-h-screen p-4 md:p-8">
      {redirectLinks.length === 0 ? (
        <NoRedirectsView
          redirectPrice={redirectPrice}
          newRedirectTitle={newRedirectTitle}
          setNewRedirectTitle={setNewRedirectTitle}
          confirmCreateRedirect={confirmCreateRedirect}
          isProcessing={isProcessing}
        />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <CreateRedirectCard
              redirectPrice={redirectPrice}
              newRedirectTitle={newRedirectTitle}
              setNewRedirectTitle={setNewRedirectTitle}
              confirmCreateRedirect={confirmCreateRedirect}
              isProcessing={isProcessing}
            />
            <ProtectionFeaturesCard />
          </div>

          <RedirectTable
            redirectLinks={redirectLinks}
            currentLinks={currentLinks}
            parsePaths={parsePaths}
            handleOpenPathsModal={handleOpenPathsModal}
            calculateTimeRemaining={calculateTimeRemaining}
            handleRenewRedirect={handleRenewRedirect}
            processingLinkId={processingLinkId}
            totalPages={totalPages}
            currentPage={currentPage}
            goToNextPage={goToNextPage}
            goToPreviousPage={goToPreviousPage}
            goToPage={goToPage}
            indexOfFirstRow={indexOfFirstRow}
            indexOfLastRow={indexOfLastRow}
          />
        </>
      )}

      {/* Paths Modal */}
      {showPathsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none bg-black bg-opacity-50 dark:bg-opacity-70">
          <div className="relative w-auto max-w-3xl mx-auto my-6 w-full px-4">
            <div className="relative flex flex-col w-full bg-white dark:bg-gray-800 border-0 rounded-lg shadow-lg dark:shadow-none outline-none focus:outline-none">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-solid rounded-t dark:border-gray-700">
                <h3 className="text-2xl font-semibold dark:text-white">Redirect Paths</h3>
                <button
                  className="text-red-500 hover:text-red-700 bg-transparent border-0 text-3xl font-semibold outline-none focus:outline-none dark:text-red-400 dark:hover:text-red-600"
                  onClick={() => setShowPathsModal(false)}
                >×</button>
              </div>
              {/* Modal Body */}
              <div className="relative flex-auto p-6 overflow-y-auto max-h-[70vh]">
                {(() => {
                  if (!userLimits) {
                    return <div className="dark:text-gray-300">No path limits found. Please refresh the page.</div>;
                  }

                  const pathCount = currentPaths.length;
                  const pathLimit = userLimits.redirectPathLimit;
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
                                          />
                                        ) : (
                                          <div className="flex items-center">
                                            <span className="text-sm text-gray-900 dark:text-white truncate max-w-[250px]">{path.redirectURL}</span>
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
                                              disabled={!editedRedirectURL || isProcessing}
                                              className={`text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-600 ${
                                                !editedRedirectURL || isProcessing ? 'cursor-not-allowed opacity-50' : ''
                                              }`}
                                              title="Save Path"
                                              ref={editingPathIndex === index ? saveButtonRef : null}
                                            >
                                              <FontAwesomeIcon icon={faSave} className="w-4 h-4" />
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleEditPath(index, path.redirectURL)}
                                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-600"
                                              title="Edit Path"
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
                                            href={generateFullPathURL(baseLink, path.path)}
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
                            onClick={() => alert('Upgrade feature coming soon!')}
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
        </div>
      )}

      {/* Transaction Result Modal */}
      <TransactionResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        type={resultModalProps.type}
        title={resultModalProps.title}
        message={resultModalProps.message}
        details={resultModalProps.details}
      />

      {/* Create Redirect Confirmation Modal */}
      {showCreateRedirectConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setShowCreateRedirectConfirmation(false)}
          onConfirm={handleCreateRedirect}
          title="Confirm Redirect Creation"
          message={`Are you sure you want to create a redirect link titled "${newRedirectTitle}"? This will cost $${redirectPrice.toFixed(2)}.`}
          confirmText={isProcessing ? 'Creating...' : 'Confirm'}
          cancelText="Cancel"
          confirmDisabled={isProcessing}
        />
      )}

      {/* Renew Redirect Confirmation Modal */}
      {showRenewConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => {
            setShowRenewConfirmation(false);
            setRedirectIdToRenew(null);
          }}
          onConfirm={executeRenewRedirect}
          title="Confirm Redirect Renewal"
          message={`Are you sure you want to renew this redirect link? This will cost $${redirectRenewalPrice.toFixed(2)}.`}
          confirmText={isProcessing ? 'Renewing...' : 'Confirm Renewal'}
          cancelText="Cancel"
          confirmDisabled={isProcessing}
        />
      )}

      {/* Fund Account Modal */}
      <FundAccountModal
        isOpen={showFundAccountModal}
        onClose={() => setShowFundAccountModal(false)}
        requiredAmount={fundAccountModalProps.requiredAmount}
        currentBalance={fundAccountModalProps.currentBalance}
        shortfall={fundAccountModalProps.shortfall}
        message={fundAccountModalProps.message}
      />
    </div>
  );
}

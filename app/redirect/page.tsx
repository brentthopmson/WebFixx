"use client";

import { useState, useEffect } from 'react';
import { getUserLimits } from '../../utils/helpers';
import { 
  faRedo,
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../context/AppContext';
import { securedApi } from '../../utils/auth';
import TransactionResultModal from '../components/TransactionResultModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmationModal from '../components/ConfirmationModal';
import FundAccountModal from '../components/admin/wallet/FundAccountModal';
import NoRedirectsView from '../components/admin/redirect/NoRedirectsView';
import CreateRedirectCard from '../components/admin/redirect/CreateRedirectCard';
import ProtectionFeaturesCard from '../components/admin/redirect/ProtectionFeaturesCard';
import RedirectTable from '../components/admin/redirect/RedirectTable';
import PathsModal from '../components/admin/redirect/PathsModal'; // Import PathsModal

export default function RedirectLinks() {
  const { appData, setAppData } = useAppState();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLinkId, setProcessingLinkId] = useState<string | null>(null);
  const userLimits = getUserLimits(appData);

  // New state for paths modal
  const [showPathsModal, setShowPathsModal] = useState(false);
  const [currentRedirectId, setCurrentRedirectId] = useState<string | null>(null);
  const [currentPaths, setCurrentPaths] = useState<any[]>([]); // Use any[] for now, type will be handled by PathsModal

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

  // Open paths modal
  const handleOpenPathsModal = (redirectId: string, pathsString: string) => {
    setCurrentRedirectId(redirectId);
    const paths = JSON.parse(pathsString || '[]'); // Parse paths directly here
    setCurrentPaths(paths);
    setShowPathsModal(true);
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
          message: 'Your redirect link has been successfully created! Now, go to the Redirect Paths section to add child links to your parent redirect protection link.',
          details: {
            Title: newRedirectTitle,
            ExpiryDate: response.data.expiryDate,
            Amount: response.data.amount,
            NewBalance: `$${appData?.user?.balance ?? userBalance.toFixed(2)}`
          }
        });
        setShowResultModal(true);

        // Reset title input
        setNewRedirectTitle('');
      } else {
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
        <PathsModal
          isOpen={showPathsModal}
          onClose={() => setShowPathsModal(false)}
          appData={appData}
          userLimits={userLimits}
          currentRedirectId={currentRedirectId}
          currentPaths={currentPaths}
          setCurrentPaths={setCurrentPaths}
          redirectLinks={redirectLinks}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          setResultModalProps={setResultModalProps}
          setShowResultModal={setShowResultModal}
        />
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

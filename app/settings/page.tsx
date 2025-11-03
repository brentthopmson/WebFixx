"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser,
  faLock,
  faShield,
  faKey,
  faTrash,
  faCrown,
  faEdit,
  faSync,
  faSpinner // Added faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../context/AppContext';
import type { AppState } from '../../utils/authTypes'; // Import AppState from authTypes
import LoadingSpinner from '../components/LoadingSpinner';
import { securedApi } from '../../utils/auth';
import TransactionResultModal from '../components/TransactionResultModal';
import ConfirmationModal from '../components/ConfirmationModal';
import FundAccountModal from '../components/admin/wallet/FundAccountModal';
import { getUserLimits } from '../../utils/helpers';
import ChangePasswordModal from '../components/admin/settings/ChangePasswordModal'; // Import the actual ChangePasswordModal
import ApiKeyModal from '../components/admin/settings/ApiKeyModal'; // Import the actual ApiKeyModal
import DestroyAccountModal from '../components/admin/settings/DestroyAccountModal'; // Import the actual DestroyAccountModal

import { ChangePasswordModalProps } from '../components/admin/settings/ChangePasswordModal';
import { ApiKeyModalProps } from '../components/admin/settings/ApiKeyModal';
import { DestroyAccountModalProps } from '../components/admin/settings/DestroyAccountModal';
import UpgradePlanModal from '../components/admin/settings/UpgradePlanModal'; // Import the actual UpgradePlanModal
import TwoFactorModal from '../components/admin/settings/TwoFactorModal'; // Import the actual TwoFactorModal


export default function UserSettings() {
  const { appData, setAppData } = useAppState();
  const userLimits = getUserLimits(appData);
  
  // Modal states
  const [showUpgradePlanModal, setShowUpgradePlanModal] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showDestroyAccountModal, setShowDestroyAccountModal] = useState(false);

  // Independent loading states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isGeneratingApiKey, setIsGeneratingApiKey] = useState(false);
  const [isDestroyingAccount, setIsDestroyingAccount] = useState(false);
  const [isTwoFactorProcessing, setIsTwoFactorProcessing] = useState(false);
  const [isUpgradingPlan, setIsUpgradingPlan] = useState(false); // Specific for plan upgrade

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

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showPlanConfirmation, setShowPlanConfirmation] = useState(false);
  // Removed general isProcessing state

  // Function to handle password change
  const handleChangePassword = async (oldPass: string, newPass: string) => {
    setIsChangingPassword(true); // Use specific processing state
    setShowChangePasswordModal(false); // Close the modal

    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'changePassword',
        oldPassword: oldPass,
        newPassword: newPass,
      });


      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: 'Password Changed',
          message: 'Your password has been changed successfully.',
          details: response.data || {}
        });
      } else {
        setResultModalProps({
          type: 'error',
          title: 'Password Change Failed',
          message: response.error || 'Failed to change password.',
          details: response.details || {}
        });
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Unexpected Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: {}
      });
    } finally {
      setIsChangingPassword(false); // Reset specific processing state
      setShowResultModal(true);
    }
  };

  // Function to handle API Key generation
  const handleGenerateNewApiKey = async (): Promise<string | undefined> => {
    setIsGeneratingApiKey(true); // Use specific processing state
    // setShowApiKeyModal(false); // Removed: ApiKeyModal should remain open to display the key

    try {
      const response = await securedApi.callBackendFunction({ functionName: 'generateApiKey' });


      if (response.success && response.data?.apiKey) {
        return response.data.apiKey;
      } else {
        // ApiKeyModal handles its own error message
        return undefined;
      }
    } catch (error: any) {
      // ApiKeyModal handles its own error message
      return undefined;
    } finally {
      setIsGeneratingApiKey(false); // Reset specific processing state
      // No need to show TransactionResultModal here, ApiKeyModal handles its own feedback
    }
  };

  // Function to handle account destruction
  const handleDestroyAccount = async () => {
    setIsDestroyingAccount(true); // Use specific processing state
    setShowDestroyAccountModal(false); // Close the modal

    try {
      const response = await securedApi.callBackendFunction({ functionName: 'destroyAccount' });


      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: 'Account Destroyed',
          message: 'Your account has been successfully destroyed. You will be logged out.',
          details: response.data || {}
        });
        // Redirect to home or logout page after successful destruction
        window.location.href = '/'; 
      } else {
        setResultModalProps({
          type: 'error',
          title: 'Account Destruction Failed',
          message: response.error || 'Failed to destroy account.',
          details: response.details || {}
        });
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Unexpected Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: {}
      });
    } finally {
      setIsDestroyingAccount(false); // Reset specific processing state
      setShowResultModal(true);
    }
  };

  // Function to handle plan change
  const handleChangePlan = async () => {
    if (!selectedPlan) return;

    setIsUpgradingPlan(true); // Use specific processing state
    setShowPlanConfirmation(false); // Close confirmation modal
    setShowResultModal(false); // Ensure TransactionResultModal is hidden initially

    try {
      const limitsHeaders = appData?.data?.limits?.headers;
      if (!limitsHeaders) {
        throw new Error('Limits data headers are not available.');
      }

      const getLimitIndex = (header: string) => limitsHeaders.indexOf(header);

      const selectedPlanData = appData?.data?.limits?.data?.find(
        (plan: any) => plan[getLimitIndex('plan')]?.toLowerCase() === selectedPlan
      );
      const requiredAmount = parseFloat(selectedPlanData?.[getLimitIndex('price')] || '0');
      const currentBalance = parseFloat(appData?.user?.balance ?? '0');
      const shortfall = requiredAmount - currentBalance;

      const response = await securedApi.callBackendFunction({
        functionName: 'changePlan',
        newPlan: selectedPlan,
      });

      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: 'Plan Upgraded',
          message: `You have successfully upgraded to the ${selectedPlan} plan!`,
          details: response.data || {}
        });
        setShowResultModal(true); // Show success result modal
        // appData will be globally updated in auth.ts, no need to set AppData here
      } else {
        if (response.error?.includes('Insufficient balance')) { // Check response.error directly
          setFundAccountModalProps({
            requiredAmount: requiredAmount.toFixed(2),
            currentBalance: currentBalance.toFixed(2),
            shortfall: shortfall.toFixed(2),
            message: response.error || `Insufficient balance to upgrade to ${selectedPlan} plan.`, // Use response.error for message
          });
          setShowFundAccountModal(true); // Show FundAccountModal
        } else {
          setResultModalProps({
            type: 'error',
            title: 'Upgrade Failed',
            message: response.error || `Failed to upgrade to ${selectedPlan} plan.`,
            details: response.details || {}
          });
          setShowResultModal(true); // Show error result modal for other errors
        }
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Unexpected Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: {}
      });
      setShowResultModal(true); // Show error result modal for unexpected errors
    } finally {
      setIsUpgradingPlan(false); // Reset specific processing state
      setShowUpgradePlanModal(false); // Close the upgrade modal
      setSelectedPlan(null); // Reset selected plan
    }
  };

  if (!appData?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Function to handle 2FA toggle
  const handleTwoFactorToggle = async (enable: boolean) => {
    setIsTwoFactorProcessing(true); // Use specific processing state for 2FA
    setShowTwoFactorModal(false); // Close the modal

    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'toggleTwoFactorAuth',
        enable: enable,
      });

      if (response.success) {
        setResultModalProps({
          type: 'success',
          title: `2FA ${enable ? 'Enabled' : 'Disabled'}`,
          message: `Two-factor authentication has been successfully ${enable ? 'enabled' : 'disabled'}.`,
          details: response.data || {}
        });
        // appData will be globally updated in auth.ts
      } else {
        setResultModalProps({
          type: 'error',
          title: `2FA ${enable ? 'Enable' : 'Disable'} Failed`,
          message: response.error || `Failed to ${enable ? 'enable' : 'disable'} two-factor authentication.`,
          details: response.details || {}
        });
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Unexpected Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: {}
      });
    } finally {
      setIsTwoFactorProcessing(false);
      setShowResultModal(true);
    }
  };

  // Format the creation date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'a year ago';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const isTwoFactorEnabled = !!appData?.user?.twoFactorAuth;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Upgrade Plan Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 h-full mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upgrade Plan</h2>
          <FontAwesomeIcon icon={faCrown} className="w-6 h-6 text-amber-500" />
        </div>
        <div className="space-y-2">
          <p className="text-gray-700 dark:text-gray-200">Current Plan: <span className="font-semibold capitalize">{appData?.user?.plan || 'Free'}</span></p>
          {appData?.user?.plan?.toLowerCase() !== 'free' && appData?.user?.planExpiry && (
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Expires: <span className="font-semibold">{new Date(appData.user.planExpiry).toLocaleDateString()}</span>
            </p>
          )}
          <p className="text-gray-500 dark:text-gray-400 text-sm">Upgrade to access premium features</p>
        </div>
        <div className="mt-6">
          <button
            onClick={() => setShowUpgradePlanModal(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            disabled={isUpgradingPlan}
          >
            {isUpgradingPlan ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : <FontAwesomeIcon icon={faCrown} className="w-4 h-4 mr-2" />}
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Security Sections */}
      <div className="space-y-6">
        {/* Two-Factor Authentication */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Additional Security</h2>
            <FontAwesomeIcon icon={faShield} className="w-6 h-6 text-green-500" />
          </div>
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-200">Two-factor authentication is currently: <span className={`font-semibold ${isTwoFactorEnabled ? 'text-green-500' : 'text-red-500'}`}>
              {isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span></p>
            <p className="text-gray-700 dark:text-gray-200">Two-factor authentication greatly helps to secure your account by requiring a dynamically generated code in addition to the standard username and password when you log in.</p>
          </div>
          <button
            onClick={() => setShowTwoFactorModal(true)}
            className={`${isTwoFactorEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white py-2 px-4 rounded-lg flex items-center justify-center`}
            disabled={isTwoFactorProcessing}
          >
            {isTwoFactorProcessing ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : <FontAwesomeIcon icon={faShield} className="w-4 h-4 mr-2" />}
            {isTwoFactorEnabled ? 'Disable Two-Factor Authentication' : 'Enable Two-Factor Authentication'}
          </button>
        </div>

        {/* Password */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Password</h2>
            <FontAwesomeIcon icon={faLock} className="w-6 h-6 text-blue-500" />
          </div>
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-200">Regularly update your password to keep your account secure.</p>
          </div>
          <button
            onClick={() => setShowChangePasswordModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            disabled={isChangingPassword}
          >
            {isChangingPassword ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : <FontAwesomeIcon icon={faLock} className="w-4 h-4 mr-2" />}
            Change Password
          </button>
        </div>

        {/* API Key */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Personal Access Token</h2>
            <FontAwesomeIcon icon={faKey} className="w-6 h-6 text-purple-500" />
          </div>
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-200">Use the WebFixx API or command-line tool with this API Key. Find more information about our API, Go SDK, Python SDK and CLI tool at our Developer Hub.</p>
            <p className="text-gray-700 dark:text-gray-200 mt-2">Regenerating your API key will invalidate the current/previous one.</p>
            <p className="text-gray-700 dark:text-gray-200 mt-2">For security reasons, your API key will only be shown once!</p>
            <div className="mt-3 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
              <p className="font-mono text-gray-700 dark:text-gray-300">##############################</p>
            </div>
          </div>
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            disabled={isGeneratingApiKey}
          >
            {isGeneratingApiKey ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : <FontAwesomeIcon icon={faSync} className="w-4 h-4 mr-2" />}
            Generate New API Key
          </button>
        </div>

        {/* Destroy Account */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Destroy Account</h2>
            <FontAwesomeIcon icon={faTrash} className="w-6 h-6 text-red-500" />
          </div>
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-200">This will delete your account, servers, and any/all records from our system.</p>
          </div>
          <button
            onClick={() => setShowDestroyAccountModal(true)}
            className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            disabled={isDestroyingAccount}
          >
            {isDestroyingAccount ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : <FontAwesomeIcon icon={faTrash} className="w-4 h-4 mr-2" />}
            Destroy Account
          </button>
        </div>
      </div>

      {/* Modals */}
      <UpgradePlanModal 
        isOpen={showUpgradePlanModal} 
        onClose={() => setShowUpgradePlanModal(false)} 
        appData={appData}
        userLimits={userLimits}
        onConfirm={() => setShowPlanConfirmation(true)}
        selectedPlan={selectedPlan}
        setSelectedPlan={setSelectedPlan}
        isUpgradingPlan={isUpgradingPlan}
      />
      <TwoFactorModal 
        isOpen={showTwoFactorModal} 
        onClose={() => setShowTwoFactorModal(false)} 
        appData={appData}
        onTwoFactorToggle={handleTwoFactorToggle}
        isTwoFactorEnabled={isTwoFactorEnabled}
        isTwoFactorProcessing={isTwoFactorProcessing}
      />
      <ChangePasswordModal 
        isOpen={showChangePasswordModal} 
        onClose={() => setShowChangePasswordModal(false)} 
        onChangePassword={handleChangePassword}
        isChangingPassword={isChangingPassword}
      />
      <ApiKeyModal 
        isOpen={showApiKeyModal} 
        onClose={() => setShowApiKeyModal(false)} 
        onGenerateNewApiKey={handleGenerateNewApiKey}
        isGeneratingApiKey={isGeneratingApiKey}
      />
      <DestroyAccountModal 
        isOpen={showDestroyAccountModal} 
        onClose={() => setShowDestroyAccountModal(false)} 
        onDestroyAccount={handleDestroyAccount}
        isDestroyingAccount={isDestroyingAccount}
      />

      {/* Transaction Result Modal */}
      <TransactionResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        type={resultModalProps.type}
        title={resultModalProps.title}
        message={resultModalProps.message}
        details={resultModalProps.details}
        actionButton={
          resultModalProps.type === 'error' && 
          resultModalProps.title === 'Insufficient Balance' ? 
          {
            text: 'Add Funds',
            onClick: () => {
              setShowResultModal(false);
              setShowFundAccountModal(true);
            }
          } : undefined
        }
      />

      {/* Fund Account Modal */}
      <FundAccountModal
        isOpen={showFundAccountModal}
        onClose={() => setShowFundAccountModal(false)}
        requiredAmount={fundAccountModalProps.requiredAmount}
        currentBalance={fundAccountModalProps.currentBalance}
        shortfall={fundAccountModalProps.shortfall}
        message={fundAccountModalProps.message}
      />

      {/* Plan Confirmation Modal */}
      {showPlanConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setShowPlanConfirmation(false)}
          onConfirm={handleChangePlan}
          title="Confirm Plan Upgrade"
          message={`Are you sure you want to upgrade to the ${selectedPlan} plan? This action will incur a charge.`}
          confirmText={isUpgradingPlan ? 'Upgrading...' : 'Confirm Upgrade'}
          cancelText="Cancel"
          confirmDisabled={isUpgradingPlan}
        />
      )}
    </div>
  );
}

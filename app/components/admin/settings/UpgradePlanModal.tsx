import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser,
  faLock,
  faShield,
  faKey,
  faEdit,
  faSync,
  faTimes // Added for close button
} from '@fortawesome/free-solid-svg-icons';
import type { AppState } from '../../../../utils/authTypes';
import { getUserLimits } from '../../../../utils/helpers';

export interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppState | null;
  userLimits: ReturnType<typeof getUserLimits>;
  onConfirm: () => void;
  selectedPlan: string | null;
  setSelectedPlan: React.Dispatch<React.SetStateAction<string | null>>;
  isUpgradingPlan: boolean;
}

const UpgradePlanModal = ({ isOpen, onClose, appData, userLimits, onConfirm, selectedPlan, setSelectedPlan, isUpgradingPlan }: UpgradePlanModalProps) => {
  if (!isOpen) return null;

  const availablePlans = appData?.data?.limits?.data || [];
  const planHeaders = appData?.data?.limits?.headers || [];

  const getPlanIndex = (header: string) => planHeaders.indexOf(header);

  const currentPlan = appData?.user?.plan ? appData.user.plan.toLowerCase() : 'free'; // Safely access and convert to lowercase
  const planExpiry = appData?.user?.planExpiry;

  return (
    <div className="modal-backdrop bg-gray-900 bg-opacity-50 dark:bg-opacity-75 fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-content bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-lg shadow-lg w-11/12 md:max-w-4xl max-h-[90vh] overflow-auto relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upgrade Plan</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <p className="text-gray-700 dark:text-gray-200 mb-4">Select a plan to upgrade your account and unlock more features.</p>
        {currentPlan !== 'free' && planExpiry && (
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your current plan expires on: <span className="font-semibold">{new Date(planExpiry).toLocaleDateString()}</span>
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {availablePlans.map((plan: any, index: number) => {
            const planName = plan[getPlanIndex('plan')]?.toLowerCase();
            const isCurrentPlan = currentPlan === planName;
            const price = parseFloat(plan[getPlanIndex('price')] || '0');

            return (
              <div
                key={index}
                className={`
                  p-4 border rounded-lg cursor-pointer mb-4
                  ${isCurrentPlan ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300 dark:border-gray-600'}
                  ${selectedPlan === planName ? 'bg-blue-50 dark:bg-blue-900' : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'}
                `}
                onClick={() => {
                  if (setSelectedPlan) setSelectedPlan(planName);
                  if (planName !== currentPlan) { // Only proceed if a different plan is selected
                    onClose(); // Close the UpgradePlanModal immediately
                    onConfirm(); // Then trigger the confirmation modal
                  }
                }}
              >
                <h3 className="font-semibold text-lg mb-2 capitalize dark:text-white">{planName}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Price: ${price.toFixed(2)} / month
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                  <p><FontAwesomeIcon icon={faEdit} className="w-3 h-3 mr-2 text-blue-400" />Redirect Path Limit (Plan-based): <span className="font-semibold">{plan[getPlanIndex('redirectPathLimit')]}</span></p>
                  <p><FontAwesomeIcon icon={faShield} className="w-3 h-3 mr-2 text-green-400" />SMTP Checker Limit (Daily): <span className="font-semibold">{plan[getPlanIndex('smtpCheckerLimit')]}</span></p>
                  <p><FontAwesomeIcon icon={faUser} className="w-3 h-3 mr-2 text-purple-400" />Sender Limit (Daily): <span className="font-semibold">{plan[getPlanIndex('senderLimit')]}</span></p>
                  <p><FontAwesomeIcon icon={faLock} className="w-3 h-3 mr-2 text-yellow-400" />Verify Login Limit (Daily): <span className="font-semibold">{plan[getPlanIndex('verifyLoginLimit')]}</span></p>
                  <p><FontAwesomeIcon icon={faKey} className="w-3 h-3 mr-2 text-indigo-400" />Get Cookie Limit (Daily): <span className="font-semibold">{plan[getPlanIndex('getCookieLimit')]}</span></p>
                  <p><FontAwesomeIcon icon={faSync} className="w-3 h-3 mr-2 text-pink-400" />Extraction Limit (Daily): <span className="font-semibold">{plan[getPlanIndex('extractionLimit')]}</span></p>
                  <p><FontAwesomeIcon icon={faUser} className="w-3 h-3 mr-2 text-teal-400" />Shoot Contacts Limit (Daily): <span className="font-semibold">{plan[getPlanIndex('shootContactsLimit')]}</span></p>
                  <p><FontAwesomeIcon icon={faEdit} className="w-3 h-3 mr-2 text-orange-400" />Interaction Limit (Daily): <span className="font-semibold">{plan[getPlanIndex('interactionLimit')]}</span></p>
                </div>
                {isCurrentPlan && (
                  <span className="mt-3 inline-block bg-blue-500 text-white text-xs px-2 py-1 rounded-full">Current Plan</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UpgradePlanModal;

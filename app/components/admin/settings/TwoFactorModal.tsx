import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import type { AppState } from '../../../../utils/authTypes';

export interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppState;
  onTwoFactorToggle: (enable: boolean) => void;
  isTwoFactorEnabled: boolean;
  isTwoFactorProcessing: boolean;
}

const TwoFactorModal = ({ isOpen, onClose, appData, onTwoFactorToggle, isTwoFactorEnabled, isTwoFactorProcessing }: TwoFactorModalProps) => {
  if (!isOpen) return null;

  const isEnabled = appData?.user?.twoFactorAuth || false; // Correctly treat as boolean

  return (
    <div className="modal-backdrop bg-gray-900 bg-opacity-50 dark:bg-opacity-75 fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-content bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-lg shadow-lg w-11/12 md:w-1/3 relative">
        <h2 className="text-xl font-bold mb-4">Two-Factor Authentication</h2>
        <p className="mb-4">
          Two-factor authentication is currently: <span className={`font-semibold ${isEnabled ? 'text-green-500' : 'text-red-500'}`}>
            {isEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </p>
        <p className="mb-6">
          {isEnabled
            ? 'Disabling 2FA will remove an extra layer of security from your account.'
            : 'Enabling 2FA will add an extra layer of security to your account, requiring a code from your authenticator app.'
          }
        </p>
        <div className="flex justify-end space-x-4">
          <button onClick={onClose} className="btn-secondary" disabled={isTwoFactorProcessing}>Cancel</button>
          <button
            onClick={() => onTwoFactorToggle && onTwoFactorToggle(!isEnabled)}
            className={`${isEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white py-2 px-4 rounded-lg flex items-center justify-center`}
            disabled={isTwoFactorProcessing}
          >
            {isTwoFactorProcessing ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : null}
            {isEnabled ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorModal;

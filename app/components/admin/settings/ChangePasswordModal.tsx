import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (oldPass: string, newPass: string) => Promise<void>;
  isChangingPassword: boolean; // Added loading state prop
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onChangePassword, isChangingPassword }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null); // Clear previous errors

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setErrorMessage('All password fields are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    // Call the parent's onChangePassword function
    await onChangePassword(oldPassword, newPassword);
    onClose(); // Close the change password modal on successful submission or after API call

    // Reset form fields
    setOldPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop bg-gray-900 bg-opacity-50 dark:bg-opacity-75 fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-content bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-lg shadow-lg w-11/12 md:w-1/3 relative">
        <h2 className="text-xl font-bold mb-4">Change Password</h2>
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline"> {errorMessage}</span>
          </div>
        )}
        <div className="space-y-4">
          <input
            type="password"
            placeholder="Old Password"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={isChangingPassword}
          />
          <input
            type="password"
            placeholder="New Password"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isChangingPassword}
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            disabled={isChangingPassword}
          />
        </div>
        <div className="flex justify-end space-x-4 mt-6">
          <button onClick={onClose} className="btn-secondary" disabled={isChangingPassword}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={isChangingPassword || !oldPassword || !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword}
            className="btn-primary"
          >
            {isChangingPassword ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : null}
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  children?: React.ReactNode;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDisabled = false,
  confirmLoading = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-75">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{title}</h2>
        {message && <p className="mb-6 text-gray-700 dark:text-gray-200">{message}</p>}
        
        {children}
        
        <div className="flex justify-end space-x-2">
          <button 
            onClick={onClose}
            disabled={confirmLoading}
            className={`px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 hover:dark:bg-gray-600 ${confirmLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            disabled={confirmDisabled || confirmLoading}
            className={`px-4 py-2 bg-red-500 text-white rounded flex items-center gap-2 ${confirmDisabled || confirmLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600 dark:hover:bg-red-700'}`}
          >
            {confirmLoading && <FontAwesomeIcon icon={faSpinner} className="fa-spin" />}
            {confirmLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

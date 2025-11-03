import React, { useState, useEffect } from 'react';
import { securedApi } from '@/utils/auth';
import TransactionResultModal from '@/app/components/TransactionResultModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateNewApiKey: () => Promise<string | undefined>;
  isGeneratingApiKey: boolean; // Added loading state prop
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onGenerateNewApiKey, isGeneratingApiKey }) => {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('warning');

  const handleGenerate = async () => {
    setMessage(null); // Clear previous messages
    try {
      const newApiKey = await onGenerateNewApiKey(); // Call parent's API key generation function and get the key
      if (newApiKey) {
        setGeneratedApiKey(newApiKey);
        setMessage('New API Key generated successfully. Please copy it now as it will not be shown again.');
        setMessageType('success');
      } else {
        setMessage('Failed to generate API Key. Please try again.');
        setMessageType('error');
      }
    } catch (error: any) {
      setMessage(error.message || 'An unexpected error occurred.');
      setMessageType('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop bg-gray-900 bg-opacity-50 dark:bg-opacity-75 fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-content bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-lg shadow-lg w-11/12 md:max-w-4xl max-h-[90vh] overflow-auto relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generate New API Key</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <p className="mb-4 text-gray-700 dark:text-gray-200">
          Generating a new API key will invalidate your current one. Please ensure you update any applications using the old key.
          For security reasons, the new API key will only be shown once.
        </p>
        {generatedApiKey ? (
          <div className="mt-3 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg break-all">
            <p className="font-mono text-gray-700 dark:text-gray-300">{generatedApiKey}</p>
          </div>
        ) : (
          <div className="mt-3 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
            <p className="font-mono text-gray-700 dark:text-gray-300">Click "Generate Key" to get your new API key.</p>
          </div>
        )}

        {message && (
          <div className={`mt-4 p-3 rounded-lg ${messageType === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
            {message}
          </div>
        )}

        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={handleGenerate}
            disabled={isGeneratingApiKey}
            className="btn-primary"
          >
            {isGeneratingApiKey ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : null}
            Generate Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;

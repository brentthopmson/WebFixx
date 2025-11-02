import React, { useState, useEffect } from 'react';
import { securedApi } from '@/utils/auth';
import TransactionResultModal from '@/app/components/TransactionResultModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateNewApiKey: () => Promise<void>;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onGenerateNewApiKey }) => {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('warning');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setMessage(null); // Clear previous messages
    try {
      const response = await securedApi.callBackendFunction({ functionName: 'generateApiKey' });

      if (response.success && response.data && response.data.apiKey) {
        setGeneratedApiKey(response.data.apiKey);
        setMessage('New API Key generated successfully. Please copy it now as it will not be shown again.');
        setMessageType('success');
        await onGenerateNewApiKey(); // Notify parent to update appData
      } else {
        setMessage(response.error || 'Failed to generate new API Key.');
        setMessageType('error');
      }
    } catch (error: any) {
      setMessage(error.message || 'An unexpected error occurred.');
      setMessageType('error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop bg-gray-900 bg-opacity-50 dark:bg-opacity-75 fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-content bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-lg shadow-lg w-11/12 md:w-1/3 relative">
        <h2 className="text-xl font-bold mb-4">Generate New API Key</h2>
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
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="btn-primary"
          >
            {isGenerating ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : null}
            Generate Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;

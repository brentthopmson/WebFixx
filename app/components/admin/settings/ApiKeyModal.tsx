import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faCheck, faCopy, faExclamationTriangle, faKey } from '@fortawesome/free-solid-svg-icons';

export interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateNewApiKey: () => Promise<string | undefined>;
  isGeneratingApiKey: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onGenerateNewApiKey, isGeneratingApiKey }) => {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('warning');

  const handleGenerate = async () => {
    setMessage(null);
    try {
      const newApiKey = await onGenerateNewApiKey();
      if (newApiKey) {
        setGeneratedApiKey(newApiKey);
        setMessage('New Launcher Key generated successfully! Your existing session leases have been reset.');
        setMessageType('success');
      } else {
        setMessage('Failed to generate Launcher Key. Please try again.');
        setMessageType('error');
      }
    } catch (error: any) {
      setMessage(error.message || 'An unexpected error occurred.');
      setMessageType('error');
    }
  };

  const handleCopy = () => {
    if (generatedApiKey) {
      navigator.clipboard.writeText(generatedApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop bg-gray-900 bg-opacity-50 dark:bg-opacity-75 fixed inset-0 flex items-center justify-center z-50">
      <div className="modal-content bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-lg shadow-lg w-11/12 md:max-w-2xl max-h-[90vh] overflow-auto relative">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon icon={faKey} className="text-purple-500 w-5 h-5" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generate New Launcher Key</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
          <div className="flex items-start">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-600 dark:text-amber-400 w-5 h-5 mr-3 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">Security Warning</p>
              <p className="mt-1 text-sm leading-relaxed">
                Generating a new Launcher Key will <strong>permanently revoke access</strong> to all your existing locked browser sessions.
                Any desktop launchers configured with your previous key will be blocked (HTTP 403) from opening existing sessions.
              </p>
            </div>
          </div>
        </div>

        {generatedApiKey ? (
          <div className="mt-3">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Your New Launcher Key:</label>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between border border-purple-500/30">
              <span className="font-mono text-purple-600 dark:text-purple-300 font-bold select-all break-all">{generatedApiKey}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="ml-3 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm flex items-center shrink-0 cursor-pointer transition-colors"
              >
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3.5 h-3.5 mr-1.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Save this key or copy it into your Desktop Launcher settings if prompted.
            </p>
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to proceed and generate a new key?
          </div>
        )}

        {message && (
          <div className={'mt-4 p-3 rounded-lg ' + (messageType === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200')}>
            {message}
          </div>
        )}

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
          >
            {generatedApiKey ? 'Close' : 'Cancel'}
          </button>
          {!generatedApiKey && (
            <button
              onClick={handleGenerate}
              disabled={isGeneratingApiKey}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center cursor-pointer transition-colors"
            >
              {isGeneratingApiKey ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : null}
              Confirm & Generate New Key
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;

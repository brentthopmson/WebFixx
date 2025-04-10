import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheckCircle, 
  faTimesCircle, 
  faExclamationTriangle,
  faWallet,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

type ResultType = 'success' | 'error' | 'warning';

interface TransactionResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ResultType;
  title: string;
  message: string;
  details?: {
    [key: string]: string | number;
  };
  actionButton?: {
    text: string;
    onClick: () => void;
  };
}

const TransactionResultModal: React.FC<TransactionResultModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  details,
  actionButton
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return faCheckCircle;
      case 'error':
        return faTimesCircle;
      case 'warning':
        return faExclamationTriangle;
      default:
        return faWallet;
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50';
      case 'error':
        return 'bg-red-50';
      case 'warning':
        return 'bg-yellow-50';
      default:
        return 'bg-blue-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md relative overflow-hidden">
        <div className={`p-6 ${getBgColor()}`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`w-16 h-16 rounded-full ${getBgColor()} flex items-center justify-center`}>
              <FontAwesomeIcon icon={getIcon()} className={`h-10 w-10 ${getIconColor()}`} />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="text-gray-600">{message}</p>
            
            {details && (
              <div className="w-full mt-4 text-left bg-white p-4 rounded-md border border-gray-200">
                <h4 className="font-medium text-gray-700 mb-2">Details</h4>
                <div className="space-y-1">
                  {Object.entries(details).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500">{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex space-x-3 w-full mt-4">
              {actionButton && (
                <button
                  onClick={actionButton.onClick}
                  className={`flex-1 px-4 py-2 ${
                    type === 'success' ? 'bg-green-500 hover:bg-green-600' :
                    type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                    type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' :
                    'bg-blue-500 hover:bg-blue-600'
                  } text-white rounded-lg transition-colors`}
                >
                  {actionButton.text}
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionResultModal;

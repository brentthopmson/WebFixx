'use client';

import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColor = type === 'success'
    ? 'bg-green-500 dark:bg-green-600'
    : 'bg-red-500 dark:bg-red-600';

  const icon = type === 'success' ? faCheckCircle : faExclamationCircle;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-fade-in">
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]`}>
        <FontAwesomeIcon icon={icon} className="text-lg" />
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    </div>
  );
}

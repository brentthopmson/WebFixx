"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faCopy, faCheck, faCookie } from '@fortawesome/free-solid-svg-icons';

interface AccountHeaderCardProps {
  email?: string;
  password?: string;
  domain?: string;
  cookieJSON?: any;
  title?: string;
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const AccountHeaderCard = ({ email, password, domain, cookieJSON, title }: AccountHeaderCardProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (field: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  const cookieText = typeof cookieJSON === 'string'
    ? cookieJSON
    : cookieJSON
      ? JSON.stringify(cookieJSON)
      : '';

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title || email || 'Account'}</h3>
          {email && <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{email}</p>}
          {domain && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{domain}</p>}
        </div>

        <div className="flex items-center gap-2">
          {password && (
            <button
              onClick={() => setShowPassword(v => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="mr-1" />
              {showPassword ? password : '••••••••'}
            </button>
          )}

          {password && (
            <button
              onClick={() => handleCopy('password', password)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              title="Copy password"
            >
              <FontAwesomeIcon icon={copiedField === 'password' ? faCheck : faCopy} className="mr-1" />
              {copiedField === 'password' ? 'Copied' : 'Password'}
            </button>
          )}

          {cookieText && (
            <button
              onClick={() => handleCopy('cookie', cookieText)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700"
              title="Copy Cookie Data"
            >
              <FontAwesomeIcon icon={copiedField === 'cookie' ? faCheck : faCookie} className="mr-1" />
              {copiedField === 'cookie' ? 'Copied!' : 'Copy Cookie'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

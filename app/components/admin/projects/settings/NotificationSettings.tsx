import React, { useState } from 'react';
import { securedApi } from '../../../../../utils/auth';
import { authApi } from '../../../../../utils/auth';
import { syncProjectWorker } from '../../../../../utils/syncWorker';
import { useAppState } from '../../../../context/AppContext';
import LoadingSpinner from '../../../LoadingSpinner';

interface NotificationSettingsProps {
  project: {
    projectId: string;
    telegramGroupId?: string;
    email?: string;
  };
  onSave?: (updatedNotifications: { telegramGroupId: string; email: string }) => void;
}

export default function NotificationSettings({ 
  project, 
  onSave 
}: NotificationSettingsProps) {
  const { setAppData } = useAppState();
  const [success, setSuccess] = useState(false);
  const [telegramId, setTelegramId] = useState(project.telegramGroupId || '');
  const [email, setEmail] = useState(project.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate Telegram ID if changed
      if (telegramId !== project.telegramGroupId) {
        const telegramValidation = await securedApi.callBackendFunction({
          functionName: 'validateTelegramId',
          telegramId
        });

        if (!telegramValidation.success) {
          setError('Invalid Telegram ID');
          return;
        }
      }

      const response = await securedApi.callBackendFunction({
        functionName: 'updateProjectNotifications',
        projectId: project.projectId,
        telegramGroupId: telegramId,
        email
      });

      if (response.success) {
        setSuccess(true);
        void syncProjectWorker(project.projectId);
        if (onSave) {
          onSave({ telegramGroupId: telegramId, email });
        }
      } else {
        setError(response.error || 'Failed to update notification settings');
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      setError('Failed to save notification settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telegram ID</label>
        {project.telegramGroupId && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current: <span className="font-mono">{project.telegramGroupId}</span></div>
        )}
        <input
          type="text"
          value={telegramId}
          onChange={(e) => {
            setTelegramId(e.target.value);
            setSuccess(false);
          }}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
        {project.email && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current: <span className="font-mono">{project.email}</span></div>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSuccess(false);
          }}
          className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      {success && (
        <div className="text-green-600 text-sm mt-2 dark:text-green-400">Notification settings updated successfully!</div>
      )}
      {error && (
        <div className="text-red-500 text-sm mt-2 dark:text-red-400">{error}</div>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
        >
          {loading ? 'Saving...' : 'Save Notifications'}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from 'react';
import { useAppState } from '../../../context/AppContext';
import { securedApi } from '../../../../utils/auth';
import { rowsToObjects } from '../../../utils/rows';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faSpinner, faRobot, faShieldAlt } from '@fortawesome/free-solid-svg-icons';

export interface SettingsRow {
  settingsKey: string;
  settingsValue1: string;
  settingsValue2: string;
  [key: string]: any;
}

export default function AdminSettingsPanel() {
  const { appData } = useAppState();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings: SettingsRow[] = useMemo(() => {
    const s = appData?.data?.settings;
    if (!s?.data || !Array.isArray(s.data)) return [];
    return rowsToObjects(s.headers || [], s.data as unknown as any[][]) as unknown as SettingsRow[];
  }, [appData]);

  const flagKeys = useMemo(
    () => settings.filter((r) => r.settingsKey && r.settingsKey.startsWith('allow')),
    [settings]
  );
  const botKeys = useMemo(
    () => settings.filter((r) => r.settingsKey && !r.settingsKey.startsWith('allow')),
    [settings]
  );

  const saveFlag = async (row: SettingsRow) => {
    if (!row.settingsKey && row.settingsKey !== undefined) return;
    setSavingKey(row.settingsKey);
    setError(null);
    try {
      await securedApi.callBackendFunction({
        functionName: 'updateSetting',
        key: row.settingsKey,
        value1: String(row.settingsValue1) === 'TRUE' ? 'FALSE' : 'TRUE'
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to update setting');
    } finally {
      setSavingKey(null);
    }
  };

  const renderToggle = (row: SettingsRow) => {
    const isOn = String(row.settingsValue1) === 'TRUE';
    const saving = savingKey === row.settingsKey;
    return (
      <button
        onClick={() => saveFlag(row)}
        disabled={saving}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
          saving ? 'opacity-60' : isOn ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
            isOn ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
        {saving && <FontAwesomeIcon icon={faSpinner} className="w-3 h-3 text-white absolute right-1 animate-spin" />}
      </button>
    );
  };

  return (
    <>
      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {settings.length === 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center text-gray-500 dark:text-gray-400">
          No settings available.
        </div>
      )}

      {settings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feature flags (editable) */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
            <div className="flex items-center mb-4">
              <FontAwesomeIcon icon={faShieldAlt} className="w-5 h-5 text-blue-500 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Feature Flags</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {flagKeys.map((row) => (
                <div key={row.settingsKey} className="py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white break-words pr-3">
                    {row.settingsKey}
                  </span>
                  {renderToggle(row)}
                </div>
              ))}
              {flagKeys.length === 0 && (
                <div className="py-3 text-sm text-gray-500 dark:text-gray-400">No feature flags found.</div>
              )}
            </div>
          </div>

          {/* Bots / webhooks / other (read-only) */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
            <div className="flex items-center mb-4">
              <FontAwesomeIcon icon={faRobot} className="w-5 h-5 text-blue-500 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bots, Webhooks &amp; Other</h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {botKeys.map((row) => (
                <div key={row.settingsKey} className="py-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                    {row.settingsKey}
                  </div>
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-all space-y-1">
                    {row.settingsValue1 !== undefined && row.settingsValue1 !== '' && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-gray-400">Value 1: </span>
                        {String(row.settingsValue1)}
                      </div>
                    )}
                    {row.settingsValue2 !== undefined && row.settingsValue2 !== '' && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-gray-400">Value 2: </span>
                        {String(row.settingsValue2)}
                      </div>
                    )}
                    {(!row.settingsValue1 || row.settingsValue1 === '') &&
                      (!row.settingsValue2 || row.settingsValue2 === '') && (
                        <span className="text-gray-400">No value set</span>
                      )}
                  </div>
                </div>
              ))}
              {botKeys.length === 0 && (
                <div className="py-3 text-sm text-gray-500 dark:text-gray-400">No additional settings found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
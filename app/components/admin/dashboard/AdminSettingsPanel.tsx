"use client";

import { useMemo, useState } from 'react';
import { useAppState } from '../../../context/AppContext';
import { securedApi } from '../../../../utils/auth';
import { rowsToObjects } from '../../../utils/rows';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faSpinner, faRobot, faShieldAlt, faSave, faCheck } from '@fortawesome/free-solid-svg-icons';

export interface SettingsRow {
  settingsKey: string;
  settingsValue1: string;
  settingsValue2: string;
  [key: string]: any;
}

export default function AdminSettingsPanel() {
  const { appData } = useAppState();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { v1: string; v2: string }>>({});

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
      setSavedKey(row.settingsKey);
      window.setTimeout(() => setSavedKey(null), 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed to update setting');
    } finally {
      setSavingKey(null);
    }
  };

  const saveSetting = async (row: SettingsRow) => {
    if (!row.settingsKey && row.settingsKey !== undefined) return;
    const edit = edits[row.settingsKey] || { v1: String(row.settingsValue1 ?? ''), v2: String(row.settingsValue2 ?? '') };
    setSavingKey(row.settingsKey);
    setError(null);
    try {
      await securedApi.callBackendFunction({
        functionName: 'updateSetting',
        key: row.settingsKey,
        value1: edit.v1,
        value2: edit.v2
      });
      setSavedKey(row.settingsKey);
      window.setTimeout(() => setSavedKey(null), 2000);
    } catch (e: any) {
      setError(e?.message || 'Failed to update setting');
    } finally {
      setSavingKey(null);
    }
  };

  const updateEdit = (key: string, field: 'v1' | 'v2', value: string) => {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
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
                  <div className="flex items-center space-x-2">
                    {savedKey === row.settingsKey && (
                      <FontAwesomeIcon icon={faCheck} className="w-4 h-4 text-green-500" />
                    )}
                    {renderToggle(row)}
                  </div>
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
              {botKeys.map((row) => {
                const edit = edits[row.settingsKey] || {
                  v1: row.settingsValue1 !== undefined && row.settingsValue1 !== null ? String(row.settingsValue1) : '',
                  v2: row.settingsValue2 !== undefined && row.settingsValue2 !== null ? String(row.settingsValue2) : ''
                };
                const saving = savingKey === row.settingsKey;
                return (
                  <div key={row.settingsKey} className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-900 dark:text-white break-words pr-3">
                        {row.settingsKey}
                      </div>
                      {savedKey === row.settingsKey && (
                        <span className="flex items-center text-xs text-green-600 dark:text-green-400 shrink-0">
                          <FontAwesomeIcon icon={faCheck} className="w-3 h-3 mr-1" />
                          Saved
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Value 1</span>
                        <input
                          type="text"
                          value={edit.v1}
                          onChange={(e) => updateEdit(row.settingsKey, 'v1', e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="No value set"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Value 2</span>
                        <input
                          type="text"
                          value={edit.v2}
                          onChange={(e) => updateEdit(row.settingsKey, 'v2', e.target.value)}
                          className="mt-1 w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="No value set"
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => saveSetting(row)}
                        disabled={saving}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60"
                      >
                        {saving ? (
                          <FontAwesomeIcon icon={faSpinner} className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <FontAwesomeIcon icon={faSave} className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
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
import { rowsToObjects } from '../app/utils/rows';

export interface AppDataSettings {
  data?: unknown[][];
  headers?: string[];
}

export interface AppDataShape {
  data?: {
    settings?: AppDataSettings;
  };
}

const OFF_VALUES = ['0', 'false', 'no', 'off', 'disabled'];

function getSettingsRows(appData: AppDataShape | null | undefined): Record<string, any>[] {
  const settings = appData?.data?.settings;
  if (!settings?.data || !Array.isArray(settings.data) || !Array.isArray(settings.headers)) return [];
  return rowsToObjects(settings.headers, settings.data as any[][]);
}

/**
 * Checks whether an admin feature flag is enabled from appData.data.settings.
 * Missing/blank rows are treated as enabled (preserves today's behavior).
 */
export function isFeatureEnabled(appData: AppDataShape | null | undefined, flagKey: string): boolean {
  const rows = getSettingsRows(appData);
  const row = rows.find((r) => r.settingsKey && String(r.settingsKey).trim() === flagKey);
  if (!row) return true;
  const value = row.settingsValue1;
  if (value === undefined || value === null || String(value).trim() === '') return true;
  return !OFF_VALUES.includes(String(value).trim().toLowerCase());
}

/**
 * Friendly error message for when a feature is disabled by an admin flag.
 */
export function featureDisabledMessage(flagKey: string, label?: string): string {
  return `Feature disabled. Enable '${flagKey}' in Admin Settings to use ${label || 'this feature'}.`;
}

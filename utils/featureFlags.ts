import { rowsToObjects } from '../app/utils/rows';

export interface AppDataSettings {
  data?: unknown[][];
  headers?: string[];
}

export interface AppDataCampaigns {
  data?: unknown[];
  headers?: string[];
}

export interface AppDataShape {
  data?: {
    settings?: AppDataSettings;
    campaigns?: AppDataCampaigns;
  };
  user?: { userId?: string | null } | null;
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

/**
 * Reads a setting string value (settingsValue1) by its settingsKey from appData.data.settings.
 */
export function getSettingValueFromAppData(
  appData: AppDataShape | null | undefined,
  key: string,
  fallback: string = ''
): string {
  const rows = getSettingsRows(appData);
  const row = rows.find((r) => r.settingsKey && String(r.settingsKey).trim() === key);
  if (!row) return fallback;
  const value = row.settingsValue1;
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  return String(value).trim();
}

/**
 * Gets the maximum accounts allowed per campaign from the SETTINGS sheet.
 * Falls back to 1 if not set or invalid.
 */
export function getMaxAccountsPerCampaign(appData: AppDataShape | null | undefined): number {
  const val = getSettingValueFromAppData(appData, 'maxAccountsPerCampaign', '1');
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
}

/**
 * Gets the maximum campaign run duration in days from the SETTINGS sheet.
 * Used strictly as an admin ceiling during campaign creation.
 * Defaults to 30 days if not configured.
 */
export function getMaxCampaignDurationDays(appData: AppDataShape | null | undefined): number {
  const val = getSettingValueFromAppData(appData, 'campaignMaxDurationDays', '30');
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed <= 0 ? 30 : parsed;
}

// ==================== Per-user concurrent campaign guardrail ====================
// Statuses that hold a concurrent slot — mirrors the engine's
// ACTIVE_CAMPAIGN_STATUSES (utils/campaignConcurrency.js) and the GAS
// pre-check. 'resting' counts because a cooldown campaign wakes automatically
// via TRIGGERS and therefore still holds its slot.
const ACTIVE_CAMPAIGN_STATUSES = ['running', 'processing', 'staged', 'resting'];

/**
 * Per-user concurrent campaign cap from the SETTINGS sheet
 * (campaignConcurrentLimit). Mirrors the engine/GAS read — fallback 1
 * (safety valve, not a spend cap).
 */
export function getMaxConcurrentCampaigns(appData: AppDataShape | null | undefined): number {
  const val = getSettingValueFromAppData(appData, 'campaignConcurrentLimit', '1');
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
}

export interface ConcurrentCampaignState {
  /** Active campaigns (running/processing/staged/resting) for this user */
  current: number;
  /** Per-user cap from SETTINGS campaignConcurrentLimit (fallback 1) */
  limit: number;
  /** True when every slot is taken — hide Execute/Retry/Resume buttons */
  atLimit: boolean;
}

/**
 * Computes how many of this user's concurrent campaign slots are in use by
 * counting appData.data.campaigns rows whose userId matches the signed-in
 * user. Pass excludeCampaignId when gating a specific campaign's own
 * buttons (mirrors the engine's exclude-self so a 'resting' campaign can
 * still resume itself when it holds the only slot).
 * Fail-open (atLimit=false) when user/campaign data is missing so legacy
 * rows never brick the UI — the engine still enforces the real limit.
 */
export function getConcurrentCampaignState(
  appData: AppDataShape | null | undefined,
  excludeCampaignId?: string | null
): ConcurrentCampaignState {
  const limit = getMaxConcurrentCampaigns(appData);
  const userId = String(appData?.user?.userId || '').trim();
  if (!userId) return { current: 0, limit, atLimit: false };

  const campaigns = appData?.data?.campaigns;
  if (!campaigns || !Array.isArray(campaigns.data) || !Array.isArray(campaigns.headers)) {
    return { current: 0, limit, atLimit: false };
  }

  const headers = campaigns.headers.map((h) => String(h ?? '').trim());
  const userIdIdx = headers.indexOf('userId');
  const statusIdx = headers.indexOf('status');
  if (userIdIdx === -1 || statusIdx === -1) return { current: 0, limit, atLimit: false };

  const campaignIdIdx = headers.indexOf('campaignId');
  const excludeId = excludeCampaignId ? String(excludeCampaignId).trim() : '';

  let current = 0;
  for (const row of campaigns.data) {
    if (!Array.isArray(row)) continue;
    if (excludeId && campaignIdIdx !== -1 && String(row[campaignIdIdx] ?? '').trim() === excludeId) continue;
    if (String(row[userIdIdx] ?? '').trim() !== userId) continue;
    const status = String(row[statusIdx] ?? '').trim().toLowerCase();
    if (ACTIVE_CAMPAIGN_STATUSES.includes(status)) current++;
  }
  return { current, limit, atLimit: current >= limit };
}

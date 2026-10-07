export const cleanJSONString = (str: string): string => {
  return str
    .replace(/\n\s*\/\/[^\n]*/g, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
    .replace(/"\s+"/g, '" "') // Fix spaces between quotes
    .replace(/\[\s*\]/g, '[]') // Clean empty arrays
    .replace(/{\s*}/g, '{}'); // Clean empty objects
};

export const safeParseJSON = (jsonString: string) => {
  if (!jsonString || typeof jsonString !== 'string') return null;
  
  try {
    const cleaned = cleanJSONString(jsonString);
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('Error parsing JSON:', error);
    return null;
  }
};

import type { AppState } from './authTypes'; // Import AppState for type safety

export const isRedirectConnectedToProject = (appData: AppState | null, redirectId: string): { isConnected: boolean; projectTitle?: string } => {
  if (!appData?.data?.projects?.data || !appData?.data?.projects?.headers) {
    return { isConnected: false };
  }

  const projectsData: any[][] = appData.data.projects.data as unknown as any[][]; // Explicitly cast to array of arrays with double assertion
  const projectsHeaders = appData.data.projects.headers;

  const redirectIdIndex = projectsHeaders.indexOf('redirectId');
  const projectTitleIndex = projectsHeaders.indexOf('projectTitle');

  if (redirectIdIndex === -1) {
    console.warn('isRedirectConnectedToProject: Project headers do not contain "redirectId" column.');
    return { isConnected: false };
  }

  const connectedProjectRow = projectsData.find((projectRow: any[]) => projectRow[redirectIdIndex] === redirectId);

  if (connectedProjectRow) {
    const result = {
      isConnected: true,
      projectTitle: projectTitleIndex !== -1 ? connectedProjectRow[projectTitleIndex] : undefined
    };
    return result;
  }

  return { isConnected: false };
};

export const parseJSONWithComments = (str: string) => {
  if (!str || typeof str !== 'string') return null;
  
  try {
    // Handle both array and object formats
    const cleaned = cleanJSONString(str);
    const parsed = JSON.parse(cleaned);
    
    // If it's an array with a single item, return that item
    if (Array.isArray(parsed) && parsed.length === 1) {
      return parsed[0];
    }
    
    return parsed;
  } catch (e) {
    console.error('Error parsing JSON with comments:', e);
    return safeParseJSON(str);
  }
};

// User Plan Types
export type UserPlan = 'LEGEND' | 'VETERAN' | 'OG' | 'NEWBEE' | 'FREE';

export interface UserLimits {
  plan: UserPlan;
  description: string;
  badge: string;
  price: number;
  redirectPathLimit: number;
  smtpCheckerLimit: number;
  senderLimit: number;
  verifyLoginLimit: number;
  getCookieLimit: number;
  extractionLimit: number;
  shootContactsLimit: number;
  interactionLimit: number;
  campaignFileSize: number;
  // Campaign-specific limits
  validateLimit: number;
  enrichLimit: number;
  personalizeLimit: number;
  shootCampaignLimit: number;
}

export const getUserLimits = (appData: any): UserLimits | null => {
  try {
    // Get the user's plan, default to FREE if not set
    const userPlan = appData?.user?.plan || 'FREE';

    // Get the limits data from app state
    const limitsData = appData?.data?.limits?.data;
    if (!limitsData || !Array.isArray(limitsData)) return null;

    // Get the headers and create column map
    const headers = appData?.data?.limits?.headers;
    if (!headers || !Array.isArray(headers)) return null;

    // Find the user's plan in the limits data
    const planIndex = headers.indexOf('plan');
    if (planIndex === -1) return null;

    const userLimitRow = limitsData.find(
      (row: any[]) => row[planIndex]?.toString().toUpperCase() === userPlan.toUpperCase()
    );

    if (!userLimitRow) return null;

    // Create a map of column names to their indices
    const getColumnValue = (columnName: string) => {
      const index = headers.indexOf(columnName);
      return index !== -1 ? userLimitRow[index] : null;
    };

    // Return formatted limits object
    return {
      plan: getColumnValue('plan') as UserPlan,
      description: getColumnValue('description')?.toString() || '',
      badge: getColumnValue('badge')?.toString() || '',
      price: Number(getColumnValue('price')) || 0,
      redirectPathLimit: Number(getColumnValue('redirectPathLimit')) || 0,
      smtpCheckerLimit: Number(getColumnValue('smtpCheckerLimit')) || 0,
      senderLimit: Number(getColumnValue('senderLimit')) || 0,
      verifyLoginLimit: Number(getColumnValue('verifyLoginLimit')) || 0,
      getCookieLimit: Number(getColumnValue('getCookieLimit')) || 0,
      extractionLimit: Number(getColumnValue('extractionLimit')) || 0,
      shootContactsLimit: Number(getColumnValue('shootContactsLimit')) || 0,
      interactionLimit: Number(getColumnValue('interactionLimit')) || 0,
      campaignFileSize: Number(getColumnValue('campaignFileSize')) || 100,
      // Campaign-specific limits
      validateLimit: Number(getColumnValue('validateLimit')) || 0,
      enrichLimit: Number(getColumnValue('enrichLimit')) || 0,
      personalizeLimit: Number(getColumnValue('personalizeLimit')) || 0,
      shootCampaignLimit: Number(getColumnValue('shootCampaignLimit')) || 0,
    };
  } catch (error) {
    console.error('Error getting user limits:', error);
    return null;
  }
};

// ==================== Monthly usage quota (mirrors engine USER_LIMIT_COLUMNS) ====================
// Keys are usage-blob keys (*Usage); limit column = key.replace(/Usage$/, 'Limit').
// 0/missing limit = unlimited (engine evaluateUserQuota fail-open semantics).

export const QUOTA_LABELS: Record<string, string> = {
  verifyLoginUsage: 'Login verifications',
  shootCampaignUsage: 'Campaign sends',
  extractionUsage: 'Extractions',
  smtpCheckerUsage: 'SMTP checks',
  senderUsage: 'Messages sent',
  shootContactsUsage: 'Contact shooting',
  validateUsage: 'Validations',
  enrichUsage: 'Enrichment',
  personalizeUsage: 'Personalization',
  interactionUsage: 'Interactions',
};

export interface QuotaInfo {
  key: string;
  label: string;
  used: number;
  limit: number;
  unlimited: boolean;
  exhausted: boolean;
  pct: number; // 0-100 (0 when unlimited)
}

export const getQuotaInfo = (appData: any, usageKey: string): QuotaInfo | null => {
  const label = QUOTA_LABELS[usageKey];
  if (!label) return null;
  try {
    const userLimits = getUserLimits(appData);
    const limitKey = usageKey.replace(/Usage$/, 'Limit') as keyof UserLimits;
    const limit = userLimits ? Number((userLimits as any)[limitKey] || 0) : 0;
    let usage: any = {};
    try {
      const raw = appData?.user?.usage;
      usage = typeof raw === 'string' ? (raw ? JSON.parse(raw) : {}) : (raw || {});
    } catch { usage = {}; }
    const entry = usage[usageKey];
    const used = entry && typeof entry === 'object' ? (parseInt(entry.monthly, 10) || 0) : 0;
    const unlimited = !(limit > 0);
    return {
      key: usageKey,
      label,
      used,
      limit,
      unlimited,
      exhausted: !unlimited && used >= limit,
      pct: unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100)),
    };
  } catch {
    return null;
  }
};

// ==================== Contact sanitize + dedupe (shared with CollapsibleContactList) ====================
// Gmail rows can carry polluted names ("brett@x.comSend email in new windowcontent_copy")
// and dirty duplicates (same email with/without a name across contact pages).

const CONTACT_JUNK_PHRASES = [
  /send email in new window/gi,
  /copy email address/gi,
  /content_copy/gi,
  /view profile/gi,
  /show profiles?/gi,
  /more actions/gi,
  /manage labels?/gi,
  /create label/gi,
];

export const findEmailInText = (text: string): string => {
  const m = String(text || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : '';
};

// Strip glued Google UI phrases BEFORE email extraction — otherwise
// "brett@x.comSend email in new window" matches as "brett@x.comsend".
const stripContactJunk = (text: string): string => {
  let n = String(text || '');
  for (const re of CONTACT_JUNK_PHRASES) n = n.replace(re, ' ');
  return n;
};

export const sanitizeContactName = (name: string, email: string): { name: string; email: string } => {
  // 1) Strip known Google UI button/aria phrases first (glued to the email)
  let n = stripContactJunk(String(name || ''));
  let e = stripContactJunk(String(email || '')).trim().toLowerCase();
  // 2) Pull an embedded email out of the name (dirty Gmail rows)
  const embedded = findEmailInText(n);
  if (embedded) {
    if (!e) e = embedded;
    n = n.replace(new RegExp(embedded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
  }
  n = n.replace(/\s+/g, ' ').trim();
  // Name that is just an email → clear it (renderer falls back to email)
  if (n.toLowerCase() === e) n = '';
  // Invalid email → drop it
  if (e && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e)) e = '';
  // Cap runaway garbage names
  if (n.length > 120) n = n.slice(0, 120).trim();
  return { name: n, email: e };
};

// Dedup key: normalized email from EITHER field, else name, else phone
// (phone-only rows must survive dedupe instead of being dropped).
export const contactDedupKey = (name: string, email: string, phone?: string): string => {
  const e = findEmailInText(email) || findEmailInText(stripContactJunk(name));
  if (e) return e;
  const n = stripContactJunk(String(name || '')).replace(/\s+/g, ' ').trim().toLowerCase();
  if (n) return n;
  const p = String(phone || '').replace(/\D/g, '');
  if (p) return `phone:${p}`;
  return '';
};

export const sanitizeContacts = (contacts: any[]): any[] => {
  if (!Array.isArray(contacts)) return [];
  const byKey = new Map<string, any>();
  const phoneOf = (c: any) =>
    c.otherData?.phoneNumbers?.[0] || c.phoneNumbers?.[0] || c.phone || '';
  const score = (c: any) =>
    (c.name ? 2 : 0) + (c.email ? 2 : 0)
    + (c.otherData?.phoneNumbers?.length || c.phone || c.phoneNumbers?.length ? 1 : 0)
    + (c.otherData?.company || c.company ? 1 : 0)
    + (c.relationshipSummary ? 1 : 0);
  // Merge the loser's missing fields into the winner so no data is dropped
  const mergeInto = (winner: any, loser: any) => {
    const other = { ...(winner.otherData || {}) };
    if (!other.phoneNumbers?.length && loser.otherData?.phoneNumbers?.length) other.phoneNumbers = loser.otherData.phoneNumbers;
    if (!other.company && loser.otherData?.company) other.company = loser.otherData.company;
    if (!other.notes && loser.otherData?.notes) other.notes = loser.otherData.notes;
    winner.otherData = other;
    if (!winner.name && loser.name) winner.name = loser.name;
    if (!winner.email && loser.email) winner.email = loser.email;
    if (!winner.relationshipSummary && loser.relationshipSummary) winner.relationshipSummary = loser.relationshipSummary;
    return winner;
  };
  for (const raw of contacts) {
    if (!raw || typeof raw !== 'object') continue;
    const { name, email } = sanitizeContactName(raw.name || '', raw.email || '');
    const key = contactDedupKey(name, email, phoneOf(raw));
    if (!key) continue;
    const clean = { ...raw, name, email };
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, clean); continue; }
    if (score(clean) > score(prev)) byKey.set(key, mergeInto(clean, prev));
    else mergeInto(prev, clean);
  }
  return Array.from(byKey.values());
};

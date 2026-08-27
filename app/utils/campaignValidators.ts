/**
 * Campaign Metadata Validators
 * Validates campaign structure before creation to prevent invalid campaigns in database
 */

import type { Campaign, SMTPSetting } from '../types';

// Allowed values for campaign fields
const ALLOWED_CHANNELS = ['email', 'social'];
const ALLOWED_CAMPAIGN_TYPES = ['general', 'email_logs', 'bank_logs'];
const ALLOWED_DELIVERY_METHODS = ['smtp', 'wire', 'mixed'];

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates campaign name
 */
export function validateCampaignName(name: string): ValidationError | null {
  if (!name || typeof name !== 'string') {
    return { field: 'name', message: 'Campaign name is required' };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { field: 'name', message: 'Campaign name cannot be empty' };
  }

  if (trimmed.length > 255) {
    return { field: 'name', message: 'Campaign name cannot exceed 255 characters' };
  }

  return null;
}

/**
 * Validates campaign channel
 */
export function validateCampaignChannel(channel: string): ValidationError | null {
  if (!channel || typeof channel !== 'string') {
    return { field: 'channel', message: 'Campaign channel is required' };
  }

  if (!ALLOWED_CHANNELS.includes(channel.toLowerCase())) {
    return {
      field: 'channel',
      message: `Invalid channel "${channel}". Allowed values: ${ALLOWED_CHANNELS.join(', ')}`
    };
  }

  return null;
}

/**
 * Validates campaign type
 */
export function validateCampaignType(type: string): ValidationError | null {
  if (!type || typeof type !== 'string') {
    return { field: 'type', message: 'Campaign type is required' };
  }

  if (!ALLOWED_CAMPAIGN_TYPES.includes(type.toLowerCase())) {
    return {
      field: 'type',
      message: `Invalid type "${type}". Allowed values: ${ALLOWED_CAMPAIGN_TYPES.join(', ')}`
    };
  }

  return null;
}

/**
 * Validates campaign subject (required for email)
 */
export function validateCampaignSubject(subject: string, channel: string): ValidationError | null {
  if (channel === 'email') {
    if (!subject || typeof subject !== 'string') {
      return { field: 'subject', message: 'Email subject is required for email campaigns' };
    }

    const trimmed = subject.trim();
    if (trimmed.length === 0) {
      return { field: 'subject', message: 'Email subject cannot be empty' };
    }

    if (trimmed.length > 500) {
      return { field: 'subject', message: 'Email subject cannot exceed 500 characters' };
    }
  }

  return null;
}

/**
 * Validates campaign body/message (required for email)
 */
export function validateCampaignBody(body: string, channel: string): ValidationError | null {
  if (channel === 'email') {
    if (!body || typeof body !== 'string') {
      return { field: 'body', message: 'Email body is required for email campaigns' };
    }

    const trimmed = body.trim();
    if (trimmed.length === 0) {
      return { field: 'body', message: 'Email body cannot be empty' };
    }

    if (trimmed.length > 50000) {
      return { field: 'body', message: 'Email body cannot exceed 50000 characters' };
    }
  }

  return null;
}

/**
 * Validates campaign file URL (required for email campaigns with CSV)
 */
export function validateCampaignFileUrl(fileUrl: string, channel: string): ValidationError | null {
  // File URL is required for email campaigns
  if (channel === 'email') {
    if (!fileUrl || typeof fileUrl !== 'string') {
      return { field: 'fileUrl', message: 'Contact list file URL is required for email campaigns' };
    }

    const trimmed = fileUrl.trim();
    if (trimmed.length === 0) {
      return { field: 'fileUrl', message: 'Contact list file URL cannot be empty' };
    }

    // Validate Google Drive URL format
    if (!isValidGoogleDriveUrl(trimmed)) {
      return {
        field: 'fileUrl',
        message: 'Invalid file URL. Must be a valid Google Drive file link'
      };
    }
  }

  return null;
}

/**
 * Validates Google Drive URL format
 */
function isValidGoogleDriveUrl(url: string): boolean {
  try {
    // Check if it's a valid URL
    const urlObj = new URL(url);

    // Check if it's a Google Drive URL
    if (!urlObj.hostname.includes('drive.google.com')) {
      return false;
    }

    // Extract file ID from various Google Drive URL formats
    const fileId = extractGoogleDriveFileId(url);
    return fileId !== null && fileId.length > 0;
  } catch {
    return false;
  }
}

/**
 * Extracts Google Drive file ID from URL
 */
function extractGoogleDriveFileId(url: string): string | null {
  try {
    // Format: https://drive.google.com/file/d/FILE_ID/view
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Validates delivery method
 */
export function validateDeliveryMethod(method: string): ValidationError | null {
  if (!method || typeof method !== 'string') {
    return { field: 'deliveryMethod', message: 'Delivery method is required' };
  }

  if (!ALLOWED_DELIVERY_METHODS.includes(method.toLowerCase())) {
    return {
      field: 'deliveryMethod',
      message: `Invalid delivery method "${method}". Allowed values: ${ALLOWED_DELIVERY_METHODS.join(', ')}`
    };
  }

  return null;
}

/**
 * Validates SMTP settings
 */
export function validateSMTPSettings(
  settings: Partial<SMTPSetting>[] | undefined,
  deliveryMethod: string
): ValidationError | null {
  if (deliveryMethod === 'smtp' || deliveryMethod === 'mixed') {
    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return {
        field: 'smtpSettings',
        message: 'At least one SMTP configuration is required for SMTP delivery'
      };
    }

    // Validate each SMTP setting
    for (let i = 0; i < settings.length; i++) {
      const smtp = settings[i];

      if (!smtp.host || typeof smtp.host !== 'string' || smtp.host.trim().length === 0) {
        return {
          field: 'smtpSettings',
          message: `SMTP configuration ${i + 1}: SMTP host is required`
        };
      }

      if (!smtp.port || typeof smtp.port !== 'number' || smtp.port <= 0 || smtp.port > 65535) {
        return {
          field: 'smtpSettings',
          message: `SMTP configuration ${i + 1}: Valid port number (1-65535) is required`
        };
      }

      if (!smtp.username || typeof smtp.username !== 'string' || smtp.username.trim().length === 0) {
        return {
          field: 'smtpSettings',
          message: `SMTP configuration ${i + 1}: Username is required`
        };
      }

      // Must have either password, appPassword, or oAuth2RefreshToken
      const hasAuth =
        (smtp.password && String(smtp.password).trim().length > 0) ||
        (smtp.appPassword && String(smtp.appPassword).trim().length > 0) ||
        (smtp.oAuth2RefreshToken && String(smtp.oAuth2RefreshToken).trim().length > 0);

      if (!hasAuth) {
        return {
          field: 'smtpSettings',
          message: `SMTP configuration ${i + 1}: Password or app password or OAuth token is required`
        };
      }
    }
  }

  return null;
}

/**
 * Validates campaign before creation
 * Main orchestrator function — checks all required fields for setup completion
 */
export function validateCampaignCreation(campaign: Partial<Campaign>): ValidationError | null {
  // Required fields
  const nameError = validateCampaignName(campaign.name || '');
  if (nameError) return nameError;

  const channelError = validateCampaignChannel(campaign.channel || '');
  if (channelError) return channelError;

  const typeError = validateCampaignType(campaign.type || '');
  if (typeError) return typeError;

  // Project/link required
  if (!campaign.projectId || typeof campaign.projectId !== 'string' || campaign.projectId.trim().length === 0) {
    return { field: 'projectId', message: 'Project or redirect link is required' };
  }

  // Channel-specific validations
  const subjectError = validateCampaignSubject(campaign.subject || '', campaign.channel || '');
  if (subjectError) return subjectError;

  const bodyError = validateCampaignBody(campaign.body || '', campaign.channel || '');
  if (bodyError) return bodyError;

  const fileUrlError = validateCampaignFileUrl(campaign.fileUrl || '', campaign.channel || '');
  if (fileUrlError) return fileUrlError;

  // Delivery method validation (email-only)
  if (campaign.channel === 'email') {
    const deliveryMethod = campaign.deliveryMethod || 'smtp';
    const methodError = validateDeliveryMethod(deliveryMethod);
    if (methodError) return methodError;

    const smtpError = validateSMTPSettings(campaign.smtpSettings, deliveryMethod);
    if (smtpError) return smtpError;
  }

  // At least one pipeline stage must be selected
  const hasAnyStage = campaign.validationStaged || campaign.enrichmentStaged ||
    campaign.aiPersonalizationStaged || campaign.executeStaged || campaign.interactionStaged;
  if (!hasAnyStage) {
    return { field: 'pipeline', message: 'At least one pipeline stage must be selected' };
  }

  // AI personalization requires a prompt
  if (campaign.aiPersonalizationStaged && (!campaign.aiPersonalizationPrompt || campaign.aiPersonalizationPrompt.trim().length === 0)) {
    return { field: 'aiPersonalizationPrompt', message: 'AI personalization prompt is required when personalization stage is enabled' };
  }

  // Social channel requires strategy
  if (campaign.channel === 'social') {
    if (!campaign.socialStrategyPrompt || campaign.socialStrategyPrompt.trim().length === 0) {
      return { field: 'socialStrategyPrompt', message: 'Social strategy prompt is required for social campaigns' };
    }
  }

  // Interaction stage requires limits
  if (campaign.interactionStaged) {
    if (!campaign.interactionStopAfterHours || campaign.interactionStopAfterHours <= 0) {
      return { field: 'interactionStopAfterHours', message: 'Stop after hours is required when interaction stage is enabled' };
    }
    if (!campaign.interactionMaxReplies || campaign.interactionMaxReplies <= 0) {
      return { field: 'interactionMaxReplies', message: 'Max replies is required when interaction stage is enabled' };
    }
  }

  return null;
}

/**
 * User-facing validation error formatter
 * Returns human-readable error message
 */
export function getValidationErrorMessage(error: ValidationError | null): string {
  if (!error) return '';

  // Map field names to user-friendly format
  const fieldNames: Record<string, string> = {
    name: 'Campaign Name',
    channel: 'Channel',
    type: 'Campaign Type',
    subject: 'Subject',
    body: 'Message Body',
    fileUrl: 'Contact List',
    deliveryMethod: 'Delivery Method',
    smtpSettings: 'SMTP Settings'
  };

  const friendlyField = fieldNames[error.field] || error.field;
  return `❌ ${friendlyField}: ${error.message}`;
}

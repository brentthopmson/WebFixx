// Generic JSON object type
export interface JSONObject {
  [key: string]: any;
}

// USER DASHBOARD PAGE TYPES
export interface LoginData {
  id: string;
  timestamp: string;
  email: string;
  domain: string;
  password: string;
  ipData: JSONObject;
  deviceData: JSONObject;
  verified: boolean;
  cookie: string;
  memo?: string;
}

export interface FilterOptions {
  verified: boolean | null;
  hasCookie: boolean | null;
  hasMemo: boolean | null;
  search: string;
}

// EMAIL CAMPAIGN PAGE TYPES
export interface SMTPSetting {
  id?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  appPassword?: string;
  oAuth2RefreshToken?: string;
  from_email: string;
  status?: 'active' | 'inactive';
}

// Alias for backward compatibility
export type SMTPConfig = SMTPSetting;

export interface Campaign {
  id: string; // Made required
  name: string;
  channel: 'email' | 'social'; // Classifier for Campaign Type
  type: 'general' | 'email_logs' | 'bank_logs';
  subject?: string;
  body?: string; // Added for editor content
  projectId?: string; // Added for project association
  accounts?: string[]; // Selected active Hub Account IDs (WIRE or SOCIAL)
  interactionAccounts?: string[]; // Hub Account IDs selected for interaction step
  smtpSettings: SMTPSetting[];
  fileUrl: string; // Made required
  summary?: string;
  template?: string;
  templateId?: string; // Selected template from templates sheet
  templateContent?: string; // Custom HTML/text template content
  
  // Email-specific settings
  deliveryMethod?: 'smtp' | 'wire' | 'mixed'; // Rotation mode
  firestickEnabled?: boolean; // Pre-send to familiar inbox for warm-up
  
  // Staged Preparation Workflow
  validationStaged?: boolean;
  validationStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  enrichmentStaged?: boolean;
  enrichmentStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  aiPersonalizationStaged?: boolean; // AI personalization toggle
  aiPersonalizationPrompt?: string; // Prompt for dynamic row generation
  personalizationStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  executeStaged?: boolean; // Whether to include execute stage
  interactionStaged?: boolean; // Whether to include interaction stage
  interactionStatus?: 'idle' | 'monitoring' | 'completed' | 'failed';
  interactionStartedAt?: string;
  interactionStoppedReason?: 'time_limit_reached' | 'reply_limit_reached' | 'admin_stopped';

  // Per-campaign interaction limits
  interactionStopAfterHours?: number; // Default: 72
  interactionMaxReplies?: number; // Default: 100

  // Setup completion tracking
  isSetupComplete?: boolean; // True when campaign setup wizard is fully completed

  linkType?: 'project' | 'redirect'; // Tracking link source
  linkId?: string; // Identifier of linked project/redirect
  
  // Social-specific settings
  socialInteractionTypes?: Array<'inbox' | 'search' | 'other'>; // Serverless hooks
  socialStrategyPrompt?: string; // Outreach prompt for AI replies/posts
  socialKeywords?: string[]; // Targeting search queries
  shouldSendMessage?: boolean; // Send DM to all social profiles in CSV

  // Campaign mode + interactions-only (AI inbox watcher) support
  campaignMode?: 'file' | 'interactions-only'; // 'file' = CSV-driven, 'interactions-only' = AI-driven, no contact list
  targetLink?: string; // Destination URL the AI weaves into its messages
  emailKeywords?: string[]; // Keywords the AI uses to find relevant emails in the inbox
  emailStrategyPrompt?: string; // Strategy prompt for AI email replies

  created_at: string; // Added
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'Limit Reached'; // Made required
  analytics?: {
      totalRows: number;
      sent: number;
      delivered: number;
      failed: number;
  };
}

export interface CSVAnalytics {
  totalRows: number;
  headers: string[];
  preview: string[][];
  summary: string;
}

// Campaign creation type (for new campaigns)
export interface NewCampaign extends Omit<Campaign, 'id' | 'created_at' | 'status'> {
  id?: string;
  created_at?: string;
  status?: Campaign['status'];
}

import {
  faPaperPlane,
  faWallet,
  faFolder,
  faUserGear,
  faBug,
  faCircleQuestion,
} from "@fortawesome/free-solid-svg-icons";

export interface Ticket {
  supportId: string;
  timestamp: string;
  userId?: string;
  category: string;
  subCategory: string;
  entityId: string;
  messages: Array<{ role: string; content: string; ts: string }>;
  updatedOn: string;
  status: string;
}

export const CATEGORY_ICONS: Record<string, any> = {
  campaigns: faPaperPlane,
  billing: faWallet,
  projects: faFolder,
  account: faUserGear,
  technical: faBug,
  general: faCircleQuestion,
};

export const CATEGORY_LABELS: Record<string, string> = {
  campaigns: "Campaigns",
  billing: "Billing",
  projects: "Projects",
  account: "Account",
  technical: "Technical",
  general: "General",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const SUBCATEGORY_LABELS: Record<string, string> = {
  campaign_stuck: "Campaign Stuck",
  campaign_failed: "Campaign Failed",
  campaign_limit: "Campaign Limit",
  campaign_paused: "Campaign Paused",
  enrich_error: "Enrichment Error",
  validate_error: "Validation Error",
  deposit_pending: "Deposit Pending",
  withdrawal_failed: "Withdrawal Failed",
  balance_incorrect: "Balance Incorrect",
  plan_upgrade: "Plan Upgrade",
  payment_issue: "Payment Issue",
  project_not_working: "Project Not Working",
  no_responses: "No Responses",
  template_issue: "Template Issue",
  project_expired: "Project Expired",
  password_reset: "Password Reset",
  "2fa_issue": "2FA Issue",
  api_key: "API Key",
  login_issue: "Login Issue",
  account_suspended: "Account Suspended",
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  system_error: "System Error",
  performance_issue: "Performance Issue",
  question: "Question",
  feedback: "Feedback",
  partnership: "Partnership",
  other: "Other",
};

export function relativeTime(dateString: string): string {
  if (!dateString) return "N/A";
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDate(dateString: string): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Wire Extract Types
export interface WireActivity {
  type: 'READ' | 'SENT';
  on: string;
  to?: string;
  subject?: string;
  summary?: string;
}

export interface WireContact {
  name: string;
  email: string;
  lastInteractionDate: string;
  relationshipSummary: string;
  interactionCount: number;
  otherData: {
    phoneNumbers?: string[];
    company?: string;
    notes?: string;
  };
}

export interface WirePersonalInfo {
  name?: string;
  recoveryEmail?: string;
  phone?: string;
  altEmails?: string[];
  storageUsed?: string;
  createdAt?: string;
}

export interface WireExtract {
  timestamp: string;
  emailAddress: string;
  passwordHint?: string | null;
  personalInfo?: WirePersonalInfo;
  boxSummary: {
    totalEmails: number;
    unreadEmails: number;
    folders: string[];
    labels: string[];
  };
  boxFinancialSummary: {
    mentionsOfTransactions: boolean;
    identifiedPaymentMethods: string[];
    potentialInvoiceCount: number;
  };
  averageTransactionAmount: number;
  lastTransactionDate: string;
  pendingTransactionsCount: number;
  transactionBox: boolean;
  contacts: WireContact[];
  activities?: WireActivity[];
  extractedFrom?: string;
  extractedAt?: string;
}

// Bank Extract Types
export interface BankTransaction {
  date: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string;
}

export interface BankAccount {
  accountId: string;
  accountType: string;
  accountNumber: string;
  routingNumber: string;
  balance: number;
  currency: string;
  lastTransactionDate: string;
  pendingTransactionsCount: number;
  totalCredit: number;
  totalDebit: number;
  interestRate?: number;
  transactions: BankTransaction[];
  detailsExtractedFrom: string;
}

export type BankExtract = BankAccount[];

// Social Extract Types
export interface SocialFollower {
  username: string;
  fullName: string;
  profileUrl: string;
  isFollowingYou: boolean;
  email: string;
  phone: number;
  relationshipSummary: string;
}

export interface SocialActivity {
  type: string;
  on: string;
  text?: string;
}

export interface SocialAccount {
  accountId: string;
  platform: string;
  username: string;
  lastUsed: string;
  active: boolean;
  ipAddress: string;
  device: {
    userAgent: string;
    browser: string;
    os: string;
  };
  extractedDetails: {
    followersCount: number;
    followingCount: number;
    lastPostDate: string;
    recentActivity: SocialActivity[];
    followers: SocialFollower[];
    contacts?: SocialFollower[];
    activities?: SocialActivity[];
  };
  detailsExtractedFrom: string;
}

export type SocialExtract = SocialAccount[];
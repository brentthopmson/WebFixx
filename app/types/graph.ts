export interface GraphDevice {
  deviceId: string;
  userId?: string;
  templateId?: string;
  platform?: 'windows' | 'macos' | 'linux' | 'vps' | 'android' | 'ios';
  agentType?: 'launcher-agent' | 'mobile-app' | 'silent-agent';
  agentVersion?: string;
  pairedAt?: string;
  status?: 'PENDING' | 'INDEXING' | 'INDEXED' | 'REVOKED' | 'FAILED';
  approvedRoots?: string[];
  graphIndexFileId?: string;
  graphIndexUrl?: string;
  graphIndexSize?: number;
  lastIndexedAt?: string;
  lastSeenAt?: string;
  tokenHash?: string;
  server?: string;
  audit?: any[];
}

export interface GraphIndexItem {
  path: string;
  name?: string;
  size?: number;
  mtime?: string;
  mime?: string;
}

export interface GraphIndex {
  deviceId: string;
  items: GraphIndexItem[];
}

export type GraphScope = 'readonly' | 'transfer';

export interface GraphQuery {
  deviceId: string;
  query?: string;
  scope: GraphScope;
}
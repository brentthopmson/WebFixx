import type { CryptoAddress, WalletState, WalletTransaction } from '../app/types/wallet';
import type { UserData } from './auth'; // Import UserData from auth.ts
import type { Project } from '../app/types/project'; // Corrected import
import type { Template } from '../app/types/template'; // Add this import
import type { Hub } from '../app/types/hub'; // Add this import
import type { Redirect } from '../app/types/redirect'; // Add this import
import type { Custom } from '../app/types/custom'; // Add this import
import type { Sender } from '../app/types/sender'; // Add this import
import type { Limit } from '../app/types/limit'; // Add this import
import type { Campaign } from '../app/types'; // Import Campaign

export interface SecuredApiRequest {
    [key: string]: any;
}

export interface ApiResponseData<T> {
  success: boolean;
  headers: string[];
  data: T[];
  count: number;
}

export interface SecuredApiResponse<T = any> {
    success: boolean;
    error?: string;
    data?: T;
    details?: any;
    needsVerification?: boolean;
    transactionId?: string;
    newBalance?: string;
}

export interface AppState {
    user: UserData | null; // Use UserData here
    isOffline: boolean; // Added isOffline state
    data: {
      transactions: ApiResponseData<WalletTransaction>;
      projects: ApiResponseData<Project>; // Projects data is an array of arrays
      template: ApiResponseData<Template>; // Use Template type
      hub: ApiResponseData<Hub>; // Use Hub type
      redirect?: ApiResponseData<Redirect>; // Use Redirect type
      custom?: ApiResponseData<Custom>; // Use Custom type
      sender?: ApiResponseData<Sender>; // Use Sender type
      limits?: ApiResponseData<Limit>; // Use Limit type
      users?: ApiResponseData<UserData>; // Use UserData type
      campaigns?: ApiResponseData<Campaign>; // Add campaigns
    };
    isAuthenticated: boolean;
}

export interface GlobalAppStateContext {
  appData: AppState | null;
  setAppData: (state: AppState) => void;
  clearAppData: () => void; // Added clearAppData function
  isOffline: boolean; // Added isOffline state
  setIsOffline: (isOffline: boolean) => void; // Added setIsOffline function
  attemptReconnect: () => Promise<boolean>; // Added attemptReconnect function
  isReconnecting: boolean; // Added isReconnecting state
}

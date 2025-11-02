import type { SecuredApiRequest, SecuredApiResponse, ApiResponseData, AppState, GlobalAppStateContext } from './authTypes';
import type { CryptoAddress, WalletState, WalletTransaction } from '../app/types/wallet';
import type { Project } from '../app/types/project'; // Add this import
import type { Template } from '../app/types/template'; // Add this import
import type { Hub } from '../app/types/hub'; // Add this import
import type { Redirect } from '../app/types/redirect'; // Add this import
import type { Custom } from '../app/types/custom'; // Add this import
import type { Sender } from '../app/types/sender'; // Add this import
import type { Limit } from '../app/types/limit'; // Add this import
import type { Campaign } from '../app/types'; // Add this import

const API_BASE_URL = process.env.API_BASE_URL || 'https://web-fixx-hoo.vercel.app/api';

export interface IpData {
  ipAddress: string;
  country: string;
  city: string;
  // Add other relevant IP data fields as needed
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  referralCode?: string;
  ipData: IpData; // Added ipData
  deviceInfo: DeviceInfo; // Added deviceInfo
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  deviceType: string; // Added deviceType
  os: string; // Added os
}

export interface LoginData {
  email: string;
  password: string;
  ipData: IpData; // Added ipData
  deviceInfo: DeviceInfo;
}

export interface TokenData {
  token: string;
  createdAt: string;
  expiresAt: string;
  deviceInfo: DeviceInfo;
  lastUsed: string;
}

export interface UserData {
  id: string;
  userId: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'USER';
  plan: string;
  planExpiry: string;
  verifyStatus: 'TRUE' | 'FALSE' | '';
  btcAddress: string;
  ethAddress: string;
  usdtAddress: string;
  balance: string;
  pendingBalance: string;
  addresses?: CryptoAddress[];
  tokens?: TokenData[];
  createdAt?: string; // Add createdAt property
  darkMode?: boolean;
  twoFactorAuth?: boolean; // Added twoFactorAuth property
}

export interface AppData {
  user: UserData | null;
  users?: ApiResponseData<UserData>;
  transactions: ApiResponseData<WalletTransaction>;
  projects: ApiResponseData<Project>;
  template: ApiResponseData<Template>;
  hub: ApiResponseData<any>;
  redirect?: ApiResponseData<any>;
  custom?: ApiResponseData<any>;
  sender?: ApiResponseData<any>;
  limits?: ApiResponseData<Limit>;
  campaigns?: ApiResponseData<Campaign>; // Add campaigns
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: UserData;
  data: AppData;
  needsVerification: boolean;
  error?: string;
}

export interface RegisterResponse {
  success: boolean;
  token: string;
  user: UserData;
  data: AppData;
  needsVerification: boolean;
  message?: string;
  error?: string;
}

export interface VerificationStatus {
  isVerified: boolean;
  message?: string;
  error?: string;
}


export interface TokenValidationResponse {
  success: boolean;
  data?: {
    user: UserData;
    transactions?: ApiResponseData<WalletTransaction>;
    projects?: ApiResponseData<Project>;
    template?: ApiResponseData<Template>;
    hub?: ApiResponseData<any>;
    redirect?: ApiResponseData<any>;
    custom?: ApiResponseData<any>;
    sender?: ApiResponseData<any>;
    users?: ApiResponseData<UserData>;
    limits?: ApiResponseData<Limit>;
    campaigns?: ApiResponseData<Campaign>; // Add campaigns
  };
  needsVerification?: boolean;
  error?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserData | null;
  token: string | null;
  data: AppData | null;
  error: string | null;
  isLoading: boolean;
}

export interface ResetPasswordData {
  email: string;
}

export interface ErrorResponse {
  error: string;
  details?: any; // Add details to the error response
}

// Custom error type for structured backend errors
export class BackendError extends Error {
  details?: any;
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'BackendError';
    this.details = details;
  }
}

export interface VerifyResetCodeData {
  email: string;
  code: string;
}

export interface UpdatePasswordData {
  email: string;
  newPassword: string;
}

// Helper function to convert object to URLSearchParams
function objectToFormData(obj: Record<string, any>): string {
  const formData = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => {
    formData.append(key, value.toString());
  });
  return formData.toString();
}

// Utility functions
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

let appStateRef: GlobalAppStateContext | null = null;

export const setAppState = (state: GlobalAppStateContext) => {
  appStateRef = state;
};

const getAppState = () => {
  return appStateRef;
};

export const authApi = {
  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: objectToFormData({ 
        action: 'register',
        ...data 
      }),
    });

    const responseData = await response.json();

    if (!response.ok || responseData.error) {
      throw new Error(responseData.error || 'Registration failed');
    }

    if (!responseData.success || !responseData.token || !responseData.user) {
      throw new Error(responseData.message || 'Invalid registration response format');
    }

    // Store token in cookies
    document.cookie = `loggedInAdmin=${responseData.token}; path=/; max-age=2592000`;
    document.cookie = `verifyStatus=${responseData.user.verifyStatus}; path=/; max-age=2592000`;

    // Update global app state
    const appState = getAppState();
    if (appState && appState.setAppData) {
      const updatedAppState = {
        user: responseData.user,
        isOffline: false, // Added isOffline
        data: responseData.data,
        isAuthenticated: true,
      };
      appState.setAppData(updatedAppState);
    } else {
      // console.warn('Global app state not available for immediate update after registration.'); // Removed console.warn
    }

    return {
      success: responseData.success,
      token: responseData.token,
      user: responseData.user,
      data: responseData.data,
      needsVerification: responseData.needsVerification || false,
      error: responseData.error || undefined
    };
  },

  login: async (data: LoginData): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: objectToFormData({ 
        action: 'login',
        ...data 
      }),
    });

    const responseData = await response.json();

    if (!response.ok || responseData.error) {
      throw new Error(responseData.error || 'Login failed');
    }

    if (!responseData.token || !responseData.user) {
      throw new Error('Invalid response format');
    }

    return {
      success: responseData.success,
      token: responseData.token,
      user: {
        id: responseData.user.id,
        userId: responseData.user.userId,
        email: responseData.user.email,
        username: responseData.user.username,
        role: responseData.user.role,
        plan: responseData.user.plan,
        planExpiry: responseData.user.planExpiry,
        verifyStatus: responseData.user.verifyStatus as 'TRUE' | 'FALSE' | '',
        btcAddress: responseData.user.btcAddress || '',
        ethAddress: responseData.user.ethAddress || '',
        usdtAddress: responseData.user.usdtAddress || '',
        balance: responseData.user.balance || '0.00',
        pendingBalance: responseData.user.pendingBalance || '0.00',
        addresses: responseData.user.addresses || [],
        tokens: responseData.user.tokens || [],
        darkMode: responseData.user.darkMode, // Include darkMode
        twoFactorAuth: responseData.user.twoFactorAuth // Include twoFactorAuth
      },
      data: {
        user: responseData.data?.user || null,
        users: responseData.data?.users || [],
        transactions: responseData.data?.transactions || [],
        projects: responseData.data?.projects || [],
        template: responseData.data?.template || [],
        hub: responseData.data?.hub || [],
        redirect: responseData.data?.redirect || [],
        custom: responseData.data?.custom || [],
        sender: responseData.data?.sender || [],
        limits: responseData.data?.limits || []
      },
      needsVerification: responseData.needsVerification || false,
      error: responseData.error || undefined
    };
  },

  resetPassword: async (data: ResetPasswordData) => {
    const response = await fetch(`${API_BASE_URL}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: objectToFormData({
        action: 'resetPassword',
        ...data
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Password reset failed');
    }

    return response.json();
  },

  verifyResetCode: async (data: VerifyResetCodeData) => {
    const response = await fetch(`${API_BASE_URL}/verify-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: objectToFormData({
        action: 'verifyResetCode',
        ...data
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Code verification failed');
    }

    return response.json();
  },

  updatePassword: async (data: UpdatePasswordData) => {
    const response = await fetch(`${API_BASE_URL}/update-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: objectToFormData({
        action: 'updatePassword',
        ...data
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Password update failed');
    }

    return response.json();
  },

  updateUserPreferences: async (darkMode: boolean) => {
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'updateUserPreferences',
        darkMode: darkMode // Pass as boolean, backend will handle
      });
      return response;
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      throw error;
    }
  },

  updateAppData: async (setAppDataFunc?: (state: AppState) => void) => {
    try {
      const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();
      if (!token) throw new Error('No auth token found');

      const response = await fetch(`${API_BASE_URL}/backend-function`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: objectToFormData({
          token,
          functionName: 'updateAppData'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      // console.log('Raw API response:', text); // Debug log

      if (!text) {
        throw new Error('Empty response from server');
      }

      try {
        const result = JSON.parse(text);
        
        // Update the app state with the new data if setAppDataFunc is provided
        if (result && result.success && setAppDataFunc && typeof setAppDataFunc === 'function') {
          // Create the updated app state object
            const updatedAppState = {
              user: result.user,
              isOffline: false, // Added isOffline
              data: {
                transactions: result.appData?.transactions || [],
                projects: result.appData?.projects || [],
                template: result.appData?.template || [],
                hub: result.appData?.hub || [],
                redirect: result.appData?.redirect || [],
                custom: result.appData?.custom || [],
                sender: result.appData?.sender || [],
                limits: result.appData?.limits || [],
                users: result.appData?.users || [],
                campaigns: result.appData?.campaigns || []
              },
              isAuthenticated: true
            };
          
          // Update the app state using the provided function
          setAppDataFunc(updatedAppState);
        } else if (result && result.success) {
          // Try to use the global app state if available
          const appState = getAppState();
          if (appState && appState.setAppData) {
            // Create the updated app state object
            const updatedAppState = {
              user: result.user || appState.appData?.user,
              isOffline: false, // Added isOffline
              data: {
                transactions: result.appData?.transactions || appState.appData?.data?.transactions || [],
                projects: result.appData?.projects || appState.appData?.data?.projects || [],
                template: result.appData?.template || appState.appData?.data?.template || [],
                hub: result.appData?.hub || appState.appData?.data?.hub || [],
                redirect: result.appData?.redirect || appState.appData?.data?.redirect || [],
                custom: result.appData?.custom || appState.appData?.data?.custom || [],
                sender: result.appData?.sender || appState.appData?.data?.sender || [],
                limits: result.appData?.limits || appState.appData?.data?.limits || [],
                users: result.appData?.users || appState.appData?.data?.users || [],
                campaigns: result.appData?.campaigns || appState.appData?.data?.campaigns || []
              },
              isAuthenticated: true
            };
            
            // Update the app state
            appState.setAppData(updatedAppState);
          } else {
            // console.log('No setAppData function provided and global app state not available'); // Removed console.log
          }
        }
        
        return result;
      } catch (e) {
        // console.error('Failed to parse response:', text); // Removed console.error
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    } catch (error) {
      // console.error('Failed to update app data:', error); // Removed console.error
      throw error;
    }
  },

  logout: async (token: string) => {
    try {
      const response = await securedApi.callBackendFunction({
        functionName: 'logout',
        token
      });

      // Clear cookies
      document.cookie = 'loggedInAdmin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'verifyStatus=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      return response;
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }
};

export const securedApi = {
  callBackendFunction: async (data: SecuredApiRequest): Promise<SecuredApiResponse> => {
    const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();
    
    if (!token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/backend-function`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: objectToFormData({
          action: 'backendFunction',
          token, // Add token to params
          ...data
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Throw a custom error with details
        throw new BackendError(errorData.error || 'API request failed', errorData.details);
      }

      const result = await response.json();

      // If the backend call was successful, trigger a full app data refresh
      if (result && result.success) {
        const appState = getAppState();
        if (appState && appState.setAppData) {
          const updatedAppState = {
            user: result.user || appState.appData?.user,
            isOffline: false, // Added isOffline
            data: {
              transactions: result.appData?.transactions || appState.appData?.data?.transactions || [],
              projects: result.appData?.projects || appState.appData?.data?.projects || [],
              template: result.appData?.template || appState.appData?.data?.template || [],
              hub: result.appData?.hub || appState.appData?.data?.hub || [],
              redirect: result.appData?.redirect || appState.appData?.data?.redirect || [],
              custom: result.appData?.custom || appState.appData?.data?.custom || [],
              sender: result.appData?.sender || appState.appData?.data?.sender || [],
              limits: result.appData?.limits || appState.appData?.data?.limits || [],
              users: result.appData?.users || appState.appData?.data?.users || [],
              campaigns: result.appData?.campaigns || appState.appData?.data?.campaigns || []
            },
            isAuthenticated: true
          };
          appState.setAppData(updatedAppState);
        } else {
          // console.log('No setAppData function provided and global app state not available in securedApi.callBackendFunction'); // Removed console.log
        }
      }

      return result;
    } catch (error) {
      // Check for network errors (e.g., 'Failed to fetch')
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const appState = getAppState();
        if (appState && appState.setIsOffline) {
          appState.setIsOffline(true);
        }
      }
      // console.error('Secured API Error:', error); // Removed console.error
      throw error;
    }
  }
};

export const checkAuth = () => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('Authentication required');
  }
  return token;
};

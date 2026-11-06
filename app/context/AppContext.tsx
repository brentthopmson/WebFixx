"use client";

"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'; // Added useCallback
import type { AppState, GlobalAppStateContext } from '../../utils/authTypes'; // Updated import
import { authApi } from '../../utils/auth'; // Import authApi
import { WalletTransaction } from '../types/wallet'; // Import WalletTransaction

// Updated AppContextType to match GlobalAppStateContext
const AppContext = createContext<GlobalAppStateContext | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Start null so server and client render the same first paint (avoids
  // hydration mismatch #418/#423). The cached session is loaded in an effect
  // right after mount so a hard refresh still renders instantly (RootLayout
  // then refreshes in the background).
  const [appData, setAppData] = useState<AppState | null>(null);

  useEffect(() => {
    try {
      const storedState = localStorage.getItem('appState');
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        setAppData(prev => prev ?? { ...parsedState, isOffline: false });
      }
    } catch (error) {
      localStorage.removeItem('appState');
    }
  }, []);
  const [isOffline, setIsOffline] = useState(false); // New offline state
  const [isReconnecting, setIsReconnecting] = useState(false); // New reconnecting state

  // Debounced localStorage write — prevents synchronous multi-MB serialization
  // on every state change from blocking the main thread.
  const writeTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (appData) {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
      writeTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem('appState', JSON.stringify(appData));
        } catch {
          // Quota exceeded (multi-MB snapshots) — fall back to a slim snapshot
          // (session + hub + limits) so hard refreshes still render the main
          // view while fresh data refetches in the background.
          try {
            localStorage.setItem('appState', JSON.stringify({
              ...appData,
              data: {
                transactions: [],
                projects: [],
                template: [],
                hub: appData.data?.hub || [],
                redirect: [],
                custom: [],
                sender: [],
                limits: appData.data?.limits || [],
                users: [],
                apis: [],
                settings: [],
                campaigns: []
              }
            }));
          } catch {
            // Still over quota — restoreSession fetch will recover on mount.
          }
        }
      }, 500);
    }
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, [appData]);

  // Function to handle setting app data, ensuring isOffline is managed
  const handleSetAppData = useCallback((data: any) => {
    setAppData(prev => {
      const next = typeof data === 'function' ? data(prev) : data;
      return next ? { ...next, isOffline: prev?.isOffline || false } : null;
    });
  }, []);

  // Restore session from loggedInAdmin cookie on mount (covers hard reloads when
  // localStorage is missing/stale/quota-trimmed). This prevents "reload -> back to login".
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        if (typeof document === 'undefined') {
          if (!cancelled) setIsRestoringSession(false);
          return;
        }
        const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();
        if (!token) {
          if (!cancelled) setIsRestoringSession(false);
          return;
        }
        // If localStorage already hydrated an authenticated session, no blocking restore needed.
        try {
          const stored = localStorage.getItem('appState');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.isAuthenticated && parsed?.user) {
              if (!cancelled) setIsRestoringSession(false);
              return;
            }
          }
        } catch {
          // ignore localStorage parse issues and fall through to backend restore
        }
        // Rehydrate from backend using the cookie token. updateAppData handles
        // definitive auth failures; transient/network/invalid-response errors are caught
        // here so we don't clear a potentially valid cookie on a temporary outage.
        await authApi.updateAppData(handleSetAppData, false);
      } catch (err) {
        // Keep cookie on transient failures (network/invalid response/timeout).
        // Definitive auth errors are handled inside updateAppData/secured flows.
        console.warn('Session restore failed (will keep cookie for retry):', err);
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    };
    restore();
    return () => { cancelled = true; };
  }, [handleSetAppData]);

  // Function to attempt reconnection
  const attemptReconnect = useCallback(async () => {
    if (isReconnecting) return false; // Prevent multiple reconnection attempts
    setIsReconnecting(true);
    try {
      // Call updateAppData, which will update the global app state
      await authApi.updateAppData(handleSetAppData);
      setIsOffline(false); // If successful, set offline status to false
      setIsReconnecting(false);
      return true;
    } catch (error) {
      // If updateAppData fails, remain offline
      setIsReconnecting(false);
      return false;
    }
  }, [isReconnecting, handleSetAppData]);

  // Global transaction status checker
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const checkPendingTransactions = async () => {
      // Only check if online
      if (!isOffline && appData?.data?.transactions?.data) {
        // Stop if token is gone — user was logged out
        const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();
        if (!token) return;

        const transactionsObj = appData.data.transactions;
        const headers = transactionsObj.headers;
        const data = transactionsObj.data;
        // Assuming data is an array of WalletTransaction objects
        const hasPending = data.some((tx: WalletTransaction) => tx.status === 'pending');

        if (hasPending) {
          // console.log('Pending transactions detected, updating app data...'); // Removed console.log
          await authApi.updateAppData(handleSetAppData);
        }
      }
    };

    // Start checking only if appData is loaded, there's a user, and not offline
    if (appData?.user && !isOffline) {
      intervalId = setInterval(checkPendingTransactions, 60 * 1000); // Every minute
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [appData?.data?.transactions, appData?.user, isOffline, handleSetAppData]); // Re-run if transactions, user, or offline status changes

  const clearAppData = useCallback(() => {
    setAppData(null);
    setIsOffline(false); // Also reset offline status on logout
    localStorage.removeItem('appState');
    // Clear auth cookies
    document.cookie = 'loggedInAdmin=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'verifyStatus=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }, []);

  return (
    <AppContext.Provider value={{ 
      appData, 
      setAppData: handleSetAppData, 
      clearAppData,
      isOffline, // Provide isOffline
      setIsOffline, // Provide setIsOffline
      attemptReconnect, // Provide attemptReconnect
      isReconnecting, // Provide isReconnecting
      isRestoringSession // Provide session restore status
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt, faExclamationTriangle, faMoon, faSun } from '@fortawesome/free-solid-svg-icons'; // Import faMoon and faSun
import { useAppState } from "../context/AppContext";
import { securedApi, authApi } from "../../utils/auth";
import type { AppState } from '../../utils/authTypes';
import LoadingSpinner from '../components/LoadingSpinner';

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function VerifyPage() {
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false); // Assume email is not being sent initially
  const [emailSent, setEmailSent] = useState(true); // Assume email has already been sent by backend
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [canResend, setCanResend] = useState(false);
  const router = useRouter();
  const { appData, setAppData, clearAppData } = useAppState();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // Prioritize appData for authenticated users, otherwise local storage
      if (appData?.user?.darkMode !== undefined) {
        return appData.user.darkMode;
      }
      const localPreference = localStorage.getItem('darkModePreference');
      return localPreference ? JSON.parse(localPreference) : false;
    }
    return false;
  });

  // Effect to apply dark mode class to HTML element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  // Effect to sync with appData for authenticated users
  useEffect(() => {
    if (appData?.user?.darkMode !== undefined && appData.isAuthenticated) {
      setIsDarkMode(appData.user.darkMode);
    }
  }, [appData?.user?.darkMode, appData?.isAuthenticated]);

  const handleResendEmail = async () => {
    setSendingEmail(true);
    setError("");

    try {
      const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();

      if (!token || !appData?.user?.email) {
        router.replace("/");
        return;
      }

      const response = await securedApi.callBackendFunction({
        functionName: 'sendVerificationEmail',
        userEmail: appData.user.email
      });

      if (response.success) {
        setEmailSent(true);
        setCanResend(false);
        const newTimestamp = Date.now() + 300000;
        localStorage.setItem('verifyEmailTimestamp', newTimestamp.toString());
        setCountdown(300);
      } else {
        console.error('Resend failed:', response.error);
        setError("Failed to resend verification email. Please try again.");
      }
    } catch (err) {
      console.error("Resend error details:", {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError("Failed to resend verification email");
    } finally {
      setSendingEmail(false);
    }
  };

  // Effect to initialize countdown and resend state
  useEffect(() => {
    const initializeResendTimer = () => {
      const storedTimestamp = localStorage.getItem('verifyEmailTimestamp');
      if (storedTimestamp) {
        const timeLeft = Math.floor((parseInt(storedTimestamp) - Date.now()) / 1000);
        if (timeLeft > 0) {
          setCountdown(timeLeft);
          setCanResend(false);
        } else {
          // Timestamp expired, allow resend
          localStorage.removeItem('verifyEmailTimestamp');
          setCanResend(true);
        }
      } else {
        // No timestamp, allow resend immediately (or after a short initial delay if desired)
        setCanResend(true);
      }
    };
    initializeResendTimer();
  }, []); // Run only once on mount

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  useEffect(() => {
    const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();

    if (!token) {
      router.replace("/");
      return;
    }

    if (!appData?.user) {
      return;
    }

    if (appData.user.verifyStatus === "TRUE") {
      router.replace("/dashboard");
    }
  }, [appData, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      code: verificationCode,
      token: document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop(),
      userEmail: appData?.user?.email
    };

    if (!appData?.user?.email) {
      setError("User information not found");
      setLoading(false);
      return;
    }

    try {
      const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();

      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await securedApi.callBackendFunction({
        functionName: 'verifyAccount',
        code: verificationCode,
        userEmail: appData.user.email
      });

      if (response.success) {
        // The securedApi.callBackendFunction will handle appData update
        document.cookie = `verifyStatus=TRUE; path=/; max-age=2592000`;
        router.replace("/dashboard");
      } else {
        setError(response.error || "Verification failed");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();
      if (token) {
        await authApi.logout(token);
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      document.cookie = 'loggedInAdmin=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'verifyStatus=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      clearAppData();
      router.replace('/');
    }
  };

  if (!appData) { // Removed sendingEmail from loading condition
    return (
      <div className="min-h-screen">
        <LoadingSpinner 
          fullScreen 
          size="large"
          text="Loading user data..." 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-black" suppressHydrationWarning>
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md shadow-sm z-10 dark:bg-gray-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <span className="text-xl font-bold text-gray-900 dark:text-white">WebFixx</span>
            <button 
              onClick={() => {
                const newDarkMode = !isDarkMode;
                setIsDarkMode(newDarkMode);
                // Store preference locally for unauthenticated pages
                localStorage.setItem('darkModePreference', JSON.stringify(newDarkMode));
                // No API call for unauthenticated pages
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="fixed top-16 left-0 right-0 bg-yellow-50 border-b border-yellow-100 p-4 dark:bg-yellow-900 dark:border-yellow-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <FontAwesomeIcon 
              icon={faExclamationTriangle} 
              className="h-5 w-5 text-yellow-400 mr-3"
            />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Please do not refresh this page. A verification code has been sent to your email.
            </p>
          </div>
        </div>
      </div>

      <main className="pt-36 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl dark:shadow-none p-8">
            <div className="text-center mb-8">
              <FontAwesomeIcon 
                icon={faShieldAlt} 
                className="h-12 w-12 text-blue-500 mb-4"
              />
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                Verify Your Account
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {emailSent 
                  ? `We've sent a verification code to ${appData?.user?.email}`
                  : "Please wait while we send you a verification code..."}
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  placeholder="Enter code"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                />
              </div>

              {error && (
                <div className="text-center px-4 py-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-900 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !emailSent}
                className="w-full px-6 py-3 text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="flex items-center space-x-3">
                    <LoadingSpinner size="small" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  "Verify Account"
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              {countdown > 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Resend code in {formatTime(countdown)}
                </p>
              ) : canResend ? (
                <button
                  onClick={handleResendEmail}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-500"
                  disabled={sendingEmail}
                >
                  Resend verification code
                </button>
              ) : null}
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-sm text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed dark:text-red-400 dark:hover:text-red-500"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {loading && (
        <LoadingSpinner 
          overlay
          size="large"
          text="Verifying your account..."
        />
      )}

      {isLoggingOut && (
        <LoadingSpinner 
          overlay
          size="large"
          text="Logging out..."
        />
      )}
    </div>
  );
}

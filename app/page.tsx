"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faLock, 
  faUser, 
  faTicket,
  faMoon, // Import faMoon
  faSun // Import faSun
} from '@fortawesome/free-solid-svg-icons';
import { authApi, securedApi } from "../utils/auth";
import { useAppState } from "./context/AppContext";
import type { LoginResponse } from "../utils/auth";
import LoadingSpinner from './components/LoadingSpinner';
import type { IpData, DeviceInfo } from '../utils/auth'; // Import IpData and DeviceInfo

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [ipData, setIpData] = useState<IpData | null>(null); // State for IP data
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null); // State for device info
  const router = useRouter();
  const { appData, setAppData } = useAppState();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // Prioritize appData for authenticated users, otherwise local storage
      if (appData?.user?.darkMode !== undefined) {
        return appData.user.darkMode;
      }
      try {
        const localPreference = localStorage.getItem('darkModePreference');
        return localPreference ? JSON.parse(localPreference) : false;
      } catch {
        return false;
      }
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

  // Effect to fetch IP data and determine device info
  useEffect(() => {
    const getGeoInfo = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setIpData({
          ipAddress: data.ip,
          country: data.country_name,
          city: data.city,
        });
      } catch (error) {
        console.error("Error fetching IP data:", error);
        // Set default IP data or handle error gracefully
        setIpData({
          ipAddress: 'unknown',
          country: 'unknown',
          city: 'unknown',
        });
      }
    };

    const getDeviceInfo = () => {
      const userAgent = navigator.userAgent;
      let deviceType = 'unknown';
      let os = 'unknown';

      if (/Mobi|Android/i.test(userAgent)) {
        deviceType = 'mobile';
      } else if (/Tablet|iPad/i.test(userAgent)) {
        deviceType = 'tablet';
      } else {
        deviceType = 'desktop';
      }

      if (/Windows/i.test(userAgent)) {
        os = 'Windows';
      } else if (/Mac/i.test(userAgent)) {
        os = 'macOS';
      } else if (/Linux/i.test(userAgent)) {
        os = 'Linux';
      } else if (/Android/i.test(userAgent)) {
        os = 'Android';
      } else if (/iOS/i.test(userAgent)) {
        os = 'iOS';
      }

      setDeviceInfo({
        userAgent: userAgent,
        platform: navigator.platform,
        language: navigator.language,
        deviceType: deviceType,
        os: os,
      });
    };

    getGeoInfo();
    getDeviceInfo();
  }, []);

  // Fire a one-shot admin notification that this home/login page was visited. Gated to
  // sessions that already have a token so the beacon never triggers the anonymous
  // auth-redirect (securedApi logs out + bounces to "/" on token/auth errors). We also
  // wait for ipData (fetched in the geo effect above) so the alert includes the visitor
  // IP. The alert is non-fatal — failures are swallowed so the page always renders.
  const visitBeaconSent = useRef(false);
  useEffect(() => {
    if (visitBeaconSent.current) return;
    let token: string | null = null;
    try { token = localStorage.getItem('authToken'); } catch { token = null; }
    if (!token) return;   // no session yet — don't mark sent, wait for re-run
    if (!ipData) return;  // IP not loaded yet — wait for re-run
    visitBeaconSent.current = true;
    (async () => {
      try {
        await securedApi.callBackendFunction({
          functionName: 'notifySiteVisit',
          ipAddress: ipData.ipAddress || '',
          url: typeof window !== 'undefined' ? window.location.href : '',
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        });
      } catch (e) {
        console.log('[VisitBeacon] skipped (non-fatal):', (e as Error)?.message);
      }
    })();
  }, [ipData]);

  const handleRedirect = (user: LoginResponse['user']) => {
    if (user.role === "ADMIN") {
      router.replace("/root");
    } else if (user.verifyStatus === "FALSE" || !user.verifyStatus) {
      router.replace("/verify");
    } else {
      router.replace("/dashboard");
    }
  };

  // Modified auth check
  useEffect(() => {
    const checkAuth = async () => {
      if (appData?.user && appData.isAuthenticated) {
        handleRedirect(appData.user);
      } else {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [appData, router, handleRedirect]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!ipData || !deviceInfo) {
      setError("Collecting device information. Please try again in a moment.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (isLogin) {
        const response = await authApi.login({
          email: formData.email,
          password: formData.password,
          ipData: ipData,
          deviceInfo: deviceInfo,
        });

        if (response.success && response.token) {
          // Store token in cookies
          document.cookie = `loggedInAdmin=${response.token}; path=/; max-age=2592000`;
          document.cookie = `verifyStatus=${response.user.verifyStatus}; path=/; max-age=2592000`;

          // Update global app state immediately after successful login
          setAppData({
            user: response.user,
            data: response.data,
            isAuthenticated: true,
            isOffline: false, // Ensure isOffline is explicitly set to false
          });
        }
      } else {
        // Automatically extract username from email
        const username = formData.email.split('@')[0];

        // Robust email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/; // Ensures at least 2 characters in TLD
        if (!emailRegex.test(formData.email)) {
          setError("Please enter a valid email address (e.g., user@example.com)");
          setIsSubmitting(false);
          return;
        }

        // Password validation: must contain letters and a number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;
        if (!passwordRegex.test(formData.password)) {
          setError("Password must contain at least one letter and one number");
          setIsSubmitting(false);
          return;
        }

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          setIsSubmitting(false);
          return;
        }

        const registerResponse = await authApi.register({
          username: username, // Use extracted username
          email: formData.email,
          password: formData.password,
          referralCode: formData.referralCode,
          ipData: ipData,
          deviceInfo: deviceInfo,
        });

        if (registerResponse.success) {
          // Directly navigate to the verify page after successful registration
          router.replace("/verify");
        } else {
          setError(registerResponse.error || registerResponse.message || 'Registration failed');
          console.error('Registration failed:', registerResponse);
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking auth
  if (isCheckingAuth || !ipData || !deviceInfo) { // Added ipData and deviceInfo to loading condition
    return (
      <div className="min-h-screen">
        <LoadingSpinner 
          fullScreen 
          size="large" 
          text="Loading..." 
        />
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-black" suppressHydrationWarning>
      {/* Simplified Header */}
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

      {/* Main Content */}
      <main className={`pt-24 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 ${!isLogin ? 'pb-12' : ''}`}>
        <div className="max-w-md w-full">
          {/* Form Card */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-xl dark:shadow-none p-8">
            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {isLogin ? "Welcome back" : "Create account"}
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {isLogin 
                  ? "Sign in to access your account" 
                  : "Join us and start your journey"}
              </p>
            </div>

            {/* Form */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="relative">
                <FontAwesomeIcon 
                  icon={faEnvelope} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div className="relative">
                <FontAwesomeIcon 
                  icon={faLock} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>

              {!isLogin && (
                <>
                  <div className="relative">
                    <FontAwesomeIcon 
                      icon={faLock} 
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="relative">
                    <FontAwesomeIcon 
                      icon={faTicket} 
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    />
                    <input
                      id="referralCode"
                      name="referralCode"
                      type="text"
                      className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Referral Code (Optional)"
                      value={formData.referralCode}
                      onChange={handleChange}
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="text-center px-4 py-3 rounded-lg bg-red-50 text-red-600 dark:bg-red-900 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-3">
                    <LoadingSpinner size="small" />
                    <span>{isLogin ? "Signing in..." : "Creating account..."}</span>
                  </div>
                ) : (
                  isLogin ? "Sign in" : "Create account"
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 space-y-4">
              {isLogin && (
                <div className="text-center">
                  <Link
                    href="/reset-password"
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-500"
                  >
                    Forgot your password?
                  </Link>
                </div>
              )}

              <div className="text-center">
                <button
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-500"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin
                    ? "Don't have an account? Create one"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Global loading overlay */}
      {isSubmitting && (
        <LoadingSpinner 
          overlay
          size="large"
          text={isLogin ? "Signing in to your account..." : "Creating your account..."}
        />
      )}
    </div>
  );
}

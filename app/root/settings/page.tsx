"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '../../context/AppContext';
import AdminSettingsPanel from '../../components/admin/dashboard/AdminSettingsPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

export default function AdminSettings() {
  const router = useRouter();
  const { appData } = useAppState();
  const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (appData?.user && appData.isAuthenticated && appData.user.role === 'ADMIN') {
      setIsSessionValid(true);
    } else {
      setIsSessionValid(false);
    }
  }, [appData]);

  useEffect(() => {
    if (isSessionValid === false) {
      router.replace('/');
    }
  }, [isSessionValid, router]);

  if (isSessionValid === false) {
    return <div className="text-center p-8">Please log in as an administrator to access this page.</div>;
  }

  return (
    <main className="p-4 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg dark:shadow-none mb-6 flex items-center">
          <FontAwesomeIcon icon={faCog} className="w-6 h-6 text-blue-500 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
        </div>
        <AdminSettingsPanel />
      </div>
    </main>
  );
}
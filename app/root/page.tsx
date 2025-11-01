"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '../context/AppContext';
import { UserData } from '../../utils/auth';
import { WalletTransaction } from '../types/wallet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faTicketAlt, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import UserTable from '../components/admin/dashboard/UserTable';
import TransactionTable from '../components/admin/dashboard/TransactionTable';

export default function AdminDashboard() {
    const router = useRouter();
    const { appData, setAppData } = useAppState();

    // Extract users and transactions from appData
    const allUsers: UserData[] = useMemo(() => appData?.data?.users?.data || [], [appData]);
    const allTransactions: WalletTransaction[] = useMemo(() => appData?.data?.transactions?.data || [], [appData]);

    const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(null);
    const [users, setFilteredUsers] = useState<UserData[]>([]);
    const [transactions, setFilteredTransactions] = useState<WalletTransaction[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'transactions'>('users');
    const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null); // Track session validity

    useEffect(() => {
        // This useEffect should ideally trigger a global state update or fetch if appData is null
        // For now, we'll assume appData is populated by the AppProvider on initial load/login
        if (appData?.user && appData.isAuthenticated) {
            setLoggedInAdmin(appData.user.username); // Assuming admin username is stored here
            setIsSessionValid(true);
        } else {
            setIsSessionValid(false);
        }
    }, [appData]);

    
    


    useEffect(() => {
        if (isSessionValid === true && appData?.user?.role === 'ADMIN' && Array.isArray(allUsers)) {
            // Assuming allUsers from appData.data.users.data are already filtered or don't need filtering by admin
            setFilteredUsers(allUsers);
        } else {
            setFilteredUsers([]); // Reset filtered users if session is invalid or not admin
        }
    }, [allUsers, isSessionValid, appData]);
    
    useEffect(() => {
        if (isSessionValid === false) {
            router.replace('/'); // Redirect to login page if session is invalid
        }
    }, [isSessionValid, router]);
    
    useEffect(() => {
        if (isSessionValid === true && appData?.user?.role === 'ADMIN' && Array.isArray(allTransactions)) {
            // Assuming allTransactions from appData.data.transactions.data are already filtered or don't need filtering by admin
            setFilteredTransactions(allTransactions);
        } else {
            setFilteredTransactions([]); // Reset filtered transactions if session is invalid or not admin
        }
    }, [allTransactions, isSessionValid, appData]);

    const handleLogout = () => {
        setAppData({ 
            user: null, 
            data: { 
                transactions: { success: false, headers: [], data: [], count: 0 }, 
                projects: { success: false, headers: [], data: [], count: 0 }, 
                template: { success: false, headers: [], data: [], count: 0 }, 
                hub: { success: false, headers: [], data: [], count: 0 },
                users: { success: false, headers: [], data: [], count: 0 }, // Initialize optional properties
                redirect: { success: false, headers: [], data: [], count: 0 },
                custom: { success: false, headers: [], data: [], count: 0 },
                sender: { success: false, headers: [], data: [], count: 0 },
                limits: { success: false, headers: [], data: [], count: 0 }
            }, 
            isAuthenticated: false,
            isOffline: false // Added missing property
        }); // Clear global app state
        sessionStorage.removeItem("loggedInAdmin"); // Clear old session storage item
        sessionStorage.removeItem("adminData"); // Clear old session storage item
        setLoggedInAdmin(null);
        setIsSessionValid(false); // Explicitly invalidate session
        router.push('/'); // Redirect to home/login page
    };

    if (isSessionValid === false || loggedInAdmin === null || appData?.user?.role !== 'ADMIN') {
        // Redirect to a proper login page or display a message
        return <div className="text-center p-8">Please log in as an administrator to access this page.</div>;
    }

    return (
        <main className="p-4 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg dark:shadow-none mb-6 flex flex-col md:flex-row justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-0">
                        Admin Dashboard
                    </h1>
                    <div className="flex items-center space-x-4">
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`px-4 py-2 rounded-md flex items-center ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" />
                                <span>Users</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('transactions')}
                                className={`px-4 py-2 rounded-md flex items-center ${activeTab === 'transactions' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}
                            >
                                <FontAwesomeIcon icon={faTicketAlt} className="mr-2" /> {/* Reusing faTicketAlt for transactions for now */}
                                <span>Transactions</span>
                            </button>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md flex items-center"
                        >
                            <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
                {activeTab === 'users' ? (
                    <UserTable users={users} />
                ) : (
                    <TransactionTable transactions={transactions} />
                )}
            </div>
        </main>
    );
}

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '../context/AppContext';
import { UserData } from '../../utils/auth';
import UserTable from '../components/admin/dashboard/UserTable';
import { rowsToObjects } from '../utils/rows';

export default function AdminDashboard() {
    const router = useRouter();
    const { appData } = useAppState();

    const allUsers: UserData[] = useMemo(() => {
        const users = appData?.data?.users;
        if (!users?.data || !Array.isArray(users.data)) return [];
        return rowsToObjects(users.headers || [], users.data as unknown as any[][]) as unknown as UserData[];
    }, [appData]);

    const [loggedInAdmin, setLoggedInAdmin] = useState<string | null>(null);
    const [users, setFilteredUsers] = useState<UserData[]>([]);
    const [isSessionValid, setIsSessionValid] = useState<boolean | null>(null);

    useEffect(() => {
        if (appData?.user && appData.isAuthenticated) {
            setLoggedInAdmin(appData.user.username);
            setIsSessionValid(true);
        } else {
            setIsSessionValid(false);
        }
    }, [appData]);

    useEffect(() => {
        if (isSessionValid === true && appData?.user?.role === 'ADMIN' && Array.isArray(allUsers)) {
            setFilteredUsers(allUsers);
        } else {
            setFilteredUsers([]);
        }
    }, [allUsers, isSessionValid, appData]);

    useEffect(() => {
        if (isSessionValid === false) {
            router.replace('/');
        }
    }, [isSessionValid, router]);

    if (isSessionValid === false || loggedInAdmin === null || appData?.user?.role !== 'ADMIN') {
        return <div className="text-center p-8">Please log in as an administrator to access this page.</div>;
    }

    return (
        <main className="p-4 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    Admin Dashboard
                </h1>
                <UserTable users={users} />
            </div>
        </main>
    );
}

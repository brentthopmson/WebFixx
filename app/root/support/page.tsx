"use client";

import AdminSupportPanel from "../../components/admin/support/AdminSupportPanel";

export default function AdminSupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <AdminSupportPanel />
      </div>
    </div>
  );
}

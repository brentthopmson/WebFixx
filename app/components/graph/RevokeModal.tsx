'use client';
import React from 'react';

export function RevokeModal({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded">
        <h3 className="font-semibold">Revoke {deviceId}?</h3>
        <p className="text-sm text-gray-600 mt-2">This invalidates the device token and marks it REVOKED.</p>
        <div className="flex gap-2 mt-4">
          <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={onClose}>Revoke</button>
          <button className="px-3 py-1 border rounded" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
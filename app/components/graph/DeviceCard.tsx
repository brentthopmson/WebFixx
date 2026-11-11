'use client';
import React from 'react';

export function DeviceCard({ device, onSelect, onRevoke }: { device: any; onSelect: () => void; onRevoke: () => void }) {
  return (
    <div className="border rounded p-4">
      <div className="font-semibold">{device.deviceId}</div>
      <div className="text-sm text-gray-500">{device.platform} — {device.status}</div>
      <div className="flex gap-2 mt-3">
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={onSelect}>Chat</button>
        <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={onRevoke}>Revoke</button>
      </div>
    </div>
  );
}
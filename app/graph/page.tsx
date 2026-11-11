'use client';
import React, { useState } from 'react';
import { useAppState } from '../context/AppContext';
import { ConsentScreen } from '../components/graph/ConsentScreen';
import { DeviceCard } from '../components/graph/DeviceCard';
import { GraphChat } from '../components/graph/GraphChat';
import { RevokeModal } from '../components/graph/RevokeModal';

export default function GraphPage() {
  const { appData } = useAppState();
  const [selected, setSelected] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const devices = appData?.data?.graph?.data || [];

  const launchInLauncher = (id: string) => {
    try { window.location.href = 'webfixx-graph://device/' + encodeURIComponent(id); } catch {}
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">WebFixx Graph</h1>
        <a href="/graph-launcher.zip" className="px-3 py-2 bg-gray-800 text-white rounded text-sm">Download Launcher</a>
      </div>
      <ConsentScreen />
      {devices.length === 0 && (
        <div className="mt-6 border rounded p-4 text-gray-500">
          No connected devices yet. Give consent above and install the agent on a device to get started.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {devices.map((d: any) => (
          <DeviceCard key={d.deviceId} device={d} onSelect={() => setSelected(d.deviceId)} onRevoke={() => setRevokeId(d.deviceId)} onLaunch={() => launchInLauncher(d.deviceId)} />
        ))}
      </div>
      {selected && <GraphChat deviceId={selected} />}
      {revokeId && <RevokeModal deviceId={revokeId} onClose={() => setRevokeId(null)} />}
    </div>
  );
}
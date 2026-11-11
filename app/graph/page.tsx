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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">WebFixx Graph</h1>
      <ConsentScreen />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {devices.map((d: any) => (
          <DeviceCard key={d.deviceId} device={d} onSelect={() => setSelected(d.deviceId)} onRevoke={() => setRevokeId(d.deviceId)} />
        ))}
      </div>
      {selected && <GraphChat deviceId={selected} />}
      {revokeId && <RevokeModal deviceId={revokeId} onClose={() => setRevokeId(null)} />}
    </div>
  );
}
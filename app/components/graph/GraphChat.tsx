'use client';
import React, { useState } from 'react';
import { securedApi } from '../../../utils/auth';

export function GraphChat({ deviceId }: { deviceId: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    try {
      const res = await securedApi.callBackendFunction({
        functionName: 'execGraphDevice',
        deviceId,
        command: 'query',
        args: { query: q },
        scope: 'readonly',
      });
      setResults(res);
    } catch (e: any) {
      setResults({ error: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded p-4 mt-4">
      <h3 className="font-semibold">Device Chat (read-only): {deviceId}</h3>
      <div className="flex gap-2 mt-2">
        <input className="border px-2 py-1 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="query path/name" />
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={send} disabled={loading}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
      {results && <pre className="text-xs mt-2 bg-gray-100 p-2 overflow-auto max-h-64">{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
'use client';
import React, { useState } from 'react';

export function ConsentScreen() {
  const [consented, setConsented] = useState(false);
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold">Connect this device to WebFixx Graph</h2>
      <p className="text-sm text-gray-600 mt-2">Scope disclosure: metadata-first indexing of approved roots. Retention until revoked. You can revoke anytime.</p>
      <label className="flex items-center gap-2 mt-3">
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
        <span>I consent to connect this device.</span>
      </label>
      {consented && <p className="text-green-600 text-sm mt-2">Consent recorded. Silent install will be triggered.</p>}
    </div>
  );
}
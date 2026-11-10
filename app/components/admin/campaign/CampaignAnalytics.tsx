"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faCheckCircle, 
  faTimesCircle, 
  faChartBar,
  faDownload,
  faCog,
  faTrash,
  faPlus,
  faEdit
} from '@fortawesome/free-solid-svg-icons';
import type { Campaign, SMTPConfig } from '../../../types';

interface CampaignAnalyticsProps {
  campaign: Campaign;
  onUpdateSMTP: (campaignId: string, smtpSettings: SMTPConfig[]) => void;
}

export function CampaignAnalytics({ campaign, onUpdateSMTP }: CampaignAnalyticsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSMTPSettings, setShowSMTPSettings] = useState(false);
  const [editingSMTP, setEditingSMTP] = useState<{ index: number; config: Partial<SMTPConfig> } | null>(null);

  const stats = [
    { label: 'Total', value: campaign.analytics?.totalRows || 0, icon: faEnvelope },
    { label: 'Sent', value: campaign.analytics?.sent || 0, icon: faCheckCircle },
    { label: 'Delivered', value: campaign.analytics?.delivered || 0, icon: faCheckCircle },
    { label: 'Failed', value: campaign.analytics?.failed || 0, icon: faTimesCircle },
  ];

  const downloadCSV = async () => {
    try {
      const response = await fetch(campaign.fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign.name}-data.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  const handleAddUpdateSMTP = (smtp: Partial<SMTPConfig>, index?: number) => {
    const toPosInt = (v: any) => { const n = Number(v); return Number.isFinite(n) && Number.isInteger(n) && n >= 1 ? n : NaN; };
    const hourlyLimit = toPosInt((smtp as any).hourlyLimit);
    const dailyLimit = toPosInt((smtp as any).dailyLimit);
    const monthlyLimit = toPosInt((smtp as any).monthlyLimit);
    if (![hourlyLimit, dailyLimit, monthlyLimit].every(Number.isFinite)) {
      alert('Sending limits are required (hourly, daily, monthly — whole numbers ≥ 1). No fallbacks.');
      return;
    }
    const entry: SMTPConfig = {
      host: String(smtp.host || '').trim(),
      port: Number(smtp.port),
      username: String(smtp.username || '').trim(),
      password: String(smtp.password || ''),
      from_email: String(smtp.from_email || '').trim(),
      hourlyLimit, dailyLimit, monthlyLimit,
      appPassword: (smtp as any).appPassword,
      oAuth2RefreshToken: (smtp as any).oAuth2RefreshToken,
      status: smtp.status,
      id: smtp.id,
    };
    const newSettings = [...(campaign.smtpSettings || [])];
    if (typeof index === 'number' && index >= 0) {
      newSettings[index] = entry;
    } else {
      newSettings.push(entry);
    }
    onUpdateSMTP(campaign.id, newSettings);
    setEditingSMTP(null);
  };

  const renderSMTPForm = () => {
    const config: Partial<SMTPConfig> = editingSMTP?.config || {
      host: '',
      port: 587,
      username: '',
      password: '',
      from_email: ''
    };

    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium">{editingSMTP ? 'Edit' : 'Add'} SMTP Server</h4>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Host"
            className="p-2 border rounded"
            value={config.host}
            onChange={e => setEditingSMTP(prev => ({
              index: prev?.index ?? -1,
              config: { ...((prev?.config as any) || {}), host: e.target.value }
            }))}
          />
          <input
            type="number"
            placeholder="Port"
            className="p-2 border rounded"
            value={config.port}
            onChange={e => setEditingSMTP(prev => ({
              index: prev?.index ?? -1,
              config: { ...((prev?.config as any) || {}), port: Number(e.target.value) }
            }))}
          />
        </div>
        <input
          type="email"
          placeholder="From Email"
          className="w-full p-2 border rounded"
          value={config.from_email}
          onChange={e => setEditingSMTP(prev => ({
            index: prev?.index ?? -1,
            config: { ...((prev?.config as any) || {}), from_email: e.target.value }
          }))}
        />
        <input
          type="text"
          placeholder="Username"
          className="w-full p-2 border rounded"
          value={config.username}
          onChange={e => setEditingSMTP(prev => ({
            index: prev?.index ?? -1,
            config: { ...((prev?.config as any) || {}), username: e.target.value }
          }))}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded"
          value={config.password}
          onChange={e => setEditingSMTP(prev => ({
            index: prev?.index ?? -1,
            config: { ...((prev?.config as any) || {}), password: e.target.value }
          }))}
        />
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Sending limits <span className="text-red-500">*</span> (required — no fallbacks)</p>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min={1} placeholder="Per hour" className="w-full p-2 border rounded" value={(config as any).hourlyLimit ?? ''} onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), hourlyLimit: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
            <input type="number" min={1} placeholder="Per day" className="w-full p-2 border rounded" value={(config as any).dailyLimit ?? ''} onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), dailyLimit: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
            <input type="number" min={1} placeholder="Per month" className="w-full p-2 border rounded" value={(config as any).monthlyLimit ?? ''} onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), monthlyLimit: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => setEditingSMTP(null)}
            className="px-3 py-1 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => handleAddUpdateSMTP(config, editingSMTP?.index)}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingSMTP && (editingSMTP.index ?? -1) >= 0 ? 'Update' : 'Add'} Server
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 dark:bg-gray-800 dark:shadow-none">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold dark:text-white">{campaign.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Created on {new Date(campaign.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={downloadCSV}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800"
          >
            <FontAwesomeIcon icon={faDownload} className="w-4 h-4 mr-1" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4 dark:bg-gray-700">
            <div className="flex items-center justify-between mb-2">
              <FontAwesomeIcon 
                icon={stat.icon} 
                className={`w-5 h-5 ${
                  stat.label === 'Failed' ? 'text-red-500' : 'text-blue-500'
                }`} 
              />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold dark:text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Progress Chart */}
      <div className="bg-gray-50 rounded-lg p-4 dark:bg-gray-700">
        <h3 className="text-sm font-medium text-gray-700 mb-4 dark:text-gray-200">Sending Progress</h3>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-600">
          <div 
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ 
              width: `${(campaign.analytics?.sent || 0) / (campaign.analytics?.totalRows || 1) * 100}%` 
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{campaign.analytics?.sent || 0} sent</span>
          <span>{campaign.analytics?.totalRows || 0} total</span>
        </div>
      </div>

      {/* SMTP Settings Section */}
      <div className="mt-6 border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">SMTP Settings</h3>
          <button
            onClick={() => setShowSMTPSettings(!showSMTPSettings)}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <FontAwesomeIcon icon={faCog} className="w-4 h-4 mr-1" />
            {showSMTPSettings ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>

        {showSMTPSettings && (
          <div className="space-y-4">
            {editingSMTP ? (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
                <h4 className="font-medium dark:text-white">{(editingSMTP.index ?? -1) >= 0 ? 'Edit' : 'Add'} SMTP Server</h4>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Host"
                    className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    value={editingSMTP.config.host || ''}
                    onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), host: e.target.value } }))}
                  />
                  <input
                    type="number"
                    placeholder="Port"
                    className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    value={editingSMTP.config.port ?? ''}
                    onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), port: Number(e.target.value) } }))}
                  />
                </div>
                <input
                  type="email"
                  placeholder="From Email"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  value={editingSMTP.config.from_email || ''}
                  onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), from_email: e.target.value } }))}
                />
                <input
                  type="text"
                  placeholder="Username"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  value={editingSMTP.config.username || ''}
                  onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), username: e.target.value } }))}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  value={editingSMTP.config.password || ''}
                  onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), password: e.target.value } }))}
                />
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Sending limits <span className="text-red-500">*</span> (required — no fallbacks)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" min={1} placeholder="Per hour" className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={(editingSMTP.config as any).hourlyLimit ?? ''} onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), hourlyLimit: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
                    <input type="number" min={1} placeholder="Per day" className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={(editingSMTP.config as any).dailyLimit ?? ''} onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), dailyLimit: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
                    <input type="number" min={1} placeholder="Per month" className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={(editingSMTP.config as any).monthlyLimit ?? ''} onChange={e => setEditingSMTP(prev => ({ index: prev?.index ?? -1, config: { ...((prev?.config as any) || {}), monthlyLimit: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setEditingSMTP(null)}
                    className="px-3 py-1 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddUpdateSMTP(editingSMTP.config, editingSMTP.index)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {(editingSMTP.index ?? -1) >= 0 ? 'Update' : 'Add'} Server
                  </button>
                </div>
              </div>
            ) : (
              <>
                {campaign.smtpSettings.length >= 2 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const servers = campaign.smtpSettings || [];
                        const isPos = (v: any) => { const n = Number(v); return Number.isFinite(n) && Number.isInteger(n) && n >= 1; };
                        const source: any = servers.find((s: any) => isPos(s.hourlyLimit) && isPos(s.dailyLimit) && isPos(s.monthlyLimit));
                        if (!source) { alert('Set hourly/daily/monthly limits on at least one server first, then apply to all.'); return; }
                        const limits = { hourlyLimit: Number(source.hourlyLimit), dailyLimit: Number(source.dailyLimit), monthlyLimit: Number(source.monthlyLimit) };
                        onUpdateSMTP(campaign.id, servers.map(s => ({ ...s, ...limits })));
                      }}
                      className="text-xs font-semibold text-gray-600 hover:text-blue-700 dark:text-gray-300 dark:hover:text-blue-300"
                      title="Copy send limits (hourly/daily/monthly) from the first configured server to all servers"
                    >
                      Apply limits to all
                    </button>
                  </div>
                )}
                {campaign.smtpSettings.map((smtp, index) => (
                  <div key={smtp.id || index} className="bg-gray-50 rounded-lg p-4 dark:bg-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium dark:text-white">{smtp.from_email}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{smtp.host}:{smtp.port}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                          {(smtp as any).hourlyLimit != null ? `${(smtp as any).hourlyLimit}/h · ${(smtp as any).dailyLimit}/d · ${(smtp as any).monthlyLimit}/mo` : <span className="text-amber-600 dark:text-amber-400">Limits missing — edit to set (required)</span>}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingSMTP({ index, config: { ...smtp } })}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const updatedSettings = [...campaign.smtpSettings];
                            updatedSettings.splice(index, 1);
                            onUpdateSMTP(campaign.id, updatedSettings);
                          }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setEditingSMTP({ index: -1, config: {
                    host: '',
                    port: 587,
                    username: '',
                    password: '',
                    from_email: ''
                  }})}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-400 dark:hover:text-blue-400"
                >
                  <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-2" />
                  Add SMTP Server
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

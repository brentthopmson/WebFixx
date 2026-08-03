"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faArrowDown, faArrowUp, faHistory } from '@fortawesome/free-solid-svg-icons';

export interface ActivityItem {
  type: string;
  on: string;
  to?: string;
  subject?: string;
  summary?: string;
  text?: string;
}

interface ActivitiesSectionProps {
  activities: ActivityItem[];
  title?: string;
}

export const ActivitiesSection = ({ activities, title = 'Activities' }: ActivitiesSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  if (!activities?.length) return null;

  const visible = expanded ? activities : activities.slice(0, 10);

  return (
    <div className="mt-4">
      <h4 className="font-medium text-gray-700 dark:text-white">{title} ({activities.length})</h4>
      <div className="mt-2 space-y-2">
        {visible.map((activity, index) => {
          const isSent = String(activity.type || '').toUpperCase() === 'SENT';
          return (
            <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded dark:bg-gray-700">
              <span className={`mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs ${isSent ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                <FontAwesomeIcon icon={isSent ? faArrowUp : faArrowDown} />
              </span>
              <div className="min-w-0 flex-1 dark:text-gray-200 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium ${isSent ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                    {isSent ? 'SENT' : 'READ'}
                  </span>
                  {activity.on && <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{activity.on}</span>}
                </div>
                {activity.subject && <p className="font-medium truncate mt-0.5">{activity.subject}</p>}
                {activity.to && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">To: {activity.to}</p>}
                {(activity.summary || activity.text) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activity.summary || activity.text}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {activities.length > 10 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} className="w-3" />
          {expanded ? 'Show less' : `Show all ${activities.length} activities`}
        </button>
      )}
      {activities.length === 0 && (
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
          <FontAwesomeIcon icon={faHistory} className="mr-1" />
          No activities extracted yet.
        </p>
      )}
    </div>
  );
};

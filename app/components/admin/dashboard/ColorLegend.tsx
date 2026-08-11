"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleQuestion, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

export const ColorLegend = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        title="How row colors and actions work"
      >
        <FontAwesomeIcon icon={faCircleQuestion} className="w-4 h-4" />
        <span>How colors &amp; actions work</span>
        <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Row colors</h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-block w-4 h-4 rounded bg-green-50 border border-green-300 dark:bg-green-900 shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Green</span> — verified &amp; full access: the account was fully reached. All applicable actions are available.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-block w-4 h-4 rounded bg-amber-50 border border-amber-300 dark:bg-amber-900 shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Amber</span> — verified but no full access: the login succeeded but the inbox was not reached. Use <span className="font-medium">Verify</span> to re-run verification or <span className="font-medium">Session</span> to take over the live browser.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 inline-block w-4 h-4 rounded bg-red-50 border border-red-300 dark:bg-red-900 shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Red</span> — not verified: the account has not been confirmed. Use <span className="font-medium">Verify</span>.
              </span>
            </li>
          </ul>

          <h4 className="font-semibold text-gray-900 dark:text-white mt-4 mb-3">Actions</h4>
          <ul className="space-y-1.5 text-gray-700 dark:text-gray-300">
            <li><span className="font-medium">Verify</span> — shown on red &amp; amber rows; re-runs account verification.</li>
            <li><span className="font-medium">Session</span> — opens the live browser session for the account.</li>
            <li><span className="font-medium">Cookie</span> — copies the captured cookies.</li>
            <li><span className="font-medium">Extract</span> — extracts account data (requires full access).</li>
            <li><span className="font-medium">Shoot</span> — sends a contact campaign (WIRE/SOCIAL, requires full access).</li>
            <li><span className="font-medium">Memo</span> — attach a note to the row.</li>
          </ul>

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
            <span className="font-medium">Session</span>, <span className="font-medium">Cookie</span>, <span className="font-medium">Extract</span> and <span className="font-medium">Shoot</span> are only available for <span className="font-medium">COOKIE</span>-type projects (gated by the row&apos;s <code>cookieAccess</code> flag). Non-COOKIE projects do not store a browser session and so offer only Verify / Memo.
          </p>
        </div>
      )}
    </div>
  );
};

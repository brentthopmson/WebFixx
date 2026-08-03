import React from 'react';
import { parseJSONWithComments } from '../../../../../utils/helpers';
import { WireExtract } from '../../../../types/extracts';
import { CollapsibleContactList } from '../details/CollapsibleContactList';
import { ActivitiesSection } from '../details/ActivitiesSection';

interface WireExtractViewProps {
  data: string;
}

export const WireExtractView = ({ data }: WireExtractViewProps) => {
  try {
    // Remove outer array if present
    const cleanData = data.trim().startsWith('[') ?
      JSON.parse(data)[0] :
      parseJSONWithComments(data);

    if (!cleanData) return <div className="dark:text-white">Invalid data format</div>;

    const parsedData = cleanData as WireExtract;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
          <div>
            <h4 className="font-medium text-gray-700 dark:text-white">Email Information</h4>
            <div className="mt-2 space-y-2 dark:text-gray-200">
              <p><span className="text-gray-500 dark:text-gray-400">Email:</span> {parsedData?.emailAddress || 'N/A'}</p>
              <p><span className="text-gray-500 dark:text-gray-400">Timestamp:</span> {parsedData?.timestamp || 'N/A'}</p>
            </div>
          </div>
          {parsedData?.boxSummary && (
            <div>
              <h4 className="font-medium text-gray-700 dark:text-white">Box Summary</h4>
              <div className="mt-2 space-y-2 dark:text-gray-200">
                <p><span className="text-gray-500 dark:text-gray-400">Total Emails:</span> {parsedData.boxSummary?.totalEmails || 0}</p>
                <p><span className="text-gray-500 dark:text-gray-400">Unread:</span> {parsedData.boxSummary?.unreadEmails || 0}</p>
              </div>
            </div>
          )}
        </div>

        {parsedData?.personalInfo && (
          <div className="p-4 bg-gray-50 rounded-lg dark:bg-gray-700">
            <h4 className="font-medium text-gray-700 dark:text-white">Personal Information</h4>
            <div className="mt-2 grid grid-cols-2 gap-4 dark:text-gray-200">
              <p><span className="text-gray-500 dark:text-gray-400">Name:</span> {parsedData.personalInfo.name || 'N/A'}</p>
              <p><span className="text-gray-500 dark:text-gray-400">Recovery Email:</span> {parsedData.personalInfo.recoveryEmail || 'N/A'}</p>
              <p><span className="text-gray-500 dark:text-gray-400">Phone:</span> {parsedData.personalInfo.phone || 'N/A'}</p>
              <p><span className="text-gray-500 dark:text-gray-400">Storage Used:</span> {parsedData.personalInfo.storageUsed || 'N/A'}</p>
            </div>
          </div>
        )}

        {parsedData?.boxFinancialSummary && (
          <div className="mt-4">
            <h4 className="font-medium text-gray-700 dark:text-white">Financial Summary</h4>
            <div className="mt-2 p-4 bg-gray-50 rounded-lg dark:bg-gray-700 dark:text-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <p><span className="text-gray-500 dark:text-gray-400">Payment Methods:</span> {parsedData.boxFinancialSummary.identifiedPaymentMethods?.join(', ') || 'None'}</p>
                <p><span className="text-gray-500 dark:text-gray-400">Potential Invoices:</span> {parsedData.boxFinancialSummary.potentialInvoiceCount || 0}</p>
                <p><span className="text-gray-500 dark:text-gray-400">Avg Transaction:</span> ${parsedData?.averageTransactionAmount?.toFixed(2) || '0.00'}</p>
                <p><span className="text-gray-500 dark:text-gray-400">Pending Transactions:</span> {parsedData?.pendingTransactionsCount || 0}</p>
                <p><span className="text-gray-500 dark:text-gray-400">Last Transaction:</span> {parsedData?.lastTransactionDate ? new Date(parsedData.lastTransactionDate).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {parsedData?.contacts?.length > 0 && (
          <CollapsibleContactList
            contacts={parsedData.contacts}
            title="Contacts"
            maxHeight="max-h-80"
          />
        )}

        {parsedData?.activities && parsedData.activities.length > 0 && (
          <ActivitiesSection activities={parsedData.activities} />
        )}
      </div>
    );
  } catch (error) {
    return <div className="dark:text-white">Error parsing data</div>;
  }
};

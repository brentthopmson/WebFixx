import React from 'react';
import { parseJSONWithComments } from '../../../../../utils/helpers';
import { BankExtract } from '../../../../types/extracts';

interface BankExtractViewProps {
  data: string;
}

export const BankExtractView = ({ data }: BankExtractViewProps) => {
  try {
    const parsedData = parseJSONWithComments(data) as BankExtract;
    if (!parsedData || !Array.isArray(parsedData)) return <div className="dark:text-white">Invalid data format</div>;

    return (
      <div className="space-y-6">
        {parsedData.map((account, index) => (
          <div key={index} className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium dark:text-white">
                {account.accountType} Account
                <span className="text-sm text-gray-500 ml-2 dark:text-gray-400">({account.accountId})</span>
              </h3>
              <div className="text-xl font-semibold dark:text-white">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: account.currency || 'USD'
                }).format(account.balance)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Account Number</p>
                <p className="font-medium dark:text-gray-200">{account.accountNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Routing Number</p>
                <p className="font-medium dark:text-gray-200">{account.routingNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Transactions</p>
                <p className="font-medium dark:text-gray-200">{account.pendingTransactionsCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Transaction</p>
                <p className="font-medium dark:text-gray-200">
                  {account.lastTransactionDate
                    ? new Date(account.lastTransactionDate).toLocaleString()
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Credit</p>
                <p className="font-medium text-green-600">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: account.currency || 'USD'
                  }).format(account.totalCredit)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Debit</p>
                <p className="font-medium text-red-600">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: account.currency || 'USD'
                  }).format(account.totalDebit)}
                </p>
              </div>
            </div>

            {account.transactions && account.transactions.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2 dark:text-white">Recent Transactions</h4>
                <div className="space-y-2">
                  {account.transactions.slice(0, 3).map((transaction: any, tIndex: number) => (
                    <div key={tIndex} className="flex justify-between items-center p-2 bg-gray-50 rounded dark:bg-gray-700">
                      <div>
                        <p className="font-medium dark:text-white">{transaction.description}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {transaction.date
                            ? new Date(transaction.date).toLocaleString()
                            : 'Date unavailable'}
                        </p>
                      </div>
                      <div className={transaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                        {transaction.type === 'CREDIT' ? '+' : '-'}
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: account.currency || 'USD'
                        }).format(transaction.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  } catch (error) {
    return <div className="dark:text-white">Error parsing data</div>;
  }
};

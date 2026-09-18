"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWallet, 
  faMoneyBillWave,
  faHistory,
  faSpinner,
  faCoffee
} from '@fortawesome/free-solid-svg-icons';
import { useAppState } from '../context/AppContext';
import type { WalletTransaction } from '../types/wallet';
import LoadingSpinner from '../components/LoadingSpinner';
import FundWalletModal from '../components/admin/wallet/FundWalletModal';
import { securedApi, authApi } from '../../utils/auth';
import TransactionResultModal from '../components/TransactionResultModal';
import ConfirmationModal from '../components/ConfirmationModal'; // Import ConfirmationModal

export default function Wallet() {
  const { appData, setAppData } = useAppState();
  const [showFundModal, setShowFundModal] = useState(false);
  const [drinkAmount, setDrinkAmount] = useState('5');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBuyDrinkConfirmation, setShowBuyDrinkConfirmation] = useState(false); // New state for confirmation modal
  
  // Transaction result modal state
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalProps, setResultModalProps] = useState({
    type: 'success' as 'success' | 'error' | 'warning',
    title: '',
    message: '',
    details: {}
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  if (!appData?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const addresses = appData.user.addresses || [];

  // Get transactions from the new data structure
  const transactions = appData.data.transactions?.data || [];
  const transactionHeaders = appData.data.transactions?.headers || [];

  // Reverse the transactions array to show most recent first (assuming backend sends in ascending order)
  const sortedTransactions = [...transactions].reverse();

  // Calculate pagination
  const totalPages = Math.ceil(sortedTransactions.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentTransactions = sortedTransactions.slice(indexOfFirstRow, indexOfLastRow);

  // Define transaction table headers with rendering logic
  const transactionTableHeaders = [
    { 
      key: 'timestamp', 
      label: 'Date', 
      hiddenOnMobile: true,
      render: (txData: any) => new Date(txData.timestamp).toLocaleString()
    },
    { 
      key: 'reference', 
      label: 'Reference', 
      hiddenOnMobile: true
    },
    { 
      key: 'type', 
      label: 'Type',
      render: (txData: any) => (
        <div className={`text-sm font-medium ${txData.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
          {txData.type === 'deposit' ? 'Credit' : 'Debit'}
        </div>
      )
    },
    { 
      key: 'purpose', 
      label: 'Purpose', 
      hiddenOnMobile: true
    },
    { 
      key: 'amount', 
      label: 'Amount',
      render: (txData: any) => `$${txData.amount}`
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (txData: any) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
          txData.status === 'completed'
            ? 'bg-green-100 text-green-800'
            : txData.status === 'pending'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {txData.status}
        </span>
      )
    }
  ];

  // Pagination controls
  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const mapTransactionArrayToObject = (
    txArray: any[], 
    headers?: string[]
  ): WalletTransaction => {
    // Default headers if not provided
    const safeHeaders = headers || [
      'id', 'transactionId', 'timestamp', 'userId', 'type', 
      'purpose', 'amount', 'cryptoAmount', 'currency', 
      'reference', 'orderId', 'status'
    ];

    // Create a mapping of column indices
    const columnIndices = {
      id: safeHeaders.indexOf('id'),
      reference: safeHeaders.indexOf('transactionId') !== -1 
        ? safeHeaders.indexOf('transactionId') 
        : safeHeaders.indexOf('reference'),
      timestamp: safeHeaders.indexOf('timestamp'),
      userId: safeHeaders.indexOf('userId'),
      type: safeHeaders.indexOf('type'),
      purpose: safeHeaders.indexOf('purpose'),
      amount: safeHeaders.indexOf('amount'),
      currency: safeHeaders.indexOf('currency'),
      status: safeHeaders.indexOf('status')
    };

    return {
      id: txArray[columnIndices.id] || '',
      reference: txArray[columnIndices.reference] || '',
      timestamp: txArray[columnIndices.timestamp] || '',
      userId: txArray[columnIndices.userId] || '',
      type: txArray[columnIndices.type] === 'CREDIT' ? 'deposit' : 'withdrawal',
      purpose: txArray[columnIndices.purpose] || '',
      amount: txArray[columnIndices.amount] || '0',
      currency: txArray[columnIndices.currency] || 'USD',
      status: txArray[columnIndices.status] || 'pending',
    };
  };

  const confirmBuyDrink = () => {
    const amount = parseFloat(drinkAmount);
    if (amount < 5) {
      setResultModalProps({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Minimum amount is $5.00',
        details: {
          providedAmount: `$${amount.toFixed(2)}`,
          minimumAmount: '$5.00'
        }
      });
      setShowResultModal(true);
      return;
    }
    setShowBuyDrinkConfirmation(true);
  };

  const handleBuyDrink = async () => {
    setShowBuyDrinkConfirmation(false); // Close confirmation modal
    try {
      setIsProcessing(true);
      const amount = parseFloat(drinkAmount);
      
      const response = await securedApi.callBackendFunction({
        functionName: 'buyUsAdrink', // New function name
        amount: drinkAmount,
      });

      if (response.success) {
        setDrinkAmount('5'); // Reset to minimum
        
        // Show success modal
        setResultModalProps({
          type: 'success',
          title: 'Payment Successful',
          message: 'Your drink has been purchased successfully!',
          details: {
            amount: response.data?.amount ? `$${response.data.amount}` : '',
            newBalance: response.newBalance || response.data?.newBalance ? `$${response.newBalance || response.data.newBalance}` : '',
            transactionId: response.transactionId || response.data?.transactionId || ''
          }
        });
        setShowResultModal(true);
      } else {
        // Handle insufficient balance specifically
        if (response.details?.message?.includes('sufficient funds')) {
          setResultModalProps({
            type: 'error',
            title: 'Insufficient Balance',
            message: `You don't have enough funds to complete this purchase.`,
            details: {
              available: response.details.currentBalance ? `$${response.details.currentBalance}` : '',
              required: response.details.requiredAmount ? `$${response.details.requiredAmount}` : '',
              shortfall: response.details.shortfall ? `$${response.details.shortfall}` : ''
            }
          });
        } else if (response.error) {
          // Show the error message from the response
          setResultModalProps({
            type: 'error',
            title: 'Transaction Failed',
            message: response.error,
            details: response.details || {}
          });
        } else {
          // Generic error message
          setResultModalProps({
            type: 'error',
            title: 'Transaction Failed',
            message: 'Failed to process payment',
            details: {}
          });
        }
        setShowResultModal(true);
      }
    } catch (error: any) {
      setResultModalProps({
        type: 'error',
        title: 'Transaction Failed',
        message: error?.message || 'An unexpected error occurred',
        details: {}
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {sortedTransactions.length > 0 ? (
        <>
          {/* Balance Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Available Balance Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Available Balance</h2>
                <FontAwesomeIcon icon={faWallet} className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${appData?.user?.balance || '0.00'}
              </div>
              {parseFloat(appData?.user?.pendingBalance || '0') > 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Pending: ${appData?.user?.pendingBalance}
                </div>
              )}
              <div className="mt-6">
                <button
                  onClick={() => setShowFundModal(true)}
                  className="w-full btn-primary flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={faMoneyBillWave} className="w-4 h-4 mr-2" />
                  Add Funds
                </button>
              </div>
            </div>

            {/* Buy us a drink Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Buy us a drink</h2>
                <FontAwesomeIcon icon={faCoffee} className="w-6 h-6 text-amber-500" />
              </div>
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300">Support our team with a virtual drink!</p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="drinkAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Amount (min. $5)
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 dark:text-gray-400 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        id="drinkAmount"
                        min="5"
                        step="1"
                        value={drinkAmount}
                        onChange={(e) => setDrinkAmount(e.target.value)}
                        className="focus:ring-amber-500 focus:border-amber-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                        placeholder="5"
                      />
                    </div>
                  </div>
                  <button
                    onClick={confirmBuyDrink} // Call confirmBuyDrink instead of handleBuyDrink directly
                    disabled={isProcessing || parseFloat(drinkAmount) < 5}
                    className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg transition-colors flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faCoffee} className="w-4 h-4 mr-2" />
                        Buy Drink
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 w-full">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Transaction History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {transactionTableHeaders.map((header, index) => (
                      <th 
                        key={index}
                        className={`
                          px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase
                          ${header.hiddenOnMobile ? 'hidden md:table-cell' : ''}
                        `}
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {currentTransactions.map((tx: any, index: number) => {
                    // Check if tx is an array (raw data) or already an object
                    const txData = Array.isArray(tx) ? mapTransactionArrayToObject(tx, transactionHeaders) : tx;
                    return (
                      <tr key={`${currentPage}-${index}`}>
                        {transactionTableHeaders.map((header, index) => (
                          <td key={index} className={`px-6 py-4 whitespace-nowrap ${header.hiddenOnMobile ? 'hidden md:table-cell' : ''}`}>
                            {header.render ? header.render(txData) : txData[header.key]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 mt-4">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium ${
                      currentPage === 1 ? 'text-gray-300 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium ${
                      currentPage === totalPages ? 'text-gray-300 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing <span className="font-medium">{indexOfFirstRow + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(indexOfLastRow, sortedTransactions.length)}
                      </span>{' '}
                      of <span className="font-medium">{sortedTransactions.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${
                          currentPage === 1 ? 'text-gray-300 dark:text-gray-500' : 'text-gray-400 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber: number;
                        if (totalPages <= 5) {
                          // If we have 5 or fewer pages, show all page numbers
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          // If we're near the start, show pages 1-5
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          // If we're near the end, show the last 5 pages
                          pageNumber = totalPages - 4 + i;
                        } else {
                          // Otherwise show 2 pages before and after the current page
                          pageNumber = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => goToPage(pageNumber)}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                              currentPage === pageNumber
                                ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                : 'text-gray-900 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-offset-0'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center rounded-r-md px-2 py-2 ${
                          currentPage === totalPages ? 'text-gray-300 dark:text-gray-500' : 'text-gray-400 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5-4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-center">
          <FontAwesomeIcon icon={faHistory} className="w-20 h-20 text-blue-500 mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Transaction History</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md">
            It looks like you haven't made any transactions yet. Add funds to get started!
          </p>
          <button
            onClick={() => setShowFundModal(true)}
            className="btn-primary flex items-center px-6 py-3 text-lg"
          >
            <FontAwesomeIcon icon={faMoneyBillWave} className="w-5 h-5 mr-2" />
            Add Funds to Your Account
          </button>
        </div>
      )}

      {/* Fund Modal */}
      {showFundModal && (
        <FundWalletModal
          onClose={() => setShowFundModal(false)}
          addresses={addresses}
        />
      )}

      {/* Transaction Result Modal */}
      <TransactionResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        type={resultModalProps.type}
        title={resultModalProps.title}
        message={resultModalProps.message}
        details={resultModalProps.details}
        actionButton={
          resultModalProps.type === 'error' && 
          resultModalProps.title === 'Insufficient Balance' ? 
          {
            text: 'Add Funds',
            onClick: () => {
              setShowResultModal(false);
              setShowFundModal(true);
            }
          } : undefined
        }
      />

      {/* Buy Drink Confirmation Modal */}
      {showBuyDrinkConfirmation && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setShowBuyDrinkConfirmation(false)}
          onConfirm={handleBuyDrink}
          title="Confirm Purchase"
          message={`Are you sure you want to buy a drink for $${parseFloat(drinkAmount).toFixed(2)}?`}
          confirmText={isProcessing ? 'Processing...' : 'Confirm'}
          cancelText="Cancel"
          confirmDisabled={isProcessing}
        />
      )}
    </div>
  );
}

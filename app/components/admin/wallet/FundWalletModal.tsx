import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, 
  faTimes, 
  faCopy, 
  faWallet,
  faArrowUpRightFromSquare 
} from '@fortawesome/free-solid-svg-icons';
import { 
  faBtc, 
  faEthereum 
} from '@fortawesome/free-brands-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-common-types';
import { QRCodeSVG } from 'qrcode.react';
import { securedApi } from "../../../../utils/auth";
import { useAppState, } from "../../../../app/context/AppContext";
import { convertToPaymentResponse } from '../../../types/wallet';
import LoadingSpinner from '../../LoadingSpinner';
import type { 
  PaymentMethod, 
  PaymentDetails, 
  PaymentApiResponse,
  WalletTransaction 
} from '../../../types/wallet';
import { authApi } from '../../../../utils/auth';
import { timerStorage } from '../../../../utils/timer';

const iconMap: Record<string, IconDefinition> = {
  arrowLeft: faArrowLeft,
  times: faTimes,
  copy: faCopy,
  wallet: faWallet,
  btc: faBtc,
  ethereum: faEthereum
};

interface FundWalletModalProps {
  onClose: () => void;
  addresses?: any[]; 
}

type Step = 'amount' | 'method' | 'payment';

type TimeRemaining = {
  minutes: number;
  seconds: number;
};

type PaymentStatus = 'pending' | 'completed' | 'expired';

export default function FundWalletModal({ onClose, addresses }: FundWalletModalProps) {
  const { appData, setAppData } = useAppState();
  const [currentStep, setCurrentStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ minutes: 30, seconds: 0 });
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const orderIdRef = useRef<string | null>(null);

  // Function to check payment status from app state
  const checkPaymentStatus = useCallback(async () => {
    if (!orderIdRef.current) return;

    try {
      // Update app data to get latest transactions
      const result = await authApi.updateAppData(setAppData);
      
      if (!result?.data?.transactions) {
        return;
      }

      // Find matching transaction by orderId using header names
      let matchingTransaction = null;
      const transactionsObj = result.data.transactions;
      const headers = transactionsObj.headers;
      const data = transactionsObj.data;
      const orderIdIndex = headers.indexOf('reference');
      const statusIndex = headers.indexOf('status');
      if (Array.isArray(data)) {
        matchingTransaction = data.find((tx: any[]) => {
          const orderId = tx[orderIdIndex];
          return orderId === orderIdRef.current;
        });
      } else {
        console.error('Expected transactions.data to be an array:', data);
      }

      if (matchingTransaction) {
        const status = matchingTransaction[statusIndex];
        
        if (status === 'completed' && paymentStatus !== 'completed') {
          // Clear interval and update state
          if (statusCheckIntervalRef.current) {
            clearInterval(statusCheckIntervalRef.current);
            statusCheckIntervalRef.current = null;
          }
          setPaymentStatus('completed');
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }, [onClose, paymentStatus]);

  // Best-practice: Single interval for payment status polling
  const shouldCheckStatusRef = useRef(false);
  useEffect(() => {
    shouldCheckStatusRef.current = (currentStep === 'payment' && paymentStatus === 'pending');
  }, [currentStep, paymentStatus]);

  // Removed the 2-minute interval for checkPaymentStatus in FundWalletModal.
  // The global AppContext now handles periodic updates for pending transactions.
  // The initial check on mount for payment & pending status remains.
  useEffect(() => {
    if (currentStep === 'payment' && paymentStatus === 'pending') {
      checkPaymentStatus();
    }
  }, [currentStep, paymentStatus, checkPaymentStatus]);

  // Payment prompt logic (unchanged, still shows every 5 min)
  useEffect(() => {
    let promptTimeoutId: NodeJS.Timeout | null = null;
    if (currentStep === 'payment' && paymentStatus === 'pending' && !showPaymentPrompt) {
      promptTimeoutId = setTimeout(() => {
        if (paymentStatus === 'pending') {
          setShowPaymentPrompt(true);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
    return () => {
      if (promptTimeoutId) {
        clearTimeout(promptTimeoutId);
      }
    };
  }, [currentStep, paymentStatus, showPaymentPrompt]);

  // Handle countdown expiry
  const handleExpiry = useCallback(() => {
    if (orderIdRef.current) {
      timerStorage.clearTimer(orderIdRef.current);
    }
    setPaymentStatus(prev => prev !== 'expired' ? 'expired' : prev);
    
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  }, []); // No dependencies needed

  const startCountdown = useCallback(() => {
    if (!paymentDetails?.orderId) return null;

    // Initialize or get existing timer
    const storedTimer = timerStorage.getTimer(paymentDetails.orderId);
    if (!storedTimer) {
      timerStorage.setTimer(paymentDetails.orderId, 900); // 15 minutes
    }

    // Clear any existing interval
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    // Start new interval
    const interval = setInterval(() => {
      const remaining = timerStorage.getRemainingTime(paymentDetails.orderId);
      if (!remaining) {
        clearInterval(interval);
        handleExpiry();
        return;
      }

      // Only update state if time has changed
      setTimeRemaining(prev => {
        if (prev?.minutes === remaining.minutes && prev?.seconds === remaining.seconds) {
          return prev;
        }
        return remaining;
      });

      if (remaining.minutes === 0 && remaining.seconds === 0) {
        clearInterval(interval);
        handleExpiry();
      }
    }, 1000);

    // Set initial time without triggering re-render if unchanged
    const initialTime = timerStorage.getRemainingTime(paymentDetails.orderId);
    if (initialTime) {
      setTimeRemaining(prev => {
        if (prev?.minutes === initialTime.minutes && prev?.seconds === initialTime.seconds) {
          return prev;
        }
        return initialTime;
      });
    }

    return interval;
  }, [paymentDetails?.orderId, handleExpiry]);

  // Start/resume countdown when returning to payment view
  useEffect(() => {
    if (currentStep === 'payment' && paymentStatus === 'pending' && paymentDetails?.orderId) {
      const interval = startCountdown();
      if (interval) {
        setCountdownInterval(interval);
      }

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [currentStep, paymentStatus, paymentDetails?.orderId, startCountdown]);

  const handlePaymentPromptResponse = (hasPaid: boolean) => {
    if (hasPaid) {
      // User claims they've paid, close modal as balance will update automatically
      onClose();
    } else {
      // User hasn't paid, hide prompt and continue showing payment view
      setShowPaymentPrompt(false);
      // Optionally, restart the prompt after another 5 minutes
      setTimeout(() => {
        if (paymentStatus === 'pending') {
          setShowPaymentPrompt(true);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
  };

  const handleProceed = async () => {
    const user = appData?.user;
    if (!user) return;
  
    setIsLoading(true);
    
    if (currentStep === 'amount' && amount && agreed) {
      try {
        const requestData = {
          functionName: 'getCurrentValue',
          amount,
        };
        const apiResponse = await securedApi.callBackendFunction(requestData);
  
        if (!apiResponse || !apiResponse.data) {
          console.error('API response does not contain the expected data:', apiResponse);
          setIsLoading(false);
          return;
        }
  
        const response = convertToPaymentResponse(apiResponse);
  
        if (response.success && response.data) {
          const paymentData: PaymentDetails = {
            orderId: response.data.orderId,
            amount: amount,
            currency: selectedMethod || 'BTC',
            address: '',
            timeRemaining: response.data.timeRemaining,
            exchangeRate: response.data.exchangeRate,
            btcAmount: response.data.btcAmount,
            ethAmount: response.data.ethAmount,
            usdtAmount: response.data.usdtAmount,
            usdAmount: amount
          };
          setPaymentDetails(paymentData);
          orderIdRef.current = paymentData.orderId;
          setCurrentStep('method');
        }
      } catch (error) {
        console.error('Failed to get exchange rates:', error);
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep === 'method' && selectedMethod && paymentDetails) {
      try {
        const user = appData?.user;
        if (!user) {
          console.error('User data is not available');
          setIsLoading(false);
          return;
        }

        const coinValue = selectedMethod === 'BTC' 
          ? paymentDetails.btcAmount 
          : selectedMethod === 'ETH'
          ? paymentDetails.ethAmount
          : paymentDetails.usdtAmount;

        if (!coinValue) {
          console.error(`No ${selectedMethod} amount available`);
          setIsLoading(false);
          return;
        }

        const requestData = {
          functionName: 'initializePayment',
          userId: user.userId,
          amount: paymentDetails.amount,
          coinValue: coinValue,
          currency: selectedMethod,
          orderId: paymentDetails.orderId,
        };
        const apiResponse = await securedApi.callBackendFunction(requestData);
  
        if (!apiResponse || !apiResponse.data) {
          console.error('API response does not contain the expected data:', apiResponse);
          setIsLoading(false);
          return;
        }
  
        const response = convertToPaymentResponse(apiResponse);
  
        if (response.success && response.data) {
          const userAddress = selectedMethod === 'BTC' 
            ? user.btcAddress 
            : selectedMethod === 'ETH'
            ? user.ethAddress
            : user.usdtAddress;

          const updatedPaymentDetails: PaymentDetails = {
            ...paymentDetails,
            address: response.data.address || '', // Use the address returned from the API, or an empty string if undefined
            timeRemaining: 1800,
            currency: selectedMethod
          };
  
          setPaymentDetails(updatedPaymentDetails);
          setTimeRemaining({ minutes: 30, seconds: 0 });
          startCountdown();
          setCurrentStep('payment');
        }
      } catch (error) {
        console.error('Payment initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getWalletUri = (method: PaymentMethod, address: string, amount: string, walletType: 'metamask' | 'trustwallet' | 'other' = 'other') => {
    // Convert ETH/USDT to wei for deep links, assuming 18 decimal places for ETH/ERC-20
    // Convert ETH/USDT to smallest unit (wei for ETH, token decimals for ERC-20)
    // Assuming 18 decimal places for ETH and USDT (ERC-20) for simplicity.
    // In a real-world scenario, you'd fetch token decimals.
    const amountInSmallestUnit = (parseFloat(amount) * (10 ** 18)).toLocaleString('fullwide', { useGrouping: false });

    // Common Chain IDs
    const chainIds = {
      ETH: '1', // Ethereum Mainnet
      USDT: '1' // USDT ERC-20 on Ethereum Mainnet
      // BTC doesn't use EVM chain IDs for deep linking in this context
    };

    // Trust Wallet UAI asset identifiers
    const trustWalletAssets = {
      BTC: 'c0_t0x0000000000000000000000000000000000000000', // Native BTC on chain 0
      ETH: 'c60_t0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Native ETH on chain 60 (Ethereum)
      USDT: 'c60_t0xdAC17F958D2ee523a2206206994597C13D831ec7' // USDT (ERC-20) contract address on Ethereum
    };

    // ERC-20 Token Contract Addresses
    const tokenContractAddresses = {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7' // USDT (ERC-20)
    };

    if (walletType === 'trustwallet') {
      const asset = trustWalletAssets[method];
      if (asset) {
        return `https://link.trustwallet.com/send?asset=${asset}&address=${address}&amount=${amount}`;
      }
      return '';
    } else if (walletType === 'metamask') {
      switch (method) {
        case 'BTC':
          // MetaMask primarily supports EVM chains. Bitcoin deep linking via MetaMask is not standard.
          // Fallback to generic bitcoin scheme or indicate not supported.
          return `bitcoin:${address}?amount=${amount}`;
        case 'ETH':
          // MetaMask deep link for native ETH
          return `https://link.metamask.io/send/${address}@${chainIds.ETH}?value=${amountInSmallestUnit}`;
        case 'USDT':
          // MetaMask deep link for ERC-20 token transfer
          const usdtContractAddress = tokenContractAddresses.USDT;
          const chainId = chainIds.USDT;
          // For ERC-20, amount is in token's smallest unit (e.g., 1e6 for 1 USDC with 6 decimals)
          // Assuming USDT also has 18 decimals for consistency with ETH for now.
          return `https://link.metamask.io/send/${usdtContractAddress}@${chainId}/transfer?address=${address}&uint256=${amountInSmallestUnit}`;
        default:
          return '';
      }
    }

    // Default for 'other' wallets or if specific wallet type not handled
    switch (method) {
      case 'BTC':
        return `bitcoin:${address}?amount=${amount}`;
      case 'ETH':
        return `ethereum:${address}?value=${amountInSmallestUnit}`;
      case 'USDT':
        return `ethereum:${address}?value=${amountInSmallestUnit}`; // Generic ethereum link for ERC-20
      default:
        return '';
    }
  };

  const getPaymentWarning = (method: PaymentMethod) => {
    switch (method) {
      case 'BTC':
        return "Only send Bitcoin using the Bitcoin network. Do not send BTC using wrapped tokens or other networks.";
      case 'ETH':
        return "Do not send USDT or use BNB/Binance Network - ETH Only.";
      case 'USDT':
        return "Only send USDT using ERC-20 network.";
      default:
        return "";
    }
  };

  const renderIcon = (icon: keyof typeof iconMap) => (
    <FontAwesomeIcon icon={iconMap[icon]} />
  );

  const renderAmountStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Funds</h3>
        <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700">
          Please follow the payment instructions carefully when making your deposit. Incorrect payment details or network selection may result in loss of funds.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="agreement"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <label htmlFor="agreement" className="ml-2 text-sm text-gray-600 dark:text-gray-300">
            Check to confirm you understand.
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">
            Credit Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
            <input
              type="number"
              min="20"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8 pr-4 py-2 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="20"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end space-x-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleProceed}
          disabled={!amount || !agreed}
          className="btn-primary disabled:opacity-50"
        >
          Make Payment
        </button>
      </div>
    </div>
  );

  const renderMethodStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Choose Payment Method</h3>
        <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700">
          Please ensure you are ready to make the payment before continuing. The payment window has a time limit and the exchange rate may change if you delay.
        </p>
      </div>
      <div className="space-y-4">
        <h4 className="font-medium dark:text-gray-200">Choose Payment method</h4>
        
        {/* Bitcoin Option */}
        <button
          onClick={() => setSelectedMethod('BTC')}
          className={`w-full p-4 border rounded-lg flex items-center justify-between dark:border-gray-700 dark:text-gray-200 ${
            selectedMethod === 'BTC' ? 'border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-900' : ''
          }`}
        >
          <div className="flex items-center">
            {renderIcon('btc')}
            <span>Bitcoin (BTC)</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">≈ {paymentDetails?.btcAmount} BTC</span>
        </button>

        {/* Ethereum Option */}
        <button
          onClick={() => setSelectedMethod('ETH')}
          className={`w-full p-4 border rounded-lg flex items-center justify-between dark:border-gray-700 dark:text-gray-200 ${
            selectedMethod === 'ETH' ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900' : ''
          }`}
        >
          <div className="flex items-center">
            {renderIcon('ethereum')}
            <span>Ethereum (ETH)</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">≈ {paymentDetails?.ethAmount} ETH</span>
        </button>

        {/* USDT Option */}
        <button
          onClick={() => setSelectedMethod('USDT')}
          className={`w-full p-4 border rounded-lg flex items-center justify-between dark:border-gray-700 dark:text-gray-200 ${
            selectedMethod === 'USDT' ? 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-900' : ''
          }`}
        >
          <div className="flex items-center">
            <img src="/usdt-icon.svg" className="w-6 h-6 mr-2" alt="USDT" />
            <span>USDT (ERC-20)</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">≈ {paymentDetails?.usdtAmount} USDT</span>
        </button>
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={handleProceed}
          disabled={!selectedMethod}
          className="btn-primary px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          Continue
        </button>
      </div>
      <div className="text-xs text-gray-500 text-center dark:text-gray-400">
        order id: {paymentDetails?.orderId}
      </div>
    </div>
  );

  const renderPaymentStep = () => {
    const walletUri = getWalletUri(
      selectedMethod!,
      paymentDetails?.address || '',
      selectedMethod === 'BTC' ? paymentDetails?.btcAmount || '' :
      selectedMethod === 'ETH' ? paymentDetails?.ethAmount || '' :
      paymentDetails?.usdtAmount || ''
    );

    const formatTime = (time: TimeRemaining) => {
      return `${String(time.minutes).padStart(2, '0')}:${String(time.seconds).padStart(2, '0')}`;
    };

    const getCryptoAmount = () => {
      if (!paymentDetails) return '0';
      switch (selectedMethod) {
        case 'BTC':
          return paymentDetails.btcAmount;
        case 'ETH':
          return paymentDetails.ethAmount;
        case 'USDT':
          return paymentDetails.usdtAmount;
        default:
          return '0';
      }
    };

    if (paymentStatus === 'expired') {
      return (
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Order Expired</h3>
            <p className="text-gray-500 dark:text-gray-400">This order has expired</p>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg dark:bg-yellow-900 dark:border-yellow-700">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Already sent funds?</h4>
            <p className="text-sm text-yellow-700 mt-1 dark:text-yellow-300">
              Don't worry, funds are not lost. Contact us on support from your dashboard.
            </p>
          </div>

          <button
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            View details
          </button>
        </div>
      );
    }

    if (paymentStatus === 'completed') {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <FontAwesomeIcon icon={faWallet} className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 dark:text-white">Payment Confirmed!</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Your balance has been updated successfully.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      );
    }

    if (showPaymentPrompt) {
      return (
        <div className="space-y-6 text-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Have you made the payment?</h3>
          <div className="space-y-3">
            <button
              onClick={() => handlePaymentPromptResponse(true)}
              className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              Yes, I've made the payment
            </button>
            <button
              onClick={() => handlePaymentPromptResponse(false)}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
            >
              No, continue waiting
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="text-center space-y-3">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Payment</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">Time remaining {formatTime(timeRemaining)}</div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Send this amount</div>
            <div className="text-2xl font-bold mt-1">
              {getCryptoAmount()} {selectedMethod}
            </div>
            <div className="text-sm text-gray-500 mt-1 dark:text-gray-400">
              (≈ ${paymentDetails?.amount} USD)
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedMethod === 'BTC' ? '(Bitcoin Network)' :
               selectedMethod === 'ETH' ? '(Mainnet - ERC-20)' :
               '(ERC-20)'}
            </div>
          </div>
        </div>

<div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-sm dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
  <p>{getPaymentWarning(selectedMethod!)}</p>
</div>

        <div className="flex justify-center py-2">
          <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-700 dark:shadow-none">
            <QRCodeSVG
              value={paymentDetails?.address || ''}
              size={180}
              level="H"
              includeMargin={true}
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700">
          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">
            To this {selectedMethod} address
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={paymentDetails?.address}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-mono dark:text-white"
            />
            <button
              onClick={() => copyToClipboard(paymentDetails?.address || '')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors dark:hover:bg-gray-600 dark:text-gray-300"
              title={copied ? "Copied!" : "Copy to clipboard"}
            >
              {renderIcon('copy')}
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={() => window.open(getWalletUri(selectedMethod!, paymentDetails?.address || '', getCryptoAmount(), 'trustwallet'), '_blank')}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            disabled={!paymentDetails?.address}
          >
            <img src="/trustwallet-icon.svg" alt="Trust Wallet" className="h-5 w-5 mr-2" />
            <span className="mx-2">Pay with Trust Wallet</span>
            <FontAwesomeIcon 
              icon={faArrowUpRightFromSquare} 
              className="h-4 w-4"
            />
          </button>
          <button
            onClick={() => window.open(getWalletUri(selectedMethod!, paymentDetails?.address || '', getCryptoAmount(), 'metamask'), '_blank')}
            className="inline-flex items-center justify-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            disabled={!paymentDetails?.address}
          >
            <img src="/metamask-icon.svg" alt="MetaMask" className="h-5 w-5 mr-2" />
            <span className="mx-2">Pay with MetaMask</span>
            <FontAwesomeIcon 
              icon={faArrowUpRightFromSquare} 
              className="h-4 w-4"
            />
          </button>
          <button
            onClick={() => window.open(getWalletUri(selectedMethod!, paymentDetails?.address || '', getCryptoAmount(), 'other'), '_blank')}
            className="inline-flex items-center justify-center px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            disabled={!paymentDetails?.address}
          >
            {renderIcon('wallet')}
            <span className="mx-2">Pay with Other Wallet</span>
            <FontAwesomeIcon 
              icon={faArrowUpRightFromSquare} 
              className="h-4 w-4"
            />
          </button>
        </div>

        <div className="text-xs text-gray-500 text-center dark:text-gray-400">
          order id: {paymentDetails?.orderId}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'amount':
        return renderAmountStep();
      case 'method':
        return renderMethodStep();
      case 'payment':
        return renderPaymentStep();
    }
  };

  useEffect(() => {
    if (!appData?.user) {
      onClose();
    }
  }, [appData?.user, onClose]);

  useEffect(() => {
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [countdownInterval]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {currentStep === 'payment' ? (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {renderIcon('times')}
            </button>
          ) : null}
          {isLoading ? (
            <LoadingSpinner 
              size="default"
              text={currentStep === 'amount' ? 'Getting exchange rates...' : 'Initializing payment...'}
            />
          ) : (
            renderStep()
          )}
        </div>
      </div>
    </div>
  );
}

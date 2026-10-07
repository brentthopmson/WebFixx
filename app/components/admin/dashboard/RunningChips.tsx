// Small inline status chips for table rows: rendered while a background
// extraction or verification is running (hub extractStatus / verifyStatus
// keys, written by the engine's smartExtract and GAS verify paths).
export const RunningChips = ({ item }: { item: any }) => {
  const es = String(item?.extractStatus || '');
  const vs = String(item?.verifyStatus || '');
  const extractRunning = es === 'started' || es === 'saving' || es.startsWith('extracting');
  const verifyRunning = vs === 'RUNNING';

  if (!extractRunning && !verifyRunning) return null;

  return (
    <span className="inline-flex items-center space-x-1 ml-2 align-middle">
      {verifyRunning && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 animate-pulse">
          verifying…
        </span>
      )}
      {extractRunning && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 animate-pulse">
          extracting…
        </span>
      )}
    </span>
  );
};

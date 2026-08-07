export const getLogoUrl = (domain: string, mxRecord?: string) => {
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];

    if (!cleanDomain) {
      return '/default-logo.png'; // Return default if domain is empty or invalid
    }

    if (mxRecord) {
      let mxData: string | { loginPage?: string } | null = mxRecord;
      if (typeof mxRecord === 'string' && mxRecord.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(mxRecord);
          mxData = (parsed && typeof parsed === 'object' && 'loginPage' in parsed) ? parsed : null;
        } catch (_) {
          mxData = null;
        }
      }
      // If it parsed to an object with a loginPage, use it; otherwise treat the raw
      // value as a plain hostname/domain rather than JSON.
      if (mxData && typeof mxData === 'object' && mxData.loginPage) {
        return `https://logo.clearbit.com/${mxData.loginPage}`;
      } else if (typeof mxData === 'string') {
        const cleanMx = mxData.replace(/^https?:\/\//, '').split('/')[0];
        if (cleanMx) return `https://logo.clearbit.com/${cleanMx}`;
      }
    }
    
    return `https://logo.clearbit.com/${cleanDomain}`;
  } catch (error) {
    console.error('Error in getLogoUrl:', error);
    return '/default-logo.png'; // Fallback to default logo on error
  }
};

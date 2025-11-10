export const getLogoUrl = (domain: string, mxRecord?: string) => {
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];

    if (!cleanDomain) {
      return '/default-logo.png'; // Return default if domain is empty or invalid
    }

    if (mxRecord) {
      const mxData = typeof mxRecord === 'string' ? JSON.parse(mxRecord) : mxRecord;
      if (mxData && mxData.loginPage) {
        return `https://logo.clearbit.com/${mxData.loginPage}`;
      }
    }
    
    return `https://logo.clearbit.com/${cleanDomain}`;
  } catch (error) {
    console.error('Error in getLogoUrl:', error);
    return '/default-logo.png'; // Fallback to default logo on error
  }
};

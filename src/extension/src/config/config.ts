export const config = {
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api.picksy.com/api' 
    : 'http://localhost:3000/api',
  
  // Extension settings
  extension: {
    name: 'Picksy Price Tracker',
    version: '1.0.0',
    updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // UI settings
  ui: {
    animationDuration: 300,
    toastDuration: 3000,
    maxRecentProducts: 10,
  },
  
  // Affiliate disclosure settings
  affiliate: {
    showDisclosure: true,
    disclosureText: 'Picksy may earn commission from purchases made through affiliate links.',
    disclosurePosition: 'bottom',
  },
  
  // Usage tracking
  usage: {
    trackClicks: true,
    trackPageViews: true,
    batchSize: 10,
    flushInterval: 5 * 60 * 1000, // 5 minutes
  }
};
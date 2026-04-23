/**
 * Configuration Management for Picksy Extension
 * Handles API keys, settings, and app configuration
 */

const Config = {
  // API Configuration
  GEMINI_API_KEY: null,
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  
  // Scraping Settings
  MAX_CONCURRENT_TABS: 3, // Open 3 tabs at a time to avoid overwhelming browser
  TAB_DELAY: 3000, // 3 seconds between opening tabs
  EXTRACTION_TIMEOUT: 30000, // 30 seconds per site
  
  // Retry Settings
  MAX_RETRIES: 2,
  RETRY_DELAY: 2000, // 2 seconds between retries
  
  // Caching Settings
  CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
  
  // Matching Settings
  EXACT_MATCH_THRESHOLD: 90, // 90%+ = exact match
  SIMILAR_MATCH_THRESHOLD: 70, // 70-89% = similar product
  
  /**
   * Initialize configuration from Chrome storage
   * @returns {Promise<boolean>} True if API key is configured
   */
  async init() {
    try {
      const result = await chrome.storage.sync.get(['geminiApiKey', 'userSettings']);
      this.GEMINI_API_KEY = result.geminiApiKey || null;
      
      // Load user settings if available
      if (result.userSettings) {
        Object.assign(this, result.userSettings);
      }
      
      return this.isConfigured();
    } catch (error) {
      console.error('Failed to initialize config:', error);
      return false;
    }
  },
  
  /**
   * Save API key to Chrome storage
   * @param {string} apiKey - Gemini Pro API key
   * @returns {Promise<boolean>} Success status
   */
  async setApiKey(apiKey) {
    try {
      // Validate API key format
      if (!apiKey || !apiKey.startsWith('AIza')) {
        throw new Error('Invalid API key format. Key should start with "AIza"');
      }
      
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      this.GEMINI_API_KEY = apiKey;
      return true;
    } catch (error) {
      console.error('Failed to save API key:', error);
      return false;
    }
  },
  
  /**
   * Remove API key from storage
   * @returns {Promise<boolean>} Success status
   */
  async clearApiKey() {
    try {
      await chrome.storage.sync.remove(['geminiApiKey']);
      this.GEMINI_API_KEY = null;
      return true;
    } catch (error) {
      console.error('Failed to clear API key:', error);
      return false;
    }
  },
  
  /**
   * Check if API key is configured
   * @returns {boolean} True if API key exists
   */
  isConfigured() {
    return this.GEMINI_API_KEY !== null && this.GEMINI_API_KEY.length > 0;
  },
  
  /**
   * Save user settings
   * @param {Object} settings - User settings object
   * @returns {Promise<boolean>} Success status
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set({ userSettings: settings });
      Object.assign(this, settings);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  },
  
  /**
   * Get current configuration status
   * @returns {Object} Configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      apiKeyPresent: this.GEMINI_API_KEY !== null,
      settings: {
        maxConcurrentTabs: this.MAX_CONCURRENT_TABS,
        tabDelay: this.TAB_DELAY,
        extractionTimeout: this.EXTRACTION_TIMEOUT,
        cacheDuration: this.CACHE_DURATION
      }
    };
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}


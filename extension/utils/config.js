/**
 * Shared Configuration for Picksy Extension
 */
const Config = {
    // Scraping Settings
    EXTRACTION_TIMEOUT: 30000,
    TAB_DELAY: 2000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,

    // Matching Thresholds
    EXACT_MATCH_THRESHOLD: 85,
    SIMILAR_MATCH_THRESHOLD: 60,

    // Backend API
    API_BASE_URL: 'http://localhost:5000',

    // AI Settings
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',

    // Dynamic settings (loaded from storage)
    GEMINI_API_KEY: null,

    /**
     * Initialize config by loading from storage
     */
    async init() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.sync.get(['geminiApiKey'], (result) => {
                    if (result.geminiApiKey) {
                        this.GEMINI_API_KEY = result.geminiApiKey;
                        console.log('✅ Config initialized with API Key');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    },

    /**
     * Check if AI is configured
     */
    isConfigured() {
        // If not loaded yet, try to read from DOM input if available (popup context)
        if (!this.GEMINI_API_KEY) {
            const input = document.getElementById('geminiApiKey');
            if (input && input.value) {
                this.GEMINI_API_KEY = input.value;
            }
        }
        return !!this.GEMINI_API_KEY;
    }
};

// Initialize on load if possible
if (typeof chrome !== 'undefined' && chrome.storage) {
    Config.init();
}

// Export if module system is used
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}

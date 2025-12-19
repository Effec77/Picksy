/**
 * API Service for Picksy Extension
 * Centralizes all backend communication.
 * Depends on Config (config.js)
 */
const API = {
    /**
     * Get recommendations based on user history
     * @param {Array<string>} history - List of product titles
     * @returns {Promise<Object>} Recommendations
     */
    async getRecommendations(history) {
        if (!Config.API_BASE_URL) {
            console.error("API Base URL not configured");
            return { recommendations: [] };
        }

        try {
            const response = await fetch(`${Config.API_BASE_URL}/recommendations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: history })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch recommendations:', error);
            throw error;
        }
    },

    /**
     * Placeholder for future Business Intelligence API
     */
    async getBusinessInsights(query) {
        // To be implemented
        return { message: "Not implemented" };
    }
};

// Expose to window
if (typeof window !== 'undefined') {
    window.API = API;
}

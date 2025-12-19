// Pricing page functionality
class PricingPage {
    constructor() {
        this.subscriptionService = new ExtensionSubscriptionService();
        this.currentTier = 'free';
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadPricingData();
    }

    setupEventListeners() {
        document.getElementById('backButton').addEventListener('click', () => {
            window.location.href = 'popup.html';
        });
    }

    async loadPricingData() {
        try {
            const [tiersData, usageData] = await Promise.all([
                this.subscriptionService.getTiers(),
                this.subscriptionService.getUserUsage()
            ]);

            this.currentTier = tiersData.currentTier;
            this.renderTiers(tiersData.tiers);
            
            if (usageData) {
                this.renderUsage(usageData);
            }

            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('pricingContent').style.display = 'block';
        } catch (error) {
            console.error('Error loading pricing data:', error);
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('errorState').style.display = 'block';
        }
    }

    renderTiers(tiers) {
        const tiersList = document.getElementById('tiersList');
        tiersList.innerHTML = '';

        tiers.forEach(tier => {
            const tierCard = this.createTierCard(tier);
            tiersList.appendChild(tierCard);
        });
    }

    createTierCard(tier) {
        const card = document.createElement('div');
        card.className = 'tier-card';
        
        if (tier.tier === this.currentTier) {
            card.classList.add('current');
        }
        
        if (tier.isPopular) {
            card.classList.add('popular');
        }

        const badge = tier.tier === this.currentTier 
            ? '<div class="current-badge">Current Plan</div>'
            : tier.isPopular 
                ? '<div class="popular-badge">Most Popular</div>'
                : '';

        card.innerHTML = `
            ${badge}
            <div class="tier-header">
                <div class="tier-name">${tier.name}</div>
                <div class="tier-price">${this.formatPrice(tier.price)}</div>
            </div>
            <div class="tier-description">${tier.description}</div>
            <ul class="tier-features">
                ${tier.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            <button class="tier-button ${this.getButtonClass(tier)}" 
                    ${this.isButtonDisabled(tier) ? 'disabled' : ''}
                    onclick="pricingPage.handleUpgrade('${tier.tier}')">
                ${this.getButtonText(tier)}
            </button>
        `;

        return card;
    }

    getButtonClass(tier) {
        if (tier.tier === this.currentTier) {
            return 'secondary';
        }
        return tier.isPopular ? 'primary' : 'secondary';
    }

    isButtonDisabled(tier) {
        return tier.tier === this.currentTier || tier.tier === 'free';
    }

    getButtonText(tier) {
        if (tier.tier === this.currentTier) {
            return 'Current Plan';
        }
        if (tier.tier === 'free') {
            return 'Free Forever';
        }
        return `Upgrade to ${tier.name}`;
    }

    async handleUpgrade(targetTier) {
        if (targetTier === this.currentTier || targetTier === 'free') {
            return;
        }

        try {
            // In a real implementation, this would redirect to a payment processor
            // For now, we'll show a simple confirmation
            const confirmed = confirm(`Upgrade to ${targetTier} tier?\n\nThis will redirect you to the payment page.`);
            
            if (confirmed) {
                // Simulate upgrade process
                const success = await this.subscriptionService.upgradeSubscription(targetTier);
                
                if (success) {
                    alert('Upgrade successful! Your new features are now available.');
                    await this.loadPricingData(); // Refresh the page
                } else {
                    alert('Upgrade failed. Please try again or contact support.');
                }
            }
        } catch (error) {
            console.error('Error during upgrade:', error);
            alert('An error occurred during upgrade. Please try again.');
        }
    }

    renderUsage(usage) {
        const usageSection = document.getElementById('usageSection');
        const usageStats = document.getElementById('usageStats');
        
        const limits = {
            'Products Tracked': { current: usage.productsTracked, limit: usage.limits?.productsTracked || -1 },
            'Price Checks Today': { current: usage.priceChecksToday, limit: usage.limits?.priceChecksPerDay || -1 },
            'Notifications Today': { current: usage.notificationsToday, limit: usage.limits?.notificationsPerDay || -1 },
            'API Requests (Hour)': { current: usage.apiRequestsThisHour, limit: usage.limits?.apiRequestsPerHour || -1 }
        };

        usageStats.innerHTML = Object.entries(limits).map(([name, data]) => {
            const percentage = this.getUsagePercentage(data.current, data.limit);
            const barClass = percentage >= 90 ? 'danger' : percentage >= 80 ? 'warning' : '';
            const limitText = data.limit === -1 ? 'Unlimited' : data.limit;

            return `
                <div class="usage-item">
                    <span>${name}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 12px; color: #666;">${data.current}/${limitText}</span>
                        <div class="usage-bar">
                            <div class="usage-fill ${barClass}" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        usageSection.style.display = 'block';
    }

    formatPrice(priceInCents) {
        if (priceInCents === 0) {
            return 'Free';
        }
        return `$${(priceInCents / 100).toFixed(2)}/month`;
    }

    getUsagePercentage(current, limit) {
        if (limit === -1) return 0; // Unlimited
        if (limit === 0) return 100;
        return Math.min((current / limit) * 100, 100);
    }
}

// Simple ExtensionSubscriptionService for demo
class ExtensionSubscriptionService {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api';
    }

    async getTiers() {
        // Mock data for demo - in real implementation, this would call the API
        return {
            currentTier: 'free',
            tiers: [
                {
                    tier: 'free',
                    name: 'Free',
                    description: 'Perfect for casual price tracking',
                    price: 0,
                    limits: {
                        productsTracked: 10,
                        priceChecksPerDay: 50,
                        notificationsPerDay: 20,
                        apiRequestsPerHour: 100,
                        dataRetentionDays: 30
                    },
                    features: [
                        'Track up to 10 products',
                        '50 price checks per day',
                        '20 notifications per day',
                        '30 days data retention',
                        'Basic price alerts'
                    ]
                },
                {
                    tier: 'premium',
                    name: 'Premium',
                    description: 'For serious deal hunters',
                    price: 999,
                    limits: {
                        productsTracked: 100,
                        priceChecksPerDay: 500,
                        notificationsPerDay: 200,
                        apiRequestsPerHour: 1000,
                        dataRetentionDays: 365
                    },
                    features: [
                        'Track up to 100 products',
                        '500 price checks per day',
                        '200 notifications per day',
                        '1 year data retention',
                        'Advanced price analytics',
                        'Priority notifications',
                        'Email notifications',
                        'Price history charts'
                    ],
                    isPopular: true
                },
                {
                    tier: 'enterprise',
                    name: 'Enterprise',
                    description: 'For businesses and power users',
                    price: 4999,
                    limits: {
                        productsTracked: 1000,
                        priceChecksPerDay: 5000,
                        notificationsPerDay: 1000,
                        apiRequestsPerHour: 10000,
                        dataRetentionDays: -1
                    },
                    features: [
                        'Track up to 1000 products',
                        '5000 price checks per day',
                        '1000 notifications per day',
                        'Unlimited data retention',
                        'Advanced analytics dashboard',
                        'API access',
                        'Bulk operations',
                        'Priority support',
                        'Custom integrations'
                    ]
                }
            ]
        };
    }

    async getUserUsage() {
        // Mock usage data
        return {
            userId: 'demo-user',
            tier: 'free',
            productsTracked: 7,
            priceChecksToday: 23,
            notificationsToday: 5,
            apiRequestsThisHour: 12,
            limits: {
                productsTracked: 10,
                priceChecksPerDay: 50,
                notificationsPerDay: 20,
                apiRequestsPerHour: 100
            }
        };
    }

    async upgradeSubscription(targetTier) {
        // Mock upgrade - in real implementation, would process payment
        console.log(`Upgrading to ${targetTier}`);
        return true;
    }
}

// Initialize the pricing page
const pricingPage = new PricingPage();
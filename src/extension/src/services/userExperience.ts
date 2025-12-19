/**
 * User Experience Service for Picksy Extension
 * Handles onboarding, feedback, and user guidance
 */

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  completed: boolean;
}

export interface FeedbackMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

export interface UnsupportedSiteGuidance {
  siteName: string;
  reason: string;
  alternatives: string[];
  requestSupport?: boolean;
}

export class UserExperienceService {
  private static instance: UserExperienceService;
  private onboardingSteps: OnboardingStep[] = [];
  private feedbackContainer: HTMLElement | null = null;

  static getInstance(): UserExperienceService {
    if (!UserExperienceService.instance) {
      UserExperienceService.instance = new UserExperienceService();
    }
    return UserExperienceService.instance;
  }

  constructor() {
    this.initializeOnboardingSteps();
    this.setupFeedbackContainer();
  }

  /**
   * Initialize onboarding flow focusing on core features
   */
  private initializeOnboardingSteps(): void {
    this.onboardingSteps = [
      {
        id: 'welcome',
        title: 'Welcome to Picksy!',
        description: 'Track prices on your favorite products and get notified when they drop.',
        completed: false
      },
      {
        id: 'detect_product',
        title: 'Find a Product',
        description: 'Visit any supported retailer (Amazon, Walmart, Target, etc.) and open a product page.',
        action: 'Visit a product page',
        completed: false
      },
      {
        id: 'track_product',
        title: 'Track Your First Product',
        description: 'Click the Picksy icon and select "Track This Product" to start monitoring prices.',
        action: 'Track a product',
        completed: false
      },
      {
        id: 'notifications',
        title: 'Enable Notifications',
        description: 'Allow notifications so you never miss a price drop.',
        action: 'Enable notifications',
        completed: false
      },
      {
        id: 'complete',
        title: 'You\'re All Set!',
        description: 'Picksy will now monitor your tracked products and notify you of price changes.',
        completed: false
      }
    ];
  }

  /**
   * Setup feedback container for user messages
   */
  private setupFeedbackContainer(): void {
    // Create feedback container if it doesn't exist
    if (!document.getElementById('picksy-feedback')) {
      const container = document.createElement('div');
      container.id = 'picksy-feedback';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 300px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
      this.feedbackContainer = container;
    }
  }

  /**
   * Check if user needs onboarding
   */
  async shouldShowOnboarding(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['onboardingCompleted', 'trackedProducts']);
      const hasCompletedOnboarding = result.onboardingCompleted;
      const hasTrackedProducts = result.trackedProducts && result.trackedProducts.length > 0;
      
      return !hasCompletedOnboarding && !hasTrackedProducts;
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      return false;
    }
  }

  /**
   * Start onboarding flow
   */
  async startOnboarding(): Promise<void> {
    try {
      // Load current progress
      const result = await chrome.storage.local.get(['onboardingProgress']);
      const progress = result.onboardingProgress || {};

      // Update step completion status
      this.onboardingSteps.forEach(step => {
        step.completed = progress[step.id] || false;
      });

      // Show first incomplete step
      const currentStep = this.onboardingSteps.find(step => !step.completed);
      if (currentStep) {
        this.showOnboardingStep(currentStep);
      }
    } catch (error) {
      console.error('Failed to start onboarding:', error);
    }
  }

  /**
   * Show specific onboarding step
   */
  private showOnboardingStep(step: OnboardingStep): void {
    const stepIndex = this.onboardingSteps.findIndex(s => s.id === step.id);
    const totalSteps = this.onboardingSteps.length;

    this.showFeedback({
      type: 'info',
      message: `
        <div class="onboarding-step">
          <div class="step-header">
            <h3>${step.title}</h3>
            <span class="step-counter">${stepIndex + 1}/${totalSteps}</span>
          </div>
          <p>${step.description}</p>
          ${step.action ? `<button class="onboarding-action">${step.action}</button>` : ''}
          <div class="step-progress">
            <div class="progress-bar" style="width: ${((stepIndex + 1) / totalSteps) * 100}%"></div>
          </div>
        </div>
      `,
      duration: 0, // Don't auto-hide onboarding
      actions: [
        {
          label: 'Skip',
          action: () => this.skipOnboarding()
        }
      ]
    });
  }

  /**
   * Mark onboarding step as completed
   */
  async completeOnboardingStep(stepId: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['onboardingProgress']);
      const progress = result.onboardingProgress || {};
      
      progress[stepId] = true;
      await chrome.storage.local.set({ onboardingProgress: progress });

      // Update local state
      const step = this.onboardingSteps.find(s => s.id === stepId);
      if (step) {
        step.completed = true;
      }

      // Show next step or complete onboarding
      const nextStep = this.onboardingSteps.find(s => !s.completed);
      if (nextStep) {
        this.showOnboardingStep(nextStep);
      } else {
        await this.completeOnboarding();
      }
    } catch (error) {
      console.error('Failed to complete onboarding step:', error);
    }
  }

  /**
   * Complete entire onboarding flow
   */
  async completeOnboarding(): Promise<void> {
    try {
      await chrome.storage.local.set({ onboardingCompleted: true });
      
      this.showFeedback({
        type: 'success',
        message: 'Welcome to Picksy! You\'re all set to start tracking prices.',
        duration: 5000
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }

  /**
   * Skip onboarding flow
   */
  async skipOnboarding(): Promise<void> {
    try {
      await chrome.storage.local.set({ onboardingCompleted: true });
      this.hideFeedback();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  }

  /**
   * Show user feedback message with clear actions
   */
  showFeedback(feedback: FeedbackMessage): void {
    if (!this.feedbackContainer) {
      this.setupFeedbackContainer();
    }

    const feedbackElement = document.createElement('div');
    feedbackElement.className = `picksy-feedback-message ${feedback.type}`;
    feedbackElement.style.cssText = `
      background: ${this.getFeedbackColor(feedback.type)};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;

    // Add message content
    const messageContent = document.createElement('div');
    messageContent.innerHTML = feedback.message;
    feedbackElement.appendChild(messageContent);

    // Add action buttons if provided
    if (feedback.actions && feedback.actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.style.cssText = `
        margin-top: 8px;
        display: flex;
        gap: 8px;
      `;

      feedback.actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.label;
        button.style.cssText = `
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        `;
        button.onclick = () => {
          action.action();
          this.hideFeedback(feedbackElement);
        };
        actionsContainer.appendChild(button);
      });

      feedbackElement.appendChild(actionsContainer);
    }

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onclick = () => this.hideFeedback(feedbackElement);
    feedbackElement.style.position = 'relative';
    feedbackElement.appendChild(closeButton);

    this.feedbackContainer?.appendChild(feedbackElement);

    // Auto-hide if duration is specified
    if (feedback.duration && feedback.duration > 0) {
      setTimeout(() => {
        this.hideFeedback(feedbackElement);
      }, feedback.duration);
    }

    // Add CSS animation
    if (!document.getElementById('picksy-feedback-styles')) {
      const styles = document.createElement('style');
      styles.id = 'picksy-feedback-styles';
      styles.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        .picksy-feedback-message.hiding {
          animation: slideOut 0.3s ease-in forwards;
        }
      `;
      document.head.appendChild(styles);
    }
  }

  /**
   * Hide feedback message
   */
  private hideFeedback(element?: HTMLElement): void {
    if (element) {
      element.classList.add('hiding');
      setTimeout(() => {
        element.remove();
      }, 300);
    } else {
      // Hide all feedback messages
      const messages = this.feedbackContainer?.querySelectorAll('.picksy-feedback-message');
      messages?.forEach(msg => {
        (msg as HTMLElement).classList.add('hiding');
        setTimeout(() => msg.remove(), 300);
      });
    }
  }

  /**
   * Get feedback color based on type
   */
  private getFeedbackColor(type: string): string {
    switch (type) {
      case 'success': return '#28a745';
      case 'error': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'info': return '#007bff';
      default: return '#6c757d';
    }
  }

  /**
   * Show guidance for unsupported sites
   */
  showUnsupportedSiteGuidance(url: string): void {
    const domain = new URL(url).hostname;
    const guidance = this.getUnsupportedSiteGuidance(domain);

    this.showFeedback({
      type: 'warning',
      message: `
        <div class="unsupported-site">
          <h4>Site Not Supported</h4>
          <p><strong>${guidance.siteName}</strong> is not currently supported.</p>
          <p><strong>Reason:</strong> ${guidance.reason}</p>
          ${guidance.alternatives.length > 0 ? `
            <p><strong>Try these alternatives:</strong></p>
            <ul>
              ${guidance.alternatives.map(alt => `<li>${alt}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `,
      duration: 10000,
      actions: guidance.requestSupport ? [
        {
          label: 'Request Support',
          action: () => this.requestSiteSupport(domain)
        }
      ] : []
    });
  }

  /**
   * Get guidance for specific unsupported sites
   */
  private getUnsupportedSiteGuidance(domain: string): UnsupportedSiteGuidance {
    // Common unsupported sites and reasons
    const siteGuidance: { [key: string]: UnsupportedSiteGuidance } = {
      'aliexpress.com': {
        siteName: 'AliExpress',
        reason: 'Complex international shipping and pricing variations',
        alternatives: ['Amazon', 'eBay'],
        requestSupport: true
      },
      'facebook.com': {
        siteName: 'Facebook Marketplace',
        reason: 'Requires login and has anti-automation measures',
        alternatives: ['eBay', 'Craigslist'],
        requestSupport: false
      },
      'craigslist.org': {
        siteName: 'Craigslist',
        reason: 'Local listings with no standardized pricing',
        alternatives: ['Facebook Marketplace', 'eBay'],
        requestSupport: false
      }
    };

    return siteGuidance[domain] || {
      siteName: domain,
      reason: 'Not yet integrated with our system',
      alternatives: ['Amazon', 'Walmart', 'Target', 'Best Buy'],
      requestSupport: true
    };
  }

  /**
   * Request support for a new site
   */
  private async requestSiteSupport(domain: string): Promise<void> {
    try {
      // In a real implementation, this would send a request to the backend
      console.log(`Requesting support for: ${domain}`);
      
      this.showFeedback({
        type: 'success',
        message: `Thanks! We've noted your request for ${domain} support.`,
        duration: 3000
      });
    } catch (error) {
      console.error('Failed to request site support:', error);
      this.showFeedback({
        type: 'error',
        message: 'Failed to submit request. Please try again later.',
        duration: 3000
      });
    }
  }

  /**
   * Show success feedback for user actions
   */
  showSuccessFeedback(action: string, details?: string): void {
    const messages = {
      'product_tracked': 'Product added to your tracking list!',
      'product_removed': 'Product removed from tracking.',
      'notification_enabled': 'Notifications enabled successfully.',
      'price_comparison_loaded': 'Price comparison updated.',
      'settings_saved': 'Settings saved successfully.'
    };

    const message = messages[action as keyof typeof messages] || `${action} completed successfully.`;
    
    this.showFeedback({
      type: 'success',
      message: details ? `${message} ${details}` : message,
      duration: 3000
    });
  }

  /**
   * Show error feedback with recovery options
   */
  showErrorFeedback(error: string, recoveryOptions?: Array<{ label: string; action: () => void }>): void {
    this.showFeedback({
      type: 'error',
      message: error,
      duration: 8000,
      actions: recoveryOptions || [
        {
          label: 'Retry',
          action: () => window.location.reload()
        }
      ]
    });
  }

  /**
   * Show loading feedback for long operations
   */
  showLoadingFeedback(message: string): HTMLElement {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'picksy-loading-feedback';
    
    this.showFeedback({
      type: 'info',
      message: `<div style="display: flex; align-items: center; gap: 8px;">
        <div class="loading-spinner"></div>
        ${message}
      </div>`,
      duration: 0
    });

    return loadingElement;
  }
}
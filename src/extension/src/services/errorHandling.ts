import { ExtensionError, RecoveryOption } from '../types/index.js';
import { UserExperienceService } from './userExperience.js';

export enum ExtensionErrorCode {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  PRODUCT_DETECTION_FAILED = 'PRODUCT_DETECTION_FAILED',
  API_CONNECTION_FAILED = 'API_CONNECTION_FAILED',
  STORAGE_ACCESS_FAILED = 'STORAGE_ACCESS_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNSUPPORTED_SITE = 'UNSUPPORTED_SITE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  RATE_LIMITED = 'RATE_LIMITED'
}

export class ExtensionErrorHandler {
  private static instance: ExtensionErrorHandler;
  private uxService: UserExperienceService;
  private errorLog: ExtensionError[] = [];
  private maxLogSize = 100;

  static getInstance(): ExtensionErrorHandler {
    if (!ExtensionErrorHandler.instance) {
      ExtensionErrorHandler.instance = new ExtensionErrorHandler();
    }
    return ExtensionErrorHandler.instance;
  }

  constructor() {
    this.uxService = UserExperienceService.getInstance();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Setup global error handlers for the extension
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        ExtensionErrorCode.INITIALIZATION_FAILED,
        'Unhandled promise rejection',
        event.reason,
        [
          {
            label: 'Reload Extension',
            action: () => chrome.runtime.reload()
          }
        ]
      );
    });

    // Handle general JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        ExtensionErrorCode.INITIALIZATION_FAILED,
        'JavaScript error',
        event.error,
        [
          {
            label: 'Reload Extension',
            action: () => chrome.runtime.reload()
          }
        ]
      );
    });
  }

  /**
   * Handle and log errors with user-friendly feedback
   */
  handleError(
    code: ExtensionErrorCode,
    message: string,
    details?: any,
    recoveryOptions?: RecoveryOption[]
  ): ExtensionError {
    const error: ExtensionError = {
      code,
      message,
      details,
      recoveryOptions: recoveryOptions || this.getDefaultRecoveryOptions(code),
      timestamp: new Date()
    };

    // Log error
    this.logError(error);

    // Show user-friendly feedback
    this.showErrorFeedback(error);

    return error;
  }

  /**
   * Handle API errors with specific recovery options
   */
  handleApiError(response: any, endpoint: string): ExtensionError {
    let code = ExtensionErrorCode.API_CONNECTION_FAILED;
    let message = 'Failed to connect to Picksy services';
    const recoveryOptions: RecoveryOption[] = [];

    if (response?.status === 429) {
      code = ExtensionErrorCode.RATE_LIMITED;
      message = 'Too many requests. Please wait before trying again.';
      recoveryOptions.push({
        label: 'Wait and Retry',
        action: () => setTimeout(() => window.location.reload(), 60000),
        description: 'Wait 1 minute before retrying'
      });
    } else if (response?.status >= 500) {
      message = 'Picksy services are temporarily unavailable';
      recoveryOptions.push({
        label: 'Check Status',
        action: () => chrome.tabs.create({ url: 'https://status.picksy.com' }),
        description: 'Check service status page'
      });
    } else if (response?.status === 401) {
      message = 'Authentication failed. Please log in again.';
      recoveryOptions.push({
        label: 'Login',
        action: () => chrome.tabs.create({ url: 'https://app.picksy.com/login' }),
        description: 'Open login page'
      });
    } else if (!navigator.onLine) {
      code = ExtensionErrorCode.NETWORK_ERROR;
      message = 'No internet connection detected';
      recoveryOptions.push({
        label: 'Check Connection',
        action: () => chrome.tabs.create({ url: 'chrome://settings/help' }),
        description: 'Check your internet connection'
      });
    }

    return this.handleError(code, message, { endpoint, response }, recoveryOptions);
  }

  /**
   * Handle product detection errors
   */
  handleProductDetectionError(url: string, reason?: string): ExtensionError {
    const domain = new URL(url).hostname;
    
    return this.handleError(
      ExtensionErrorCode.PRODUCT_DETECTION_FAILED,
      `Unable to detect product on ${domain}`,
      { url, reason },
      [
        {
          label: 'Refresh Page',
          action: () => chrome.tabs.reload(),
          description: 'Reload the page and try again'
        },
        {
          label: 'Report Issue',
          action: () => this.reportProductDetectionIssue(url),
          description: 'Help us improve product detection'
        }
      ]
    );
  }

  /**
   * Handle storage errors
   */
  handleStorageError(operation: string, details?: any): ExtensionError {
    return this.handleError(
      ExtensionErrorCode.STORAGE_ACCESS_FAILED,
      `Failed to ${operation} data`,
      details,
      [
        {
          label: 'Clear Storage',
          action: () => this.clearExtensionStorage(),
          description: 'Clear extension data and restart'
        },
        {
          label: 'Check Permissions',
          action: () => chrome.tabs.create({ url: 'chrome://extensions/' }),
          description: 'Check extension permissions'
        }
      ]
    );
  }

  /**
   * Handle timeout errors
   */
  handleTimeoutError(operation: string, timeout: number): ExtensionError {
    return this.handleError(
      ExtensionErrorCode.TIMEOUT_ERROR,
      `${operation} timed out after ${timeout}ms`,
      { operation, timeout },
      [
        {
          label: 'Retry',
          action: () => window.location.reload(),
          description: 'Try the operation again'
        },
        {
          label: 'Check Connection',
          action: () => chrome.tabs.create({ url: 'chrome://settings/help' }),
          description: 'Check your internet connection'
        }
      ]
    );
  }

  /**
   * Get default recovery options for error codes
   */
  private getDefaultRecoveryOptions(code: ExtensionErrorCode): RecoveryOption[] {
    switch (code) {
      case ExtensionErrorCode.INITIALIZATION_FAILED:
        return [
          {
            label: 'Reload Extension',
            action: () => chrome.runtime.reload(),
            description: 'Restart the extension'
          },
          {
            label: 'Get Help',
            action: () => chrome.tabs.create({ url: 'https://help.picksy.com' }),
            description: 'Visit help center'
          }
        ];

      case ExtensionErrorCode.PERMISSION_DENIED:
        return [
          {
            label: 'Grant Permissions',
            action: () => chrome.tabs.create({ url: 'chrome://extensions/' }),
            description: 'Update extension permissions'
          }
        ];

      case ExtensionErrorCode.UNSUPPORTED_SITE:
        return [
          {
            label: 'View Supported Sites',
            action: () => chrome.tabs.create({ url: 'https://help.picksy.com/supported-sites' }),
            description: 'See list of supported retailers'
          }
        ];

      default:
        return [
          {
            label: 'Retry',
            action: () => window.location.reload(),
            description: 'Try again'
          }
        ];
    }
  }

  /**
   * Show user-friendly error feedback
   */
  private showErrorFeedback(error: ExtensionError): void {
    this.uxService.showErrorFeedback(
      error.message,
      error.recoveryOptions?.map(option => ({
        label: option.label,
        action: option.action
      }))
    );
  }

  /**
   * Log error for debugging and analytics
   */
  private logError(error: ExtensionError): void {
    // Add to error log
    this.errorLog.unshift(error);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Console log for debugging
    console.error(`[Picksy Extension] ${error.code}: ${error.message}`, error.details);

    // Store in extension storage for debugging
    try {
      chrome.storage.local.set({
        errorLog: this.errorLog.slice(0, 10) // Store only recent errors
      });
    } catch (storageError) {
      console.error('Failed to store error log:', storageError);
    }
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(): ExtensionError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
    try {
      chrome.storage.local.remove(['errorLog']);
    } catch (error) {
      console.error('Failed to clear error log:', error);
    }
  }

  /**
   * Report product detection issue
   */
  private async reportProductDetectionIssue(url: string): Promise<void> {
    try {
      // In a real implementation, this would send data to analytics
      console.log('Reporting product detection issue for:', url);
      
      this.uxService.showFeedback({
        type: 'success',
        message: 'Thank you for reporting this issue. We\'ll work on improving support for this site.',
        duration: 5000
      });
    } catch (error) {
      console.error('Failed to report issue:', error);
    }
  }

  /**
   * Clear extension storage
   */
  private async clearExtensionStorage(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      this.uxService.showFeedback({
        type: 'success',
        message: 'Extension data cleared. Please reload the page.',
        duration: 3000,
        actions: [
          {
            label: 'Reload',
            action: () => window.location.reload()
          }
        ]
      });
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }

  /**
   * Create error with context
   */
  createContextualError(
    code: ExtensionErrorCode,
    message: string,
    context: {
      url?: string;
      operation?: string;
      timestamp?: Date;
      userAgent?: string;
    }
  ): ExtensionError {
    return this.handleError(code, message, context);
  }

  /**
   * Handle graceful degradation
   */
  enableGracefulDegradation(feature: string, reason: string): void {
    this.uxService.showFeedback({
      type: 'warning',
      message: `${feature} is temporarily unavailable: ${reason}`,
      duration: 8000,
      actions: [
        {
          label: 'Continue',
          action: () => {} // Just dismiss
        }
      ]
    });
  }
}
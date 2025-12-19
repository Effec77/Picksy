import { 
  PriceAlert, 
  NotificationChannel, 
  UserPreferences 
} from '../../../shared/types';
import { NotificationProvider } from './notificationEngine';
import { logger } from '../utils/logger';

/**
 * Browser notification provider for in-browser alerts
 */
export class BrowserNotificationProvider implements NotificationProvider {
  private isEnabled = true;

  getChannel(): NotificationChannel {
    return NotificationChannel.BROWSER;
  }

  async send(alert: PriceAlert, userPreferences: UserPreferences): Promise<boolean> {
    try {
      // In a real implementation, this would send to browser extension
      // For now, we'll simulate the notification
      logger.info(`Browser notification sent for alert ${alert.id}: ${alert.message}`);
      
      // Simulate potential failure
      if (Math.random() < 0.05) { // 5% failure rate
        throw new Error('Browser notification service temporarily unavailable');
      }

      return true;
    } catch (error) {
      logger.error(`Browser notification failed for alert ${alert.id}:`, error);
      return false;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.isEnabled;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

/**
 * Email notification provider
 */
export class EmailNotificationProvider implements NotificationProvider {
  private isEnabled = true;
  private readonly maxEmailsPerHour = 10;
  private emailsSentThisHour = new Map<string, number>();

  getChannel(): NotificationChannel {
    return NotificationChannel.EMAIL;
  }

  async send(alert: PriceAlert, userPreferences: UserPreferences): Promise<boolean> {
    try {
      // Check rate limiting
      if (!this.checkRateLimit(alert.userId)) {
        logger.warn(`Email rate limit exceeded for user ${alert.userId}`);
        return false;
      }

      // In a real implementation, this would use an email service like SendGrid
      logger.info(`Email notification sent for alert ${alert.id}: ${alert.message}`);
      
      // Track email sent
      this.trackEmailSent(alert.userId);

      // Simulate potential failure
      if (Math.random() < 0.02) { // 2% failure rate
        throw new Error('Email service temporarily unavailable');
      }

      return true;
    } catch (error) {
      logger.error(`Email notification failed for alert ${alert.id}:`, error);
      return false;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.isEnabled;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  private checkRateLimit(userId: string): boolean {
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const key = `${userId}_${currentHour}`;
    const count = this.emailsSentThisHour.get(key) || 0;
    return count < this.maxEmailsPerHour;
  }

  private trackEmailSent(userId: string): void {
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const key = `${userId}_${currentHour}`;
    const count = this.emailsSentThisHour.get(key) || 0;
    this.emailsSentThisHour.set(key, count + 1);

    // Clean up old entries
    for (const [k] of this.emailsSentThisHour) {
      const [, hour] = k.split('_');
      if (parseInt(hour) < currentHour - 1) {
        this.emailsSentThisHour.delete(k);
      }
    }
  }
}

/**
 * Push notification provider for mobile/web push
 */
export class PushNotificationProvider implements NotificationProvider {
  private isEnabled = true;

  getChannel(): NotificationChannel {
    return NotificationChannel.PUSH;
  }

  async send(alert: PriceAlert, userPreferences: UserPreferences): Promise<boolean> {
    try {
      // In a real implementation, this would use a push service like FCM
      logger.info(`Push notification sent for alert ${alert.id}: ${alert.message}`);
      
      // Simulate potential failure
      if (Math.random() < 0.03) { // 3% failure rate
        throw new Error('Push notification service temporarily unavailable');
      }

      return true;
    } catch (error) {
      logger.error(`Push notification failed for alert ${alert.id}:`, error);
      return false;
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.isEnabled;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

/**
 * Factory for creating notification providers
 */
export class NotificationProviderFactory {
  static createProvider(channel: NotificationChannel): NotificationProvider {
    switch (channel) {
      case NotificationChannel.BROWSER:
        return new BrowserNotificationProvider();
      case NotificationChannel.EMAIL:
        return new EmailNotificationProvider();
      case NotificationChannel.PUSH:
        return new PushNotificationProvider();
      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }
  }

  static createAllProviders(): NotificationProvider[] {
    return [
      new BrowserNotificationProvider(),
      new EmailNotificationProvider(),
      new PushNotificationProvider()
    ];
  }
}
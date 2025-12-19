import { NotificationEngine, NotificationPriority } from '../services/notificationEngine';
import { InMemoryNotificationQueue } from '../services/notificationQueue';
import { BrowserNotificationProvider } from '../services/notificationProviders';
import { PriceAlert, NotificationChannel, UserPreferences, AlertType } from '../../../shared/types';

describe('NotificationEngine', () => {
  let engine: NotificationEngine;
  let queue: InMemoryNotificationQueue;

  beforeEach(() => {
    queue = new InMemoryNotificationQueue();
    engine = new NotificationEngine(queue);
    
    // Register browser provider
    const browserProvider = new BrowserNotificationProvider();
    engine.registerProvider(browserProvider);
  });

  afterEach(async () => {
    await engine.stop();
    await queue.clear();
  });

  test('should queue alert for delivery', async () => {
    const alert: PriceAlert = {
      id: 'test-alert-1',
      userId: 'user-1',
      productId: 'product-1',
      alertType: AlertType.PRICE_DROP,
      message: 'Test price drop alert',
      createdAt: new Date(),
      delivered: false
    };

    const userPreferences: UserPreferences = {
      notificationChannels: [NotificationChannel.BROWSER],
      checkFrequency: 60,
      priceThreshold: 0.1
    };

    const deliveries = await engine.queueAlert(alert, userPreferences);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].alertId).toBe(alert.id);
    expect(deliveries[0].channel).toBe(NotificationChannel.BROWSER);
    expect(deliveries[0].priority).toBe(NotificationPriority.HIGH);
  });

  test('should determine correct priority for different alert types', async () => {
    const targetPriceAlert: PriceAlert = {
      id: 'test-alert-2',
      userId: 'user-1',
      productId: 'product-1',
      alertType: AlertType.TARGET_PRICE_REACHED,
      message: 'Target price reached',
      createdAt: new Date(),
      delivered: false
    };

    const userPreferences: UserPreferences = {
      notificationChannels: [NotificationChannel.BROWSER],
      checkFrequency: 60,
      priceThreshold: 0.1
    };

    const deliveries = await engine.queueAlert(targetPriceAlert, userPreferences);

    expect(deliveries[0].priority).toBe(NotificationPriority.URGENT);
  });

  test('should handle health check', async () => {
    const health = await engine.healthCheck();

    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('providers');
    expect(health).toHaveProperty('queueSize');
    expect(health.providers).toHaveProperty('browser');
  });
});
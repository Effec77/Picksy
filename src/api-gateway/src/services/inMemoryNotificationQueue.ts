import { NotificationQueue, NotificationDelivery, DeliveryStatus } from './notificationEngine.js';
import { logger } from '../utils/logger.js';

/**
 * Simple in-memory implementation of NotificationQueue for development/testing
 * In production, this should be replaced with Redis or database-backed queue
 */
export class InMemoryNotificationQueue implements NotificationQueue {
  private deliveries = new Map<string, NotificationDelivery>();
  private pendingQueue: string[] = [];
  private retryQueue = new Map<string, Date>();

  async add(delivery: NotificationDelivery): Promise<void> {
    try {
      this.deliveries.set(delivery.id, { ...delivery });
      this.pendingQueue.push(delivery.id);
      
      logger.debug(`Added delivery ${delivery.id} to queue`);
    } catch (error) {
      logger.error(`Error adding delivery ${delivery.id} to queue:`, error);
      throw error;
    }
  }

  async getNext(): Promise<NotificationDelivery | null> {
    try {
      // First check for retries that are ready
      const now = new Date();
      for (const [deliveryId, retryAt] of this.retryQueue) {
        if (retryAt <= now) {
          this.retryQueue.delete(deliveryId);
          const delivery = this.deliveries.get(deliveryId);
          if (delivery) {
            delivery.status = DeliveryStatus.RETRYING;
            return delivery;
          }
        }
      }

      // Then get next pending delivery
      const nextId = this.pendingQueue.shift();
      if (!nextId) {
        return null;
      }

      const delivery = this.deliveries.get(nextId);
      if (!delivery) {
        logger.warn(`Delivery ${nextId} not found in storage`);
        return null;
      }

      return delivery;
    } catch (error) {
      logger.error('Error getting next delivery from queue:', error);
      return null;
    }
  }

  async markDelivered(deliveryId: string): Promise<void> {
    try {
      const delivery = this.deliveries.get(deliveryId);
      if (delivery) {
        delivery.status = DeliveryStatus.DELIVERED;
        delivery.deliveredAt = new Date();
        logger.debug(`Marked delivery ${deliveryId} as delivered`);
      }
    } catch (error) {
      logger.error(`Error marking delivery ${deliveryId} as delivered:`, error);
      throw error;
    }
  }

  async markFailed(deliveryId: string, reason: string): Promise<void> {
    try {
      const delivery = this.deliveries.get(deliveryId);
      if (delivery) {
        delivery.status = DeliveryStatus.FAILED;
        delivery.failureReason = reason;
        logger.debug(`Marked delivery ${deliveryId} as failed: ${reason}`);
      }
    } catch (error) {
      logger.error(`Error marking delivery ${deliveryId} as failed:`, error);
      throw error;
    }
  }

  async scheduleRetry(deliveryId: string, retryAt: Date): Promise<void> {
    try {
      const delivery = this.deliveries.get(deliveryId);
      if (delivery) {
        delivery.status = DeliveryStatus.RETRYING;
        this.retryQueue.set(deliveryId, retryAt);
        logger.debug(`Scheduled retry for delivery ${deliveryId} at ${retryAt.toISOString()}`);
      }
    } catch (error) {
      logger.error(`Error scheduling retry for delivery ${deliveryId}:`, error);
      throw error;
    }
  }

  async getPendingCount(): Promise<number> {
    try {
      return this.pendingQueue.length + this.retryQueue.size;
    } catch (error) {
      logger.error('Error getting pending count:', error);
      return 0;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const now = new Date();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      let cleanedCount = 0;

      // Clean up old delivered/failed deliveries
      for (const [id, delivery] of this.deliveries) {
        const age = now.getTime() - delivery.scheduledAt.getTime();
        if (age > maxAge && (delivery.status === DeliveryStatus.DELIVERED || delivery.status === DeliveryStatus.FAILED)) {
          this.deliveries.delete(id);
          cleanedCount++;
        }
      }

      // Clean up expired retries
      for (const [deliveryId, retryAt] of this.retryQueue) {
        const age = now.getTime() - retryAt.getTime();
        if (age > maxAge) {
          this.retryQueue.delete(deliveryId);
          const delivery = this.deliveries.get(deliveryId);
          if (delivery) {
            delivery.status = DeliveryStatus.EXPIRED;
          }
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old notification deliveries`);
      }
    } catch (error) {
      logger.error('Error during notification queue cleanup:', error);
    }
  }

  /**
   * Get all deliveries (for debugging/monitoring)
   */
  getAllDeliveries(): NotificationDelivery[] {
    return Array.from(this.deliveries.values());
  }

  /**
   * Get delivery by ID
   */
  getDelivery(deliveryId: string): NotificationDelivery | null {
    return this.deliveries.get(deliveryId) || null;
  }

  /**
   * Clear all deliveries (for testing)
   */
  clear(): void {
    this.deliveries.clear();
    this.pendingQueue.length = 0;
    this.retryQueue.clear();
  }
}
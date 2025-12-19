import { NotificationDelivery, DeliveryStatus, NotificationPriority, NotificationQueue } from './notificationEngine';
import { logger } from '../utils/logger';

/**
 * In-memory implementation of notification queue with priority handling
 * In production, this would be backed by Redis or a message queue system
 */
export class InMemoryNotificationQueue implements NotificationQueue {
  private queue: NotificationDelivery[] = [];
  private deliveries = new Map<string, NotificationDelivery>();
  private readonly maxQueueSize = 10000;

  /**
   * Add a delivery to the queue
   */
  async add(delivery: NotificationDelivery): Promise<void> {
    try {
      if (this.queue.length >= this.maxQueueSize) {
        throw new Error('Notification queue is full');
      }

      this.deliveries.set(delivery.id, delivery);
      this.queue.push(delivery);
      
      // Sort by priority (higher priority first) and then by scheduled time
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.scheduledAt.getTime() - b.scheduledAt.getTime(); // Earlier time first
      });

      logger.debug(`Added delivery ${delivery.id} to queue (priority: ${delivery.priority})`);
    } catch (error) {
      logger.error(`Error adding delivery ${delivery.id} to queue:`, error);
      throw error;
    }
  }

  /**
   * Get the next delivery to process
   */
  async getNext(): Promise<NotificationDelivery | null> {
    try {
      const now = new Date();
      
      // Find the first delivery that is ready to be processed
      for (let i = 0; i < this.queue.length; i++) {
        const delivery = this.queue[i];
        
        // Skip if not ready yet (for retries)
        if (delivery.status === DeliveryStatus.RETRYING && delivery.scheduledAt > now) {
          continue;
        }
        
        // Skip if already processed
        if (delivery.status === DeliveryStatus.DELIVERED || 
            delivery.status === DeliveryStatus.FAILED ||
            delivery.status === DeliveryStatus.EXPIRED) {
          continue;
        }

        // Remove from queue and return
        this.queue.splice(i, 1);
        return delivery;
      }

      return null;
    } catch (error) {
      logger.error('Error getting next delivery from queue:', error);
      throw error;
    }
  }

  /**
   * Mark a delivery as successfully delivered
   */
  async markDelivered(deliveryId: string): Promise<void> {
    try {
      const delivery = this.deliveries.get(deliveryId);
      if (!delivery) {
        logger.warn(`Delivery ${deliveryId} not found when marking as delivered`);
        return;
      }

      delivery.status = DeliveryStatus.DELIVERED;
      delivery.deliveredAt = new Date();
      
      logger.debug(`Marked delivery ${deliveryId} as delivered`);
    } catch (error) {
      logger.error(`Error marking delivery ${deliveryId} as delivered:`, error);
      throw error;
    }
  }

  /**
   * Mark a delivery as failed
   */
  async markFailed(deliveryId: string, reason: string): Promise<void> {
    try {
      const delivery = this.deliveries.get(deliveryId);
      if (!delivery) {
        logger.warn(`Delivery ${deliveryId} not found when marking as failed`);
        return;
      }

      delivery.status = DeliveryStatus.FAILED;
      delivery.failureReason = reason;
      
      logger.debug(`Marked delivery ${deliveryId} as failed: ${reason}`);
    } catch (error) {
      logger.error(`Error marking delivery ${deliveryId} as failed:`, error);
      throw error;
    }
  }

  /**
   * Schedule a delivery for retry
   */
  async scheduleRetry(deliveryId: string, retryAt: Date): Promise<void> {
    try {
      const delivery = this.deliveries.get(deliveryId);
      if (!delivery) {
        logger.warn(`Delivery ${deliveryId} not found when scheduling retry`);
        return;
      }

      delivery.status = DeliveryStatus.RETRYING;
      delivery.scheduledAt = retryAt;
      
      // Add back to queue for retry
      await this.add(delivery);
      
      logger.debug(`Scheduled delivery ${deliveryId} for retry at ${retryAt.toISOString()}`);
    } catch (error) {
      logger.error(`Error scheduling retry for delivery ${deliveryId}:`, error);
      throw error;
    }
  }

  /**
   * Get count of pending deliveries
   */
  async getPendingCount(): Promise<number> {
    try {
      return this.queue.filter(d => 
        d.status === DeliveryStatus.PENDING || 
        d.status === DeliveryStatus.RETRYING
      ).length;
    } catch (error) {
      logger.error('Error getting pending count:', error);
      throw error;
    }
  }

  /**
   * Clean up old completed deliveries
   */
  async cleanup(): Promise<void> {
    try {
      const now = new Date();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      let cleanedCount = 0;

      // Clean up old deliveries from the map
      for (const [id, delivery] of this.deliveries) {
        const age = now.getTime() - delivery.scheduledAt.getTime();
        
        if (age > maxAge && (
          delivery.status === DeliveryStatus.DELIVERED ||
          delivery.status === DeliveryStatus.FAILED ||
          delivery.status === DeliveryStatus.EXPIRED
        )) {
          this.deliveries.delete(id);
          cleanedCount++;
        }
      }

      // Clean up old deliveries from the queue
      this.queue = this.queue.filter(delivery => {
        const age = now.getTime() - delivery.scheduledAt.getTime();
        return age <= maxAge || (
          delivery.status !== DeliveryStatus.DELIVERED &&
          delivery.status !== DeliveryStatus.FAILED &&
          delivery.status !== DeliveryStatus.EXPIRED
        );
      });

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old deliveries`);
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalDeliveries: number;
    queueSize: number;
    statusCounts: Record<DeliveryStatus, number>;
    priorityCounts: Record<NotificationPriority, number>;
  } {
    try {
      const statusCounts = Object.values(DeliveryStatus).reduce((acc, status) => {
        acc[status] = 0;
        return acc;
      }, {} as Record<DeliveryStatus, number>);

      const priorityCounts = Object.values(NotificationPriority).reduce((acc, priority) => {
        if (typeof priority === 'number') {
          acc[priority] = 0;
        }
        return acc;
      }, {} as Record<NotificationPriority, number>);

      for (const delivery of this.deliveries.values()) {
        statusCounts[delivery.status]++;
        priorityCounts[delivery.priority]++;
      }

      return {
        totalDeliveries: this.deliveries.size,
        queueSize: this.queue.length,
        statusCounts,
        priorityCounts
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return {
        totalDeliveries: 0,
        queueSize: 0,
        statusCounts: {} as Record<DeliveryStatus, number>,
        priorityCounts: {} as Record<NotificationPriority, number>
      };
    }
  }

  /**
   * Clear all deliveries (for testing)
   */
  async clear(): Promise<void> {
    this.queue = [];
    this.deliveries.clear();
    logger.debug('Cleared notification queue');
  }
}
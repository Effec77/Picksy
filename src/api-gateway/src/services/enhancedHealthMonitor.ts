import { ServiceHealthMonitor, ServiceHealth, ServiceStatus, SystemHealth } from './serviceHealthMonitor.js';
import { logger } from '../utils/logger.js';
import { ErrorHandlingService } from './errorHandling.js';

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface HealthAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  autoResolved: boolean;
}

export interface AutomatedResponse {
  trigger: string;
  action: string;
  description: string;
  executed: boolean;
  executedAt?: Date;
  success?: boolean;
  error?: string;
}

export class EnhancedHealthMonitor extends ServiceHealthMonitor {
  private performanceMetrics = new Map<string, PerformanceMetrics[]>();
  private activeAlerts = new Map<string, HealthAlert>();
  private automatedResponses: AutomatedResponse[] = [];
  private errorService = ErrorHandlingService.getInstance();
  private metricsRetentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
  private alertThresholds = {
    responseTime: 5000, // 5 seconds
    errorRate: 0.05, // 5%
    memoryUsage: 0.85, // 85%
    cpuUsage: 0.80 // 80%
  };

  /**
   * Enhanced health check with performance monitoring
   */
  async checkServiceHealthWithMetrics(serviceName: string): Promise<ServiceHealth | null> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    
    try {
      // Run standard health check
      const health = await this.checkServiceHealth(serviceName);
      
      if (health) {
        // Collect performance metrics
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const finalMemory = process.memoryUsage();
        
        const metrics: PerformanceMetrics = {
          responseTime,
          throughput: this.calculateThroughput(serviceName),
          errorRate: this.calculateErrorRate(serviceName),
          memoryUsage: finalMemory.heapUsed / finalMemory.heapTotal,
          cpuUsage: await this.getCpuUsage()
        };

        // Store metrics
        this.storeMetrics(serviceName, metrics);
        
        // Check for performance issues
        await this.analyzePerformanceMetrics(serviceName, metrics);
        
        return health;
      }
      
      return null;
    } catch (error) {
      logger.error(`Enhanced health check failed for ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Store performance metrics with retention policy
   */
  private storeMetrics(serviceName: string, metrics: PerformanceMetrics): void {
    if (!this.performanceMetrics.has(serviceName)) {
      this.performanceMetrics.set(serviceName, []);
    }

    const serviceMetrics = this.performanceMetrics.get(serviceName)!;
    serviceMetrics.push({
      ...metrics,
      timestamp: Date.now()
    } as any);

    // Clean up old metrics
    const cutoffTime = Date.now() - this.metricsRetentionPeriod;
    const filteredMetrics = serviceMetrics.filter(
      (m: any) => m.timestamp > cutoffTime
    );
    
    this.performanceMetrics.set(serviceName, filteredMetrics);
  }

  /**
   * Analyze performance metrics and trigger alerts
   */
  private async analyzePerformanceMetrics(
    serviceName: string, 
    metrics: PerformanceMetrics
  ): Promise<void> {
    const alerts: HealthAlert[] = [];

    // Check response time
    if (metrics.responseTime > this.alertThresholds.responseTime) {
      alerts.push(this.createAlert(
        serviceName,
        'high',
        `High response time: ${metrics.responseTime}ms (threshold: ${this.alertThresholds.responseTime}ms)`
      ));
    }

    // Check error rate
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      alerts.push(this.createAlert(
        serviceName,
        'critical',
        `High error rate: ${(metrics.errorRate * 100).toFixed(2)}% (threshold: ${(this.alertThresholds.errorRate * 100).toFixed(2)}%)`
      ));
    }

    // Check memory usage
    if (metrics.memoryUsage > this.alertThresholds.memoryUsage) {
      alerts.push(this.createAlert(
        serviceName,
        'medium',
        `High memory usage: ${(metrics.memoryUsage * 100).toFixed(2)}% (threshold: ${(this.alertThresholds.memoryUsage * 100).toFixed(2)}%)`
      ));
    }

    // Check CPU usage
    if (metrics.cpuUsage > this.alertThresholds.cpuUsage) {
      alerts.push(this.createAlert(
        serviceName,
        'medium',
        `High CPU usage: ${(metrics.cpuUsage * 100).toFixed(2)}% (threshold: ${(this.alertThresholds.cpuUsage * 100).toFixed(2)}%)`
      ));
    }

    // Process alerts and trigger automated responses
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Create a health alert
   */
  private createAlert(
    service: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string
  ): HealthAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      service,
      message,
      timestamp: new Date(),
      resolved: false,
      autoResolved: false
    };
  }

  /**
   * Process alert and trigger automated responses
   */
  private async processAlert(alert: HealthAlert): Promise<void> {
    // Store alert
    this.activeAlerts.set(alert.id, alert);
    
    logger.warn(`Health alert: ${alert.service} - ${alert.message}`, {
      alertId: alert.id,
      severity: alert.severity
    });

    // Trigger automated responses based on alert type
    await this.triggerAutomatedResponse(alert);
    
    // Escalate critical alerts
    if (alert.severity === 'critical') {
      await this.escalateCriticalAlert(alert);
    }
  }

  /**
   * Trigger automated response based on alert
   */
  private async triggerAutomatedResponse(alert: HealthAlert): Promise<void> {
    const responses: AutomatedResponse[] = [];

    switch (alert.service) {
      case 'database':
        if (alert.message.includes('High response time')) {
          responses.push({
            trigger: alert.id,
            action: 'restart_connection_pool',
            description: 'Restart database connection pool to improve performance',
            executed: false
          });
        }
        if (alert.message.includes('High error rate')) {
          responses.push({
            trigger: alert.id,
            action: 'enable_read_only_mode',
            description: 'Enable read-only mode to reduce database load',
            executed: false
          });
        }
        break;

      case 'external-api':
        if (alert.message.includes('High error rate')) {
          responses.push({
            trigger: alert.id,
            action: 'enable_cache_fallback',
            description: 'Enable cached data fallback for external API failures',
            executed: false
          });
        }
        break;

      case 'notification-service':
        if (alert.message.includes('High response time')) {
          responses.push({
            trigger: alert.id,
            action: 'switch_notification_provider',
            description: 'Switch to backup notification provider',
            executed: false
          });
        }
        break;

      default:
        responses.push({
          trigger: alert.id,
          action: 'restart_service',
          description: `Restart ${alert.service} to resolve issues`,
          executed: false
        });
    }

    // Execute automated responses
    for (const response of responses) {
      await this.executeAutomatedResponse(response);
      this.automatedResponses.push(response);
    }
  }

  /**
   * Execute automated response
   */
  private async executeAutomatedResponse(response: AutomatedResponse): Promise<void> {
    try {
      logger.info(`Executing automated response: ${response.action}`, {
        trigger: response.trigger,
        description: response.description
      });

      response.executed = true;
      response.executedAt = new Date();

      // Simulate automated response execution
      switch (response.action) {
        case 'restart_connection_pool':
          await this.restartConnectionPool();
          break;
        case 'enable_read_only_mode':
          await this.enableReadOnlyMode();
          break;
        case 'enable_cache_fallback':
          await this.enableCacheFallback();
          break;
        case 'switch_notification_provider':
          await this.switchNotificationProvider();
          break;
        case 'restart_service':
          await this.restartService(response.trigger);
          break;
        default:
          throw new Error(`Unknown automated response: ${response.action}`);
      }

      response.success = true;
      logger.info(`Automated response executed successfully: ${response.action}`);
    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Automated response failed: ${response.action}`, error);
    }
  }

  /**
   * Escalate critical alerts
   */
  private async escalateCriticalAlert(alert: HealthAlert): Promise<void> {
    logger.error(`CRITICAL ALERT: ${alert.service} - ${alert.message}`, {
      alertId: alert.id,
      timestamp: alert.timestamp
    });

    // In a real implementation, this would:
    // 1. Send notifications to on-call engineers
    // 2. Create incident tickets
    // 3. Trigger emergency procedures
    // 4. Update status page
  }

  /**
   * Calculate throughput for a service
   */
  private calculateThroughput(serviceName: string): number {
    // In a real implementation, this would calculate requests per second
    // For now, return a mock value
    return Math.random() * 100;
  }

  /**
   * Calculate error rate for a service
   */
  private calculateErrorRate(serviceName: string): number {
    const errorStats = this.errorService.getErrorStats();
    const serviceErrors = Object.entries(errorStats)
      .filter(([key]) => key.includes(serviceName))
      .reduce((sum, [, count]) => sum + count, 0);
    
    // Calculate error rate based on total requests (mock calculation)
    const totalRequests = Math.max(1, serviceErrors * 20); // Assume 5% error rate baseline
    return serviceErrors / totalRequests;
  }

  /**
   * Get CPU usage
   */
  private async getCpuUsage(): Promise<number> {
    // In a real implementation, this would measure actual CPU usage
    // For now, return a mock value based on system load
    return Math.random() * 0.5; // 0-50% CPU usage
  }

  /**
   * Get performance metrics for a service
   */
  getPerformanceMetrics(serviceName: string): PerformanceMetrics[] {
    return this.performanceMetrics.get(serviceName) || [];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get automated response history
   */
  getAutomatedResponses(): AutomatedResponse[] {
    return [...this.automatedResponses];
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, autoResolved: boolean = false): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      alert.autoResolved = autoResolved;
      
      logger.info(`Alert resolved: ${alertId}`, {
        service: alert.service,
        autoResolved
      });
      
      return true;
    }
    return false;
  }

  /**
   * Get comprehensive system health report
   */
  getComprehensiveHealthReport(): {
    systemHealth: SystemHealth;
    performanceMetrics: Record<string, PerformanceMetrics[]>;
    activeAlerts: HealthAlert[];
    automatedResponses: AutomatedResponse[];
    uptimeStats: Record<string, { uptime: number; availability: number }>;
  } {
    return {
      systemHealth: this.getSystemHealth(),
      performanceMetrics: Object.fromEntries(this.performanceMetrics),
      activeAlerts: this.getActiveAlerts(),
      automatedResponses: this.getAutomatedResponses(),
      uptimeStats: this.getUptimeStats()
    };
  }

  // Automated response implementations (mock)
  private async restartConnectionPool(): Promise<void> {
    logger.info('Restarting database connection pool...');
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async enableReadOnlyMode(): Promise<void> {
    logger.info('Enabling read-only mode...');
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async enableCacheFallback(): Promise<void> {
    logger.info('Enabling cache fallback...');
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async switchNotificationProvider(): Promise<void> {
    logger.info('Switching to backup notification provider...');
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  private async restartService(trigger: string): Promise<void> {
    logger.info(`Restarting service for trigger: ${trigger}...`);
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
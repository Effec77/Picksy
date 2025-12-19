import { logger } from '../utils/logger';
import { NotificationEngine } from './notificationEngine';
import { NotificationProvider } from './notificationEngine';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  lastCheck: Date;
  responseTime?: number;
  errorMessage?: string;
  uptime: number;
  consecutiveFailures: number;
}

export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export interface ServiceDependency {
  name: string;
  healthCheck: () => Promise<boolean>;
  critical: boolean;
  timeout: number;
}

export interface SystemHealth {
  overall: ServiceStatus;
  services: ServiceHealth[];
  degradedFeatures: string[];
  timestamp: Date;
}

export class ServiceHealthMonitor {
  private services = new Map<string, ServiceHealth>();
  private dependencies = new Map<string, ServiceDependency>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly checkInterval = 30000; // 30 seconds
  private readonly failureThreshold = 3;
  private readonly degradationThreshold = 2;
  private notificationEngine?: NotificationEngine;

  /**
   * Register a service dependency for monitoring
   */
  registerService(dependency: ServiceDependency): void {
    this.dependencies.set(dependency.name, dependency);
    
    // Initialize health status
    this.services.set(dependency.name, {
      name: dependency.name,
      status: ServiceStatus.UNKNOWN,
      lastCheck: new Date(),
      uptime: 0,
      consecutiveFailures: 0
    });

    logger.info(`Registered service for monitoring: ${dependency.name}`);
  }

  /**
   * Set notification engine for alerting
   */
  setNotificationEngine(engine: NotificationEngine): void {
    this.notificationEngine = engine;
  }

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    if (this.monitoringInterval) {
      logger.warn('Health monitoring is already running');
      return;
    }

    // Initial health check
    await this.checkAllServices();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.checkAllServices();
    }, this.checkInterval);

    logger.info('Service health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Service health monitoring stopped');
  }

  /**
   * Check health of all registered services
   */
  private async checkAllServices(): Promise<void> {
    const checkPromises = Array.from(this.dependencies.entries()).map(
      ([name, dependency]) => this.checkService(name, dependency)
    );

    await Promise.allSettled(checkPromises);
    await this.updateSystemStatus();
  }

  /**
   * Check health of a specific service
   */
  private async checkService(name: string, dependency: ServiceDependency): Promise<void> {
    const startTime = Date.now();
    const service = this.services.get(name)!;
    
    try {
      // Run health check with timeout
      const healthCheckPromise = dependency.healthCheck();
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), dependency.timeout);
      });

      const isHealthy = await Promise.race([healthCheckPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        // Service is healthy
        service.consecutiveFailures = 0;
        service.status = ServiceStatus.HEALTHY;
        service.uptime += this.checkInterval;
        service.errorMessage = undefined;
      } else {
        // Service failed health check
        service.consecutiveFailures++;
        service.status = this.determineStatusFromFailures(service.consecutiveFailures, dependency.critical);
        service.errorMessage = 'Health check returned false';
        service.uptime = 0;
      }

      service.responseTime = responseTime;
      service.lastCheck = new Date();

      logger.debug(`Health check for ${name}: ${service.status} (${responseTime}ms)`);
    } catch (error) {
      // Health check failed with error
      const responseTime = Date.now() - startTime;
      service.consecutiveFailures++;
      service.status = this.determineStatusFromFailures(service.consecutiveFailures, dependency.critical);
      service.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      service.responseTime = responseTime;
      service.lastCheck = new Date();
      service.uptime = 0;

      logger.warn(`Health check failed for ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine service status based on consecutive failures
   */
  private determineStatusFromFailures(failures: number, critical: boolean): ServiceStatus {
    if (failures >= this.failureThreshold) {
      return ServiceStatus.UNHEALTHY;
    } else if (failures >= this.degradationThreshold) {
      return ServiceStatus.DEGRADED;
    }
    return ServiceStatus.HEALTHY;
  }

  /**
   * Update overall system status and handle degradation
   */
  private async updateSystemStatus(): Promise<void> {
    const services = Array.from(this.services.values());
    const criticalServices = services.filter(s => {
      const dependency = this.dependencies.get(s.name);
      return dependency?.critical;
    });

    // Determine overall status
    let overallStatus = ServiceStatus.HEALTHY;
    const degradedFeatures: string[] = [];

    // Check critical services
    const unhealthyCritical = criticalServices.filter(s => s.status === ServiceStatus.UNHEALTHY);
    const degradedCritical = criticalServices.filter(s => s.status === ServiceStatus.DEGRADED);

    if (unhealthyCritical.length > 0) {
      overallStatus = ServiceStatus.UNHEALTHY;
      degradedFeatures.push('Core functionality may be unavailable');
    } else if (degradedCritical.length > 0) {
      overallStatus = ServiceStatus.DEGRADED;
      degradedFeatures.push('Some features may be slower than usual');
    }

    // Check non-critical services
    const unhealthyNonCritical = services.filter(s => {
      const dependency = this.dependencies.get(s.name);
      return !dependency?.critical && s.status === ServiceStatus.UNHEALTHY;
    });

    if (unhealthyNonCritical.length > 0) {
      if (overallStatus === ServiceStatus.HEALTHY) {
        overallStatus = ServiceStatus.DEGRADED;
      }
      degradedFeatures.push(...unhealthyNonCritical.map(s => `${s.name} unavailable`));
    }

    // Handle service degradation
    await this.handleServiceDegradation(overallStatus, degradedFeatures);
  }

  /**
   * Handle service degradation by implementing fallbacks
   */
  private async handleServiceDegradation(status: ServiceStatus, degradedFeatures: string[]): Promise<void> {
    if (status === ServiceStatus.HEALTHY) {
      return; // No degradation to handle
    }

    logger.warn(`System status: ${status}, degraded features: ${degradedFeatures.join(', ')}`);

    // Implement specific degradation strategies
    for (const [serviceName, service] of this.services) {
      if (service.status === ServiceStatus.UNHEALTHY || service.status === ServiceStatus.DEGRADED) {
        await this.implementServiceFallback(serviceName, service);
      }
    }

    // Notify users about service issues if notification engine is available
    if (this.notificationEngine && status === ServiceStatus.UNHEALTHY) {
      await this.notifyServiceIssues(degradedFeatures);
    }
  }

  /**
   * Implement fallback strategies for specific services
   */
  private async implementServiceFallback(serviceName: string, service: ServiceHealth): Promise<void> {
    switch (serviceName) {
      case 'database':
        logger.info('Implementing database fallback: using cached data');
        // In real implementation: switch to read-only mode, use cached data
        break;

      case 'external-api':
        logger.info('Implementing external API fallback: using cached prices');
        // In real implementation: use cached price data, disable real-time updates
        break;

      case 'notification-service':
        logger.info('Implementing notification fallback: queuing notifications');
        // In real implementation: queue notifications for later delivery
        break;

      case 'email-service':
        logger.info('Implementing email fallback: using alternative provider');
        // In real implementation: switch to backup email provider
        break;

      default:
        logger.warn(`No fallback strategy defined for service: ${serviceName}`);
    }
  }

  /**
   * Notify users about service issues
   */
  private async notifyServiceIssues(degradedFeatures: string[]): Promise<void> {
    try {
      // In real implementation, this would send system-wide notifications
      logger.info(`Would notify users about service issues: ${degradedFeatures.join(', ')}`);
    } catch (error) {
      logger.error('Failed to notify users about service issues:', error);
    }
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): SystemHealth {
    const services = Array.from(this.services.values());
    const criticalServices = services.filter(s => {
      const dependency = this.dependencies.get(s.name);
      return dependency?.critical;
    });

    // Determine overall status
    let overallStatus = ServiceStatus.HEALTHY;
    const degradedFeatures: string[] = [];

    const unhealthyCritical = criticalServices.filter(s => s.status === ServiceStatus.UNHEALTHY);
    const degradedCritical = criticalServices.filter(s => s.status === ServiceStatus.DEGRADED);

    if (unhealthyCritical.length > 0) {
      overallStatus = ServiceStatus.UNHEALTHY;
      degradedFeatures.push('Core functionality may be unavailable');
    } else if (degradedCritical.length > 0) {
      overallStatus = ServiceStatus.DEGRADED;
      degradedFeatures.push('Some features may be slower than usual');
    }

    const unhealthyNonCritical = services.filter(s => {
      const dependency = this.dependencies.get(s.name);
      return !dependency?.critical && s.status === ServiceStatus.UNHEALTHY;
    });

    if (unhealthyNonCritical.length > 0) {
      if (overallStatus === ServiceStatus.HEALTHY) {
        overallStatus = ServiceStatus.DEGRADED;
      }
      degradedFeatures.push(...unhealthyNonCritical.map(s => `${s.name} unavailable`));
    }

    return {
      overall: overallStatus,
      services: [...services],
      degradedFeatures,
      timestamp: new Date()
    };
  }

  /**
   * Get health status for a specific service
   */
  getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.services.get(serviceName) || null;
  }

  /**
   * Force a health check for a specific service
   */
  async checkServiceHealth(serviceName: string): Promise<ServiceHealth | null> {
    const dependency = this.dependencies.get(serviceName);
    if (!dependency) {
      logger.warn(`Service ${serviceName} not registered for monitoring`);
      return null;
    }

    await this.checkService(serviceName, dependency);
    return this.services.get(serviceName) || null;
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats(): Record<string, { uptime: number; availability: number }> {
    const stats: Record<string, { uptime: number; availability: number }> = {};
    
    for (const [name, service] of this.services) {
      const totalTime = Date.now() - (service.lastCheck.getTime() - service.uptime);
      const availability = totalTime > 0 ? (service.uptime / totalTime) * 100 : 0;
      
      stats[name] = {
        uptime: service.uptime,
        availability: Math.min(100, Math.max(0, availability))
      };
    }

    return stats;
  }
}
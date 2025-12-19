#!/usr/bin/env node

/**
 * Health Check Script for Production Monitoring
 * 
 * Performs comprehensive health checks on the API Gateway
 * and reports system status for monitoring and alerting.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class HealthChecker {
  constructor(config) {
    this.config = {
      baseUrl: process.env.TEST_URL || 'http://localhost:3000',
      apiKey: process.env.API_KEY || '',
      timeout: 30000,
      retries: 3,
      ...config
    };
    
    this.results = {
      overall: 'unknown',
      checks: [],
      timestamp: new Date().toISOString(),
      duration: 0
    };
  }

  async runHealthChecks() {
    const startTime = Date.now();
    
    console.log('🏥 Starting health checks...');
    console.log(`Target: ${this.config.baseUrl}`);
    
    try {
      // Core health checks
      await this.checkApiHealth();
      await this.checkDatabaseHealth();
      await this.checkRedisHealth();
      await this.checkExternalServices();
      await this.checkPerformance();
      
      // Determine overall health
      this.determineOverallHealth();
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      this.results.overall = 'unhealthy';
      this.results.error = error.message;
    }
    
    this.results.duration = Date.now() - startTime;
    
    // Output results
    this.outputResults();
    
    // Exit with appropriate code
    process.exit(this.results.overall === 'healthy' ? 0 : 1);
  }

  async checkApiHealth() {
    console.log('🔍 Checking API health...');
    
    try {
      const response = await this.makeRequest('/api/health');
      
      this.results.checks.push({
        name: 'API Health',
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime: response.responseTime,
        details: {
          statusCode: response.status,
          version: response.data?.version,
          uptime: response.data?.uptime
        }
      });
      
      console.log(`✅ API Health: ${response.status} (${response.responseTime}ms)`);
      
    } catch (error) {
      this.results.checks.push({
        name: 'API Health',
        status: 'unhealthy',
        error: error.message
      });
      
      console.log(`❌ API Health: ${error.message}`);
    }
  }

  async checkDatabaseHealth() {
    console.log('🔍 Checking database health...');
    
    try {
      const response = await this.makeRequest('/api/health/database');
      
      this.results.checks.push({
        name: 'Database',
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime: response.responseTime,
        details: {
          connectionPool: response.data?.connectionPool,
          activeConnections: response.data?.activeConnections,
          queryTime: response.data?.queryTime
        }
      });
      
      console.log(`✅ Database: ${response.status} (${response.responseTime}ms)`);
      
    } catch (error) {
      this.results.checks.push({
        name: 'Database',
        status: 'unhealthy',
        error: error.message
      });
      
      console.log(`❌ Database: ${error.message}`);
    }
  }

  async checkRedisHealth() {
    console.log('🔍 Checking Redis health...');
    
    try {
      const response = await this.makeRequest('/api/health/redis');
      
      this.results.checks.push({
        name: 'Redis',
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime: response.responseTime,
        details: {
          connected: response.data?.connected,
          memory: response.data?.memory,
          keyCount: response.data?.keyCount
        }
      });
      
      console.log(`✅ Redis: ${response.status} (${response.responseTime}ms)`);
      
    } catch (error) {
      this.results.checks.push({
        name: 'Redis',
        status: 'unhealthy',
        error: error.message
      });
      
      console.log(`❌ Redis: ${error.message}`);
    }
  }

  async checkExternalServices() {
    console.log('🔍 Checking external services...');
    
    const services = [
      { name: 'Amazon API', endpoint: '/api/health/external/amazon' },
      { name: 'Email Service', endpoint: '/api/health/external/email' },
      { name: 'Notification Service', endpoint: '/api/health/external/notifications' }
    ];
    
    for (const service of services) {
      try {
        const response = await this.makeRequest(service.endpoint);
        
        this.results.checks.push({
          name: service.name,
          status: response.status === 200 ? 'healthy' : 'degraded',
          responseTime: response.responseTime,
          details: response.data
        });
        
        console.log(`✅ ${service.name}: ${response.status} (${response.responseTime}ms)`);
        
      } catch (error) {
        this.results.checks.push({
          name: service.name,
          status: 'unhealthy',
          error: error.message
        });
        
        console.log(`⚠️  ${service.name}: ${error.message}`);
      }
    }
  }

  async checkPerformance() {
    console.log('🔍 Checking performance...');
    
    try {
      // Test a typical API endpoint
      const testEndpoint = '/api/products?limit=10';
      const response = await this.makeRequest(testEndpoint);
      
      const performanceStatus = response.responseTime < 1000 ? 'healthy' : 
                              response.responseTime < 3000 ? 'degraded' : 'unhealthy';
      
      this.results.checks.push({
        name: 'Performance',
        status: performanceStatus,
        responseTime: response.responseTime,
        details: {
          endpoint: testEndpoint,
          threshold: '1000ms',
          actual: `${response.responseTime}ms`
        }
      });
      
      console.log(`✅ Performance: ${response.responseTime}ms`);
      
    } catch (error) {
      this.results.checks.push({
        name: 'Performance',
        status: 'unhealthy',
        error: error.message
      });
      
      console.log(`❌ Performance: ${error.message}`);
    }
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.config.baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'Picksy-HealthCheck/1.0',
          'Accept': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
          ...options.headers
        }
      };
      
      const startTime = Date.now();
      
      const req = client.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          let parsedData = null;
          try {
            parsedData = JSON.parse(data);
          } catch (e) {
            // Response is not JSON, that's okay
          }
          
          resolve({
            status: res.statusCode,
            responseTime,
            data: parsedData,
            headers: res.headers
          });
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.config.timeout}ms`));
      });
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  determineOverallHealth() {
    const healthyCount = this.results.checks.filter(c => c.status === 'healthy').length;
    const degradedCount = this.results.checks.filter(c => c.status === 'degraded').length;
    const unhealthyCount = this.results.checks.filter(c => c.status === 'unhealthy').length;
    
    if (unhealthyCount > 0) {
      // Any unhealthy check makes the system unhealthy
      this.results.overall = 'unhealthy';
    } else if (degradedCount > 0) {
      // Degraded services make the system degraded
      this.results.overall = 'degraded';
    } else if (healthyCount === this.results.checks.length) {
      // All checks healthy
      this.results.overall = 'healthy';
    } else {
      // Unknown state
      this.results.overall = 'unknown';
    }
  }

  outputResults() {
    console.log('\n📊 Health Check Results:');
    console.log('========================');
    console.log(`Overall Status: ${this.getStatusEmoji(this.results.overall)} ${this.results.overall.toUpperCase()}`);
    console.log(`Duration: ${this.results.duration}ms`);
    console.log(`Timestamp: ${this.results.timestamp}`);
    
    console.log('\nDetailed Results:');
    this.results.checks.forEach(check => {
      const emoji = this.getStatusEmoji(check.status);
      const responseTime = check.responseTime ? ` (${check.responseTime}ms)` : '';
      console.log(`  ${emoji} ${check.name}: ${check.status.toUpperCase()}${responseTime}`);
      
      if (check.error) {
        console.log(`    Error: ${check.error}`);
      }
      
      if (check.details) {
        Object.entries(check.details).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
        });
      }
    });
    
    // Output JSON for monitoring systems
    if (process.env.OUTPUT_JSON) {
      console.log('\n' + JSON.stringify(this.results, null, 2));
    }
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  }
}

// Run health checks if this script is executed directly
if (require.main === module) {
  const healthChecker = new HealthChecker();
  healthChecker.runHealthChecks().catch(error => {
    console.error('Health check script failed:', error);
    process.exit(1);
  });
}

module.exports = HealthChecker;
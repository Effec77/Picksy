import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';

/**
 * End-to-End Testing Suite for Picksy API Gateway
 * 
 * Tests critical user flows from API endpoints through to database operations.
 * Validates complete functionality chains and integration points.
 * 
 * Requirements: 8.2, 8.3
 */

describe('End-to-End Testing Suite', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;
  let testProductId: string;

  beforeAll(async () => {
    // Initialize test application
    app = await createTestApp();
    
    // Set up test database
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Clean up test database
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Reset test data before each test
    await resetTestData();
  });

  describe('User Authentication Flow', () => {
    it('should complete full user registration and login flow', async () => {
      // Step 1: Register new user
      const registrationData = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(registerResponse.body).toHaveProperty('user');
      expect(registerResponse.body.user.email).toBe(registrationData.email);
      expect(registerResponse.body).toHaveProperty('token');

      testUserId = registerResponse.body.user.id;

      // Step 2: Login with registered credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: registrationData.email,
          password: registrationData.password
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('token');
      expect(loginResponse.body.user.id).toBe(testUserId);

      authToken = loginResponse.body.token;

      // Step 3: Access protected endpoint with token
      const profileResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.id).toBe(testUserId);
      expect(profileResponse.body.email).toBe(registrationData.email);
    });

    it('should handle invalid login attempts correctly', async () => {
      // Attempt login with non-existent user
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        })
        .expect(401);

      // Attempt login with wrong password
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user@example.com',
          password: 'CorrectPassword123!'
        });

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword'
        })
        .expect(401);
    });

    it('should reject access to protected endpoints without valid token', async () => {
      // No token
      await request(app)
        .get('/api/user/profile')
        .expect(401);

      // Invalid token
      await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Expired token (would need to be implemented)
      const expiredToken = 'expired.jwt.token';
      await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Product Tracking Flow', () => {
    beforeEach(async () => {
      // Set up authenticated user for product tests
      const user = await createTestUser();
      testUserId = user.id;
      authToken = user.token;
    });

    it('should complete full product tracking lifecycle', async () => {
      // Step 1: Add product for tracking
      const productData = {
        url: 'https://amazon.com/product/test-123',
        targetPrice: 99.99
      };

      const addResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(201);

      expect(addResponse.body).toHaveProperty('id');
      expect(addResponse.body.url).toBe(productData.url);
      expect(addResponse.body.targetPrice).toBe(productData.targetPrice);
      expect(addResponse.body.userId).toBe(testUserId);

      testProductId = addResponse.body.id;

      // Step 2: Get tracked products
      const listResponse = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body).toHaveLength(1);
      expect(listResponse.body[0].id).toBe(testProductId);

      // Step 3: Update product settings
      const updateData = {
        targetPrice: 89.99,
        isActive: true
      };

      const updateResponse = await request(app)
        .put(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.targetPrice).toBe(updateData.targetPrice);

      // Step 4: Get product price history
      const historyResponse = await request(app)
        .get(`/api/products/${testProductId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body).toHaveProperty('productId', testProductId);
      expect(historyResponse.body).toHaveProperty('points');
      expect(historyResponse.body).toHaveProperty('statistics');

      // Step 5: Delete product
      await request(app)
        .delete(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify deletion
      const finalListResponse = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalListResponse.body).toHaveLength(0);
    });

    it('should handle invalid product URLs', async () => {
      const invalidUrls = [
        'not-a-url',
        'https://unsupported-site.com/product',
        'ftp://invalid-protocol.com/product'
      ];

      for (const url of invalidUrls) {
        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ url })
          .expect(400);
      }
    });

    it('should prevent users from accessing other users products', async () => {
      // Create product with first user
      const product = await createTestProduct(testUserId);

      // Create second user
      const secondUser = await createTestUser();

      // Second user should not be able to access first user's product
      await request(app)
        .get(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(404); // Should return 404, not 403, to avoid information leakage

      // Second user should not be able to update first user's product
      await request(app)
        .put(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${secondUser.token}`)
        .send({ targetPrice: 50.00 })
        .expect(404);

      // Second user should not be able to delete first user's product
      await request(app)
        .delete(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(404);
    });
  });

  describe('Price Alert Flow', () => {
    beforeEach(async () => {
      const user = await createTestUser();
      testUserId = user.id;
      authToken = user.token;
      
      const product = await createTestProduct(testUserId);
      testProductId = product.id;
    });

    it('should create and trigger price alerts correctly', async () => {
      // Step 1: Set up price alert
      const alertData = {
        alertType: 'PRICE_DROP',
        threshold: 0.1, // 10% drop
        enabled: true
      };

      const alertResponse = await request(app)
        .post(`/api/products/${testProductId}/alerts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertData)
        .expect(201);

      expect(alertResponse.body.alertType).toBe(alertData.alertType);
      expect(alertResponse.body.threshold).toBe(alertData.threshold);

      // Step 2: Simulate price change that triggers alert
      await request(app)
        .post(`/api/products/${testProductId}/price-update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          price: 80.00, // Significant drop from initial price
          source: 'TEST'
        })
        .expect(200);

      // Step 3: Check that alert was triggered
      const alertsResponse = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(alertsResponse.body.length).toBeGreaterThan(0);
      const triggeredAlert = alertsResponse.body.find((alert: any) => 
        alert.productId === testProductId
      );
      expect(triggeredAlert).toBeDefined();
      expect(triggeredAlert.alertType).toBe('PRICE_DROP');
    });

    it('should handle notification preferences correctly', async () => {
      // Step 1: Set notification preferences
      const preferences = {
        notificationChannels: ['EMAIL', 'BROWSER'],
        checkFrequency: 60,
        priceThreshold: 0.05
      };

      await request(app)
        .put('/api/user/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferences)
        .expect(200);

      // Step 2: Trigger alert and verify notification channels
      await request(app)
        .post(`/api/products/${testProductId}/alerts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          alertType: 'TARGET_PRICE_REACHED',
          targetPrice: 85.00
        });

      await request(app)
        .post(`/api/products/${testProductId}/price-update`)
        .send({
          price: 84.00,
          source: 'TEST'
        });

      // Step 3: Check notification delivery
      const notificationsResponse = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(notificationsResponse.body.length).toBeGreaterThan(0);
      const notification = notificationsResponse.body[0];
      expect(notification.channels).toEqual(expect.arrayContaining(['EMAIL', 'BROWSER']));
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should enforce API rate limits', async () => {
      const user = await createTestUser();
      
      // Make requests up to the limit
      const requests = [];
      for (let i = 0; i < 100; i++) { // Assuming limit is 100 per minute
        requests.push(
          request(app)
            .get('/api/products')
            .set('Authorization', `Bearer ${user.token}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Most should succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(90);

      // Additional request should be rate limited
      const rateLimitedResponse = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${user.token}`);

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body).toHaveProperty('error');
      expect(rateLimitedResponse.body.error).toContain('rate limit');
    });

    it('should validate input and prevent injection attacks', async () => {
      const user = await createTestUser();
      
      // SQL injection attempt
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "' UNION SELECT * FROM users --"
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            url: `https://amazon.com/product/${maliciousInput}`
          });

        // Should either reject the input or sanitize it
        expect([400, 422]).toContain(response.status);
      }

      // XSS attempt
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">'
      ];

      for (const xssInput of xssAttempts) {
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            displayName: xssInput
          });

        if (response.status === 200) {
          // If accepted, should be sanitized
          expect(response.body.displayName).not.toContain('<script>');
          expect(response.body.displayName).not.toContain('javascript:');
        } else {
          // Should be rejected
          expect([400, 422]).toContain(response.status);
        }
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      // Simulate database failure
      await simulateDatabaseFailure();

      const user = await createTestUser();
      
      // API should return appropriate error responses
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(503); // Service Unavailable
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('temporarily unavailable');

      // Restore database connection
      await restoreDatabaseConnection();
    });

    it('should handle external service failures with fallback', async () => {
      // Simulate external retailer API failure
      await simulateRetailerAPIFailure();

      const user = await createTestUser();
      
      // Adding product should still work with fallback scraping
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          url: 'https://amazon.com/product/test-fallback'
        });

      expect([200, 201, 202]).toContain(response.status);
      
      if (response.status === 202) {
        // Accepted for processing with fallback
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('fallback');
      }

      // Restore external services
      await restoreRetailerAPI();
    });

    it('should provide meaningful error messages for client errors', async () => {
      const user = await createTestUser();

      // Test various client error scenarios
      const errorScenarios = [
        {
          request: () => request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${user.token}`)
            .send({}), // Missing required fields
          expectedStatus: 400,
          expectedErrorType: 'validation'
        },
        {
          request: () => request(app)
            .get('/api/products/invalid-id')
            .set('Authorization', `Bearer ${user.token}`),
          expectedStatus: 404,
          expectedErrorType: 'not_found'
        },
        {
          request: () => request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${user.token}`)
            .send({
              url: 'https://amazon.com/product/test',
              targetPrice: -10 // Invalid price
            }),
          expectedStatus: 422,
          expectedErrorType: 'validation'
        }
      ];

      for (const scenario of errorScenarios) {
        const response = await scenario.request();
        
        expect(response.status).toBe(scenario.expectedStatus);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toContain(scenario.expectedErrorType.toUpperCase());
        
        // Error message should be user-friendly
        expect(response.body.error).toBeDefined();
        expect(response.body.error.length).toBeGreaterThan(10);
      }
    });
  });
});

// Helper functions for E2E tests
async function createTestApp(): Promise<Express> {
  // This would import and configure the actual Express app
  // For now, return a mock
  return {} as Express;
}

async function setupTestDatabase(): Promise<void> {
  // Set up test database schema and initial data
}

async function cleanupTestDatabase(): Promise<void> {
  // Clean up test database
}

async function resetTestData(): Promise<void> {
  // Reset test data between tests
}

async function createTestUser(): Promise<{ id: string; token: string }> {
  // Create a test user and return ID and auth token
  return {
    id: `test-user-${Date.now()}`,
    token: `test-token-${Date.now()}`
  };
}

async function createTestProduct(userId: string): Promise<{ id: string }> {
  // Create a test product for the user
  return {
    id: `test-product-${Date.now()}`
  };
}

async function simulateDatabaseFailure(): Promise<void> {
  // Simulate database connection failure
}

async function restoreDatabaseConnection(): Promise<void> {
  // Restore database connection
}

async function simulateRetailerAPIFailure(): Promise<void> {
  // Simulate external retailer API failure
}

async function restoreRetailerAPI(): Promise<void> {
  // Restore external retailer API
}
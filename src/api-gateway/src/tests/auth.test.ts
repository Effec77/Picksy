import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRole, ErrorCode } from '../types/index.js';

// Mock the modules before importing
vi.mock('../database/connection.js', () => ({
  db: {
    query: vi.fn().mockImplementation(async (text: string, params?: any[]) => {
      if (text.includes('INSERT INTO users')) {
        // Return the email from the params (which is params[1])
        const email = params?.[1] || 'test@example.com';
        return {
          rows: [{
            id: 'test-user-id',
            email: email,
            role: UserRole.USER,
            created_at: new Date(),
            updated_at: new Date(),
            is_active: true
          }]
        };
      }
      if (text.includes('SELECT') && text.includes('WHERE email')) {
        return { rows: [] }; // No existing user
      }
      return { rows: [] };
    })
  }
}));

vi.mock('../database/redis.js', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue('{"userId":"test-user-id","email":"test@example.com"}'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1)
  }
}));

// Import after mocking
import { AuthService } from '../services/auth.js';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('Token Generation and Validation', () => {
    it('should generate a valid JWT token', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      const token = await authService.generateToken(user);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should validate a valid token', async () => {
      const user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      const token = await authService.generateToken(user);
      const payload = await authService.validateToken(token);
      
      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(user.id);
      expect(payload?.email).toBe(user.email);
      expect(payload?.role).toBe(user.role);
    });

    it('should reject invalid tokens', async () => {
      const invalidToken = 'invalid.token.here';
      const payload = await authService.validateToken(invalidToken);
      expect(payload).toBeNull();
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await authService.verifyPassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('User Registration', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!'
      };

      const user = await authService.createUser(userData);
      
      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email.toLowerCase());
      expect(user.role).toBe(UserRole.USER);
      expect(user.isActive).toBe(true);
      expect(user.id).toBeDefined();
    });
  });
});
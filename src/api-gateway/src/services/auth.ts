import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';
import { redis } from '../database/redis.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { 
  User, 
  UserRole, 
  SubscriptionTier,
  AuthTokenPayload, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse,
  ErrorCode 
} from '../types/index.js';

export class AuthService {
  async generateToken(user: Omit<User, 'passwordHash'>): Promise<string> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscriptionTier
    };

    const token = jwt.sign(
      payload, 
      config.jwt.secret, 
      {
        expiresIn: '24h',
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      }
    ) as string;

    // Store token in Redis for session management
    const tokenKey = `auth:token:${user.id}:${token.slice(-8)}`;
    await redis.set(tokenKey, JSON.stringify({ userId: user.id, email: user.email }), 24 * 60 * 60); // 24 hours

    logger.info('JWT token generated', { userId: user.id, email: user.email });
    return token;
  }

  async validateToken(token: string): Promise<AuthTokenPayload | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      }) as AuthTokenPayload;

      // Check if token exists in Redis (for session management)
      const tokenKey = `auth:token:${decoded.userId}:${token.slice(-8)}`;
      const sessionData = await redis.get(tokenKey);
      
      if (!sessionData) {
        logger.warn('Token not found in session store', { userId: decoded.userId });
        return null;
      }

      return decoded;
    } catch (error) {
      logger.warn('Token validation failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as AuthTokenPayload;
      if (decoded && decoded.userId) {
        const tokenKey = `auth:token:${decoded.userId}:${token.slice(-8)}`;
        await redis.del(tokenKey);
        logger.info('Token revoked', { userId: decoded.userId });
      }
    } catch (error) {
      logger.error('Error revoking token', error);
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      // In a production system, you might want to maintain a list of active tokens per user
      // For now, we'll use a simple approach with a blacklist
      const blacklistKey = `auth:blacklist:${userId}`;
      await redis.set(blacklistKey, Date.now().toString(), 24 * 60 * 60); // 24 hours
      logger.info('All tokens revoked for user', { userId });
    } catch (error) {
      logger.error('Error revoking all user tokens', error);
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.bcrypt.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async createUser(userData: RegisterRequest): Promise<Omit<User, 'passwordHash'>> {
    const userId = uuidv4();
    const passwordHash = await this.hashPassword(userData.password);
    const now = new Date();

    const query = `
      INSERT INTO users (id, email, password_hash, role, subscription_tier, created_at, updated_at, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, role, subscription_tier, created_at, updated_at, is_active
    `;

    try {
      const result = await db.query(query, [
        userId,
        userData.email.toLowerCase(),
        passwordHash,
        UserRole.USER,
        SubscriptionTier.FREE,
        now,
        now,
        true
      ]);

      const user = result?.rows?.[0];
      if (!user) {
        throw new Error('Failed to create user');
      }
      logger.info('User created successfully', { userId, email: userData.email });
      
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isActive: user.is_active
      };
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        logger.warn('Attempt to create user with existing email', { email: userData.email });
        throw new Error(ErrorCode.EMAIL_ALREADY_EXISTS);
      }
      logger.error('Error creating user', error);
      throw new Error(ErrorCode.INTERNAL_ERROR);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, role, subscription_tier, created_at, updated_at, is_active
      FROM users 
      WHERE email = $1 AND is_active = true
    `;

    try {
      const result = await db.query(query, [email.toLowerCase()]);
      
      if (!result?.rows || result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        passwordHash: user.password_hash,
        role: user.role,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isActive: user.is_active
      };
    } catch (error) {
      logger.error('Error fetching user by email', error);
      throw new Error(ErrorCode.INTERNAL_ERROR);
    }
  }

  async getUserById(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    const query = `
      SELECT id, email, role, subscription_tier, created_at, updated_at, is_active
      FROM users 
      WHERE id = $1 AND is_active = true
    `;

    try {
      const result = await db.query(query, [userId]);
      
      if (!result?.rows || result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        isActive: user.is_active
      };
    } catch (error) {
      logger.error('Error fetching user by ID', error);
      throw new Error(ErrorCode.INTERNAL_ERROR);
    }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const user = await this.getUserByEmail(credentials.email);
    
    if (!user) {
      logger.warn('Login attempt with non-existent email', { email: credentials.email });
      throw new Error(ErrorCode.AUTHENTICATION_FAILED);
    }

    const isPasswordValid = await this.verifyPassword(credentials.password, user.passwordHash);
    
    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', { email: credentials.email });
      throw new Error(ErrorCode.AUTHENTICATION_FAILED);
    }

    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscriptionTier,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive
    };

    const token = await this.generateToken(userWithoutPassword);
    
    logger.info('User logged in successfully', { userId: user.id, email: user.email });
    
    return {
      token,
      user: userWithoutPassword,
      expiresIn: 24 * 60 * 60 // 24 hours in seconds
    };
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error(ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    const user = await this.createUser(userData);
    const token = await this.generateToken(user);
    
    return {
      token,
      user,
      expiresIn: 24 * 60 * 60 // 24 hours in seconds
    };
  }
}
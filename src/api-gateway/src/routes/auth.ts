import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.js';
import { validateBody } from '../validation/schemas.js';
import { loginSchema, registerSchema } from '../validation/schemas.js';
import { authRateLimit } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { ErrorCode } from '../types/index.js';

const router = Router();
const authService = new AuthService();

// Apply auth rate limiting to all auth routes
router.use(authRateLimit);

// User registration
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const authResponse = await authService.register(req.body);
    
    res.status(201).json({
      success: true,
      data: authResponse
    });
  } catch (error: any) {
    logger.error('Registration error', { error: error.message, email: req.body.email });
    
    if (error.message === ErrorCode.EMAIL_ALREADY_EXISTS) {
      return res.status(409).json({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message: 'An account with this email already exists'
      });
    }
    
    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Registration failed'
    });
  }
});

// User login
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const authResponse = await authService.login(req.body);
    
    res.json({
      success: true,
      data: authResponse
    });
  } catch (error: any) {
    logger.error('Login error', { error: error.message, email: req.body.email });
    
    if (error.message === ErrorCode.AUTHENTICATION_FAILED) {
      return res.status(401).json({
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Invalid email or password'
      });
    }
    
    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Login failed'
    });
  }
});

// Token validation (for client-side token checking)
router.get('/validate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await authService.getUserById(req.user!.userId);
    
    if (!user) {
      return res.status(404).json({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        user,
        valid: true
      }
    });
  } catch (error) {
    logger.error('Token validation error', error);
    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Token validation failed'
    });
  }
});

// User logout
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      await authService.revokeToken(token);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error', error);
    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Logout failed'
    });
  }
});

// Revoke all user sessions
router.post('/logout-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    await authService.revokeAllUserTokens(req.user!.userId);
    
    res.json({
      success: true,
      message: 'All sessions revoked successfully'
    });
  } catch (error) {
    logger.error('Logout all error', error);
    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to revoke all sessions'
    });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await authService.getUserById(req.user!.userId);
    
    if (!user) {
      return res.status(404).json({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get user profile error', error);
    res.status(500).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to get user profile'
    });
  }
});

export default router;
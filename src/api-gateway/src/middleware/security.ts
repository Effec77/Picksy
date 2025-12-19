import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// CORS configuration for browser extensions
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed patterns
    const allowedOrigins = config.cors.origin;
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern.includes('*')) {
        // Convert wildcard pattern to regex
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(origin);
      }
      return pattern === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn('CORS origin rejected', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
});

// Security headers using Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for browser extension compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Request sanitization middleware
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Remove potentially dangerous characters from query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Basic XSS prevention
        req.query[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    }
  }

  // Limit request body size (this should also be configured at the Express level)
  const contentLength = parseInt(req.get('content-length') || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body too large'
    });
  }

  next();
};

// Security monitoring middleware
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Log suspicious patterns
  const suspiciousPatterns = [
    { pattern: /\.\.\//g, name: 'Path Traversal' },
    { pattern: /<script/gi, name: 'XSS Attempt' },
    { pattern: /union\s+select/gi, name: 'SQL Injection' },
    { pattern: /exec\s*\(/gi, name: 'Code Execution' },
    { pattern: /javascript:/gi, name: 'JavaScript Protocol' },
    { pattern: /data:text\/html/gi, name: 'Data URI HTML' },
    { pattern: /vbscript:/gi, name: 'VBScript Protocol' },
    { pattern: /on\w+\s*=/gi, name: 'Event Handler Injection' }
  ];

  const requestData = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query,
    headers: req.headers
  });

  const detectedThreats: string[] = [];
  
  for (const { pattern, name } of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      detectedThreats.push(name);
      logger.warn('Security threat detected', {
        threatType: name,
        pattern: pattern.toString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Add threat information to request for potential blocking
  if (detectedThreats.length > 0) {
    (req as any).securityThreats = detectedThreats;
    
    // For high-risk patterns, consider blocking the request
    const highRiskPatterns = ['SQL Injection', 'Code Execution', 'Path Traversal'];
    const hasHighRiskThreat = detectedThreats.some(threat => highRiskPatterns.includes(threat));
    
    if (hasHighRiskThreat) {
      logger.error('High-risk security threat blocked', {
        threats: detectedThreats,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        userId: req.user?.userId
      });
      
      return res.status(403).json({
        code: 'SECURITY_VIOLATION',
        message: 'Request blocked due to security policy violation'
      });
    }
  }

  next();
};

// Enhanced request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded'))) {
      return res.status(400).json({
        code: 'INVALID_CONTENT_TYPE',
        message: 'Invalid or missing Content-Type header'
      });
    }
  }

  // Validate required headers for API requests
  if (req.path.startsWith('/api/')) {
    const userAgent = req.get('User-Agent');
    if (!userAgent) {
      logger.warn('Request without User-Agent header', {
        ip: req.ip,
        path: req.path
      });
    }
  }

  // Check for suspicious header patterns
  const suspiciousHeaders = ['X-Forwarded-For', 'X-Real-IP', 'X-Originating-IP'];
  for (const header of suspiciousHeaders) {
    const value = req.get(header);
    if (value && value.includes('127.0.0.1')) {
      logger.warn('Suspicious header detected', {
        header,
        value,
        ip: req.ip,
        path: req.path
      });
    }
  }

  next();
};

// API Gateway specific security middleware
export const apiGatewaySecurityMiddleware = [
  securityHeaders,
  corsMiddleware,
  validateRequest,
  sanitizeRequest,
  securityMonitoring
];
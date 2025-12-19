import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = generateRequestId();
  
  // Add request ID to request for tracing
  (req as any).requestId = requestId;
  
  // Log request with enhanced details
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - start;
    const responseSize = chunk ? Buffer.byteLength(chunk) : 0;
    
    // Determine log level based on status code
    const logLevel = res.statusCode >= 500 ? 'error' : 
                    res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      responseSize,
      userId: req.user?.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      securityThreats: (req as any).securityThreats,
      timestamp: new Date().toISOString()
    });

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        url: req.url,
        duration,
        userId: req.user?.userId
      });
    }

    return originalEnd(chunk, encoding);
  };

  next();
};

// Generate unique request ID for tracing
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    userId: req.user?.userId,
    ip: req.ip
  });

  next(error);
};
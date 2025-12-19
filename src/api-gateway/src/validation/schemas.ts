import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
});

export const registerSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number')
});

export const authHeaderSchema = z.object({
  authorization: z.string()
    .regex(/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/, 'Invalid authorization header format')
});

// Validation middleware helper
export const validateBody = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: 'INVALID_INPUT',
          message: 'Validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
};

export const validateHeaders = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      schema.parse(req.headers);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: 'INVALID_INPUT',
          message: 'Invalid headers',
          details: error.errors
        });
      }
      next(error);
    }
  };
};
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env['PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  
  // JWT Configuration
  jwt: {
    secret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
    issuer: process.env['JWT_ISSUER'] || 'picksy-api',
    audience: process.env['JWT_AUDIENCE'] || 'picksy-users'
  },
  
  // Database Configuration
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    name: process.env['DB_NAME'] || 'picksy',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'password',
    ssl: process.env['DB_SSL'] === 'true'
  },
  
  // Redis Configuration
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'],
    db: parseInt(process.env['REDIS_DB'] || '0', 10)
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
    authWindowMs: parseInt(process.env['AUTH_RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    authMaxRequests: parseInt(process.env['AUTH_RATE_LIMIT_MAX_REQUESTS'] || '5', 10)
  },
  
  // CORS Configuration
  cors: {
    origin: process.env['CORS_ORIGIN']?.split(',') || ['chrome-extension://*', 'moz-extension://*'],
    credentials: true
  },
  
  // Security
  bcrypt: {
    saltRounds: parseInt(process.env['BCRYPT_SALT_ROUNDS'] || '12', 10)
  }
};

// Validate required environment variables in production
if (config.nodeEnv === 'production') {
  const requiredEnvVars = ['JWT_SECRET', 'DB_PASSWORD'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }
}
import { createClient } from 'redis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class RedisConnection {
  private client;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port
      },
      password: config.redis.password || undefined,
      database: config.redis.db
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });
  }

  async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async disconnect() {
    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  async set(key: string, value: string, expireInSeconds?: number) {
    await this.connect();
    if (expireInSeconds) {
      return this.client.setEx(key, expireInSeconds, value);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    await this.connect();
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    await this.connect();
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    await this.connect();
    return this.client.exists(key);
  }

  async incr(key: string): Promise<number> {
    await this.connect();
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    await this.connect();
    return this.client.expire(key, seconds);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    await this.connect();
    return this.client.hGetAll(key);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    await this.connect();
    return this.client.hIncrBy(key, field, increment);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.connect();
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error);
      return false;
    }
  }
}

export const redis = new RedisConnection();
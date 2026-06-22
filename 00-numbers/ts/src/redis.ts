import { Redis } from 'ioredis';
import { config } from './config.js';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  // Fail fast instead of buffering commands forever if redis is down.
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

export const redisKey = (id: number): string => `kv:${id}`;

export async function closeRedis(): Promise<void> {
  await redis.quit();
}

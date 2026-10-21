import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) {
    redisClient = null;
    return redisClient;
  }
  if (!url || !token) {
    console.warn("[redis] Incomplete configuration; using PostgreSQL.");
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({
      url,
      token,
      retry: false,
      signal: () => AbortSignal.timeout(500),
    });
  } catch (error) {
    logRedisCacheError("client initialization", error);
    redisClient = null;
  }
  return redisClient;
}

export function logRedisCacheError(operation: string, error: unknown) {
  console.warn(
    `[redis] ${operation} failed; using PostgreSQL:`,
    error instanceof Error ? error.name : "Unknown error"
  );
}

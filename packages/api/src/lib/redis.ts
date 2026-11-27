import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;
let redisCircuitOpenUntil = 0;

export function getRedisClient(): Redis | null {
  if (Date.now() < redisCircuitOpenUntil) return null;
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
      signal: () => AbortSignal.timeout(350),
    });
  } catch (error) {
    logRedisCacheError("client initialization", error);
    redisClient = null;
  }
  return redisClient;
}

export function logRedisCacheError(operation: string, error: unknown) {
  // Open circuit breaker for 60s so subsequent punch-ins don't wait on a slow/down Redis
  redisCircuitOpenUntil = Date.now() + 60_000;
  console.warn(
    `[redis] ${operation} failed; using PostgreSQL (circuit open 60s):`,
    error instanceof Error ? error.name : "Unknown error"
  );
}

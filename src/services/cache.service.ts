export interface CacheEntry<T> {
  data: T;
  expiry: number; // Unix timestamp
}

export class CacheService {
  private static cache = new Map<string, CacheEntry<any>>();

  /**
   * Fetch an item from the cache, or compute and cache it if not found or expired
   * @param key Unique cache key
   * @param fetchFn Asynchronous fallback function to retrieve the data
   * @param ttlMs Time-to-live in milliseconds (default: 60 seconds)
   */
  static async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 60 * 1000
  ): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (entry && entry.expiry > now) {
      return entry.data as T;
    }

    // Cache miss or expired: fetch and cache
    const data = await fetchFn();
    this.cache.set(key, {
      data,
      expiry: now + ttlMs,
    });

    return data;
  }

  /**
   * Set cache entry directly
   */
  static set<T>(key: string, data: T, ttlMs: number = 60 * 1000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  static invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  static clear(): void {
    this.cache.clear();
  }
}

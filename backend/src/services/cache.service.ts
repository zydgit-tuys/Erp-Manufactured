/**
 * Cache Service
 * Implements Redis-style caching for frequently accessed data
 * 
 * Use this for:
 * - Master data (COA, products, materials)
 * - User sessions
 * - Computed balances
 * - Frequently accessed lookups
 */

interface CacheConfig {
    ttl: number; // Time to live in seconds
    prefix: string; // Cache key prefix
}

class CacheService {
    private cache: Map<string, { value: any; expires: number }> = new Map();

    /**
     * Gets a value from cache or executes the fallback function and caches the result.
     * 
     * **Pattern: Cache-Aside (Lazy Loading)**
     * 1. Check cache first
     * 2. If miss, execute fallback
     * 3. Cache the result
     * 4. Return value
     * 
     * @param key - Unique cache key
     * @param fallback - Function to execute on cache miss
     * @param ttl - Time to live in seconds (default: 300 = 5 minutes)
     * 
     * @example
     * ```typescript
     * const accounts = await cache.getOrSet(
     *   `coa:${companyId}`,
     *   () => getAllAccounts(companyId),
     *   3600  // Cache for 1 hour
     * );
     * ```
     */
    async getOrSet<T>(
        key: string,
        fallback: () => Promise<T>,
        ttl: number = 300
    ): Promise<T> {
        const cached = this.cache.get(key);

        if (cached && cached.expires > Date.now()) {
            return cached.value as T;
        }

        const value = await fallback();
        this.set(key, value, ttl);
        return value;
    }

    /**
     * Sets a value in the cache.
     */
    set(key: string, value: any, ttl: number = 300): void {
        this.cache.set(key, {
            value,
            expires: Date.now() + ttl * 1000,
        });
    }

    /**
     * Gets a value from cache.
     */
    get<T>(key: string): T | null {
        const cached = this.cache.get(key);

        if (cached && cached.expires > Date.now()) {
            return cached.value as T;
        }

        this.cache.delete(key);
        return null;
    }

    /**
     * Invalidates cache entries matching a pattern.
     * 
     * @example
     * ```typescript
     * // Invalidate all COA cache for a company
     * cache.invalidate(`coa:${companyId}:*`);
     * ```
     */
    invalidate(pattern: string): void {
        const regex = new RegExp(pattern.replace('*', '.*'));

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clears all cache entries.
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Gets cache statistics.
     */
    getStats() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        const active = entries.filter(([, v]) => v.expires > now).length;
        const expired = entries.length - active;

        return {
            total: entries.length,
            active,
            expired,
            size: JSON.stringify(Object.fromEntries(this.cache)).length,
        };
    }
}

// Singleton instance
export const cache = new CacheService();

/**
 * Cache key generators for consistency
 */
export const CacheKeys = {
    coa: (companyId: string) => `coa:${companyId}`,
    coaAccount: (companyId: string, code: string) => `coa:${companyId}:${code}`,
    products: (companyId: string) => `products:${companyId}`,
    materials: (companyId: string) => `materials:${companyId}`,
    warehouses: (companyId: string) => `warehouses:${companyId}`,
    period: (companyId: string, status: string) => `period:${companyId}:${status}`,
    balance: (companyId: string, materialId: string, warehouseId: string, binId: string) =>
        `balance:${companyId}:${materialId}:${warehouseId}:${binId}`,
};

/**
 * Decorator for automatic caching
 * 
 * @example
 * ```typescript
 * @Cacheable('products', 3600)
 * async function getAllProducts(companyId: string) {
 *   // This will be cached for 1 hour
 * }
 * ```
 */
export function Cacheable(keyPrefix: string, ttl: number = 300) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
            return cache.getOrSet(cacheKey, () => originalMethod.apply(this, args), ttl);
        };

        return descriptor;
    };
}

/**
 * 统一的 API 客户端
 * 提供请求缓存、去重、错误重试等功能
 */

/** 后端 API 根地址，供页面与 hooks 复用 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/** 获取请求用的 API 根地址（无配置时用当前页 origin） */
export function getApiBase(): string {
  if (API_BASE) return API_BASE;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

// 请求缓存配置
interface CacheConfig {
  ttl?: number; // 缓存时间（毫秒）
  key?: string; // 自定义缓存键
}

// 请求选项
interface RequestOptions extends Omit<RequestInit, 'signal' | 'cache'> {
  cache?: CacheConfig; // 自定义缓存配置（与 RequestInit.cache 不同）
  retry?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
  signal?: AbortSignal; // 支持 AbortSignal
}

// 内存缓存
const memoryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// 正在进行的请求（用于去重）
const pendingRequests = new Map<string, Promise<any>>();

// 默认缓存时间
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 生成缓存键
 */
function getCacheKey(url: string, options?: RequestInit): string {
  const method = (options?.method || 'GET').toUpperCase();
  const body = options?.body ? JSON.stringify(options.body) : '';
  return `${method}:${url}:${body}`;
}

/**
 * 从缓存获取数据
 */
function getFromCache(key: string): any | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    memoryCache.delete(key);
    return null;
  }
  
  return cached.data;
}

/**
 * 保存到缓存
 */
function saveToCache(key: string, data: any, ttl: number): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * 清理过期缓存
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  memoryCache.forEach((cached, key) => {
    if (now - cached.timestamp > cached.ttl) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => memoryCache.delete(key));
}

// 定期清理过期缓存（每10分钟）
if (typeof window !== 'undefined') {
  setInterval(cleanExpiredCache, 10 * 60 * 1000);
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 统一的 API 请求函数
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    cache,
    retry = 0,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  // 构建完整 URL
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  // 生成缓存键
  const cacheKey = cache?.key || getCacheKey(url, fetchOptions);
  
  // 仅当显式传入 cache 且为 GET 时使用缓存
  if (cache && (fetchOptions.method === undefined || fetchOptions.method === 'GET')) {
    const cachedData = getFromCache(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }
  }

  // 检查是否有正在进行的相同请求（去重）
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  // 创建请求 Promise
  const requestPromise = (async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        if (attempt > 0) {
          await delay(retryDelay * attempt);
        }

        // 提取 signal，避免被覆盖
        const { signal, ...restFetchOptions } = fetchOptions;
        
        const response = await fetch(url, {
          credentials: 'include',
          ...restFetchOptions,
          signal, // 单独设置 signal
          headers: {
            'Content-Type': 'application/json',
            ...restFetchOptions.headers,
          },
        });

        // 检查响应状态
        if (!response.ok) {
          // 如果是 401，可能是认证问题，不重试
          if (response.status === 401) {
            throw new Error('Unauthorized');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // 保存到缓存（仅 GET 请求）
        if (cache && (fetchOptions.method === undefined || fetchOptions.method === 'GET')) {
          const ttl = cache.ttl || DEFAULT_CACHE_TTL;
          saveToCache(cacheKey, data, ttl);
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 如果是最后一次尝试，抛出错误
        if (attempt === retry) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Request failed');
  })();

  // 保存到待处理请求
  pendingRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    return result;
  } finally {
    // 请求完成后移除
    pendingRequests.delete(cacheKey);
  }
}

/**
 * GET 请求（带缓存）
 */
export function apiGet<T = any>(
  endpoint: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST 请求
 */
export function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT 请求
 */
export function apiPut<T = any>(
  endpoint: string,
  body?: any,
  options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE 请求
 */
export function apiDelete<T = any>(
  endpoint: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * 清除缓存：不传 pattern 时清空全部；传 pattern 时仅删除 key 包含该字符串的项
 */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    memoryCache.clear();
    return;
  }

  const keysToDelete: string[] = [];
  memoryCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => memoryCache.delete(key));
}

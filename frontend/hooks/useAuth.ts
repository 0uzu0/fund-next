/**
 * 用户认证相关业务 Hooks
 * 封装用户登录、登出、权限检查等功能
 */
import { useCallback, useState, useEffect } from 'react';
import { useApi } from './useApi';
import { api } from '../services/api';
import type { CurrentUser, LoginResponse, User } from '../types';

// ==================== 当前用户 Hook ====================

/**
 * 获取当前用户信息 Hook
 */
export function useCurrentUser() {
  const { data, error, isLoading, refresh } = useApi<CurrentUser>(
    '/api/auth/me',
    { cache: { ttl: 10 * 60 * 1000 } }
  );

  return {
    user: data,
    isAdmin: data?.is_admin ?? false,
    error,
    isLoading,
    refresh,
  };
}

// ==================== 登录 Hook ====================

/**
 * 登录 Hook
 */
export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.auth.login(username, password, rememberMe);
      if (response.success) {
        // 清除缓存，确保用户状态更新
        api.cache.clearAll();
        return { success: true };
      } else {
        setError(response.message || '登录失败');
        return { success: false };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    login,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// ==================== 登出 Hook ====================

/**
 * 登出 Hook
 */
export function useLogout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.auth.logout();
      if (response.success) {
        api.cache.clearAll();
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '登出失败';
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    logout,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// ==================== 修改密码 Hook ====================

/**
 * 修改密码 Hook
 */
export function useChangePassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.auth.changePassword(oldPassword, newPassword);
      if (response.success) {
        api.cache.clearAll();
      } else {
        setError(response.message || '修改密码失败');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '修改密码失败';
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    changePassword,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// ==================== 权限检查 Hook ====================

/**
 * 权限检查 Hook
 */
export function useAuthCheck() {
  const { user, isAdmin, isLoading } = useCurrentUser();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!user);
  }, [user]);

  /**
   * 检查是否已登录
   */
  const requireAuth = useCallback((): boolean => {
    return isAuthenticated;
  }, [isAuthenticated]);

  /**
   * 检查是否是管理员
   */
  const requireAdmin = useCallback((): boolean => {
    return isAuthenticated && isAdmin;
  }, [isAuthenticated, isAdmin]);

  return {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    requireAuth,
    requireAdmin,
  };
}

// ==================== 导出 ====================

export default {
  useCurrentUser,
  useLogin,
  useLogout,
  useChangePassword,
  useAuthCheck,
};
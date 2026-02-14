import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'SERVER_URL';

type ContextValue = {
  serverUrl: string | null;
  isLoading: boolean;
  setServerUrl: (url: string) => Promise<void>;
  clearServerUrl: () => Promise<void>;
};

const ServerUrlContext = createContext<ContextValue | null>(null);

export function ServerUrlProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((url) => {
        const trimmed = typeof url === 'string' && url.trim() ? url.trim() : null;
        setServerUrlState(trimmed);
      })
      .catch(() => setServerUrlState(null))
      .finally(() => setIsLoading(false));
  }, []);

  const setServerUrl = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(STORAGE_KEY, trimmed);
    setServerUrlState(trimmed);
  }, []);

  const clearServerUrl = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setServerUrlState(null);
  }, []);

  const value: ContextValue = {
    serverUrl,
    isLoading,
    setServerUrl,
    clearServerUrl,
  };

  return (
    <ServerUrlContext.Provider value={value}>
      {children}
    </ServerUrlContext.Provider>
  );
}

export function useServerUrl() {
  const ctx = useContext(ServerUrlContext);
  if (!ctx) throw new Error('useServerUrl must be used within ServerUrlProvider');
  return ctx;
}

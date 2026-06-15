'use client';

import { useCallback, useEffect, useState } from 'react';

async function probeBackendReachable() {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const response = await fetch('/api/health/backend', {
      cache: 'no-store',
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export function useEffectiveOnline() {
  const [browserOnline, setBrowserOnline] = useState(true);
  const [backendReachable, setBackendReachable] = useState(true);

  const refreshConnectivity = useCallback(async () => {
    const navigatorOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setBrowserOnline(navigatorOnline);

    if (!navigatorOnline) {
      setBackendReachable(false);
      return;
    }

    setBackendReachable(await probeBackendReachable());
  }, []);

  useEffect(() => {
    void refreshConnectivity();

    function handleOnline() {
      void refreshConnectivity();
    }

    function handleOffline() {
      setBrowserOnline(false);
      setBackendReachable(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = window.setInterval(() => {
      void refreshConnectivity();
    }, 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [refreshConnectivity]);

  return {
    online: browserOnline && backendReachable,
    browserOnline,
    backendReachable,
    refreshConnectivity,
  };
}

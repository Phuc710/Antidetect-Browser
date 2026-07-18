import { useState, useCallback } from 'react';
import type { ProxyView, ProxyListResult, ProxyTestResult } from 'shared';
import { proxyIpc } from '../api/proxy-ipc.js';

interface UseProxiesState {
  data: ProxyListResult | null;
  loading: boolean;
  error: string | null;
}

export function useProxies(search?: string) {
  const [state, setState] = useState<UseProxiesState>({
    data: null,
    loading: false,
    error: null,
  });

  const fetch = useCallback(async (searchTerm?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await proxyIpc.list({ search: searchTerm, limit: 100, offset: 0 });
      setState({ data: result, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách proxy.';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  return { ...state, refetch: () => fetch(search) };
}

export function useCreateProxy(onSuccess: (proxy: ProxyView) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: Parameters<typeof proxyIpc.create>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const proxy = await proxyIpc.create(input);
      onSuccess(proxy);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tạo proxy.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { create, loading, error, clearError: () => setError(null) };
}

export function useUpdateProxy(onSuccess: (proxy: ProxyView) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (input: Parameters<typeof proxyIpc.update>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const proxy = await proxyIpc.update(input);
      onSuccess(proxy);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể cập nhật proxy.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { update, loading, error, clearError: () => setError(null) };
}

export function useRemoveProxy(onSuccess: (proxyId: string) => void) {
  const [loading, setLoading] = useState(false);

  const remove = useCallback(async (proxyId: string) => {
    setLoading(true);
    try {
      await proxyIpc.remove(proxyId);
      onSuccess(proxyId);
    } catch {
      // Caller handles error state
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { remove, loading };
}

export function useTestProxy() {
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, ProxyTestResult>>(new Map());

  const testStored = useCallback(async (proxyId: string) => {
    const testId = `${proxyId}-${Date.now()}`;
    setTestingIds((prev) => new Set([...prev, proxyId]));
    try {
      const result = await proxyIpc.testStored(proxyId, testId);
      setResults((prev) => new Map([...prev, [proxyId, result]]));
      return result;
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(proxyId);
        return next;
      });
    }
  }, []);

  const testDraft = useCallback(async (input: Parameters<typeof proxyIpc.testDraft>[0]) => {
    return proxyIpc.testDraft(input);
  }, []);

  const cancelTest = useCallback(async (testId: string) => {
    await proxyIpc.cancelTest(testId);
  }, []);

  return {
    testStored,
    testDraft,
    cancelTest,
    testingIds,
    results,
  };
}

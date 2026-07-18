import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProfileView, ProfileListResult, ProfileRuntimeEvent, ProfileRuntimeSnapshot } from 'shared';

interface UseProfilesState {
  data: ProfileListResult | null;
  loading: boolean;
  error: string | null;
}

export function useProfiles(search?: string, os?: 'windows' | 'mac' | 'linux', status?: string) {
  const [state, setState] = useState<UseProfilesState>({
    data: null,
    loading: false,
    error: null,
  });

  // Track sequence numbers per session to reject stale out-of-order events
  const latestSequenceMap = useRef<Map<string, number>>(new Map());

  const fetch = useCallback(async (
    searchTerm?: string,
    osFilter?: 'windows' | 'mac' | 'linux',
    statusFilter?: string
  ) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await window.desktop.profile.list({
        search: searchTerm || undefined,
        os: osFilter || undefined,
        status: statusFilter || undefined,
        limit: 100,
        offset: 0,
      });

      // Hydrate with current runtime snapshot
      const snapshot = await window.desktop.profile.getRuntimeSnapshot();
      const snapshotMap = new Map<string, ProfileRuntimeSnapshot>(snapshot.map((s) => [s.profileId, s]));

      const hydratedItems = result.items.map((item) => {
        const snap = snapshotMap.get(item.id);
        if (snap) {
          let status: ProfileView['status'] = 'stopped';
          if (snap.state === 'running') status = 'running';
          else if (snap.state === 'starting' || snap.state === 'validating' || snap.state === 'waiting') status = 'starting';
          else if (snap.state === 'error' || snap.state === 'crashed') status = 'error';
          return { ...item, status: status };
        }
        return item;
      });

      setState({ data: { items: hydratedItems, total: result.total }, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách profiles.';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  // Subscribe to runtime events with sequence tracking
  useEffect(() => {
    const unsubscribe = window.desktop.profile.subscribeRuntime((event: ProfileRuntimeEvent) => {
      const lastSeq = latestSequenceMap.current.get(event.browserSessionId) ?? 0;
      if (event.sequence <= lastSeq) {
        // Discard stale out-of-order event
        return;
      }
      latestSequenceMap.current.set(event.browserSessionId, event.sequence);

      setState((prev) => {
        if (!prev.data) return prev;

        const nextItems = prev.data.items.map((item) => {
          if (item.id !== event.profileId) return item;

          let status: ProfileView['status'] = 'stopped';
          if (event.state === 'running') status = 'running';
          else if (event.state === 'starting' || event.state === 'validating' || event.state === 'waiting') status = 'starting';
          else if (event.state === 'error' || event.state === 'crashed') status = 'error';

          return { ...item, status };
        });

        return {
          ...prev,
          data: { ...prev.data, items: nextItems },
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    refetch: () => fetch(search, os, status),
  };
}

export function useCreateProfile(onSuccess: (profile: ProfileView) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: Parameters<typeof window.desktop.profile.create>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const profile = await window.desktop.profile.create(input);
      onSuccess(profile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tạo profile mới.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { create, loading, error, clearError: () => setError(null) };
}

export function useUpdateProfile(onSuccess: (profile: ProfileView) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (input: Parameters<typeof window.desktop.profile.update>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const profile = await window.desktop.profile.update(input);
      onSuccess(profile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể cập nhật profile.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { update, loading, error, clearError: () => setError(null) };
}

export function useRemoveProfile(onSuccess: (profileId: string) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (profileId: string) => {
    setLoading(true);
    setError(null);
    try {
      await window.desktop.profile.remove({ profileId });
      onSuccess(profileId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể xóa profile.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { remove, loading, error, clearError: () => setError(null) };
}

export function useProfileLifecycle() {
  const [launchingIds, setLaunchingIds] = useState<Set<string>>(new Set());
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [sessionMap, setSessionMap] = useState<Map<string, string>>(new Map());

  const launch = useCallback(async (profileId: string, headless = false) => {
    setLaunchingIds((prev) => new Set([...prev, profileId]));
    try {
      const res = await window.desktop.profile.launch({ profileId, headless });
      setSessionMap((prev) => new Map([...prev, [profileId, res.sessionId]]));
      return res;
    } finally {
      setLaunchingIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }, []);

  const stop = useCallback(async (profileId: string) => {
    setStoppingIds((prev) => new Set([...prev, profileId]));

    const sessionId = sessionMap.get(profileId);
    try {
      if (sessionId) {
        await window.desktop.profile.stop({ sessionId });
      } else {
        await window.desktop.profile.stop({ sessionId: '' });
      }
      setSessionMap((prev) => {
        const next = new Map(prev);
        next.delete(profileId);
        return next;
      });
    } finally {
      setStoppingIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }, [sessionMap]);

  return {
    launch,
    stop,
    launchingIds,
    stoppingIds,
  };
}

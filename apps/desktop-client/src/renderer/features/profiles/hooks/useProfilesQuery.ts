import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../hooks/queryKeys.js';
import type { ProfileView } from '../../../../shared/profile-contracts.js';

export function useProfilesQuery() {
  const {
    data: profilesData,
    isLoading: isProfilesLoading,
    isError: isProfilesError,
    refetch: refetchProfiles,
  } = useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: async () => {
      const [result, snapshot] = await Promise.all([
        window.desktop.profile.list({ limit: 100, offset: 0 }),
        window.desktop.profile.getRuntimeSnapshot(),
      ]);

      const snapshotMap = new Map(snapshot.map((s) => [s.profileId, s]));
      const hydratedItems = result.items.map((item) => {
        const snap = snapshotMap.get(item.id);
        if (snap) {
          let status: ProfileView['status'] = 'stopped';
          if (snap.state === 'running') status = 'running';
          else if (
            snap.state === 'starting' ||
            snap.state === 'validating' ||
            snap.state === 'waiting' ||
            snap.state === 'acquiring_lock' ||
            snap.state === 'preparing'
          ) {
            status = 'starting';
          } else if (snap.state === 'error' || snap.state === 'crashed') {
            status = 'error';
          }
          return { ...item, status };
        }
        return item;
      });

      return { items: hydratedItems, total: result.total };
    },
    staleTime: 60_000,
  });

  const {
    data: proxiesData,
    isLoading: isProxiesLoading,
  } = useQuery({
    queryKey: queryKeys.proxies.list(),
    queryFn: async () => {
      try {
        const res = await window.desktop.proxy.list({ limit: 100, offset: 0 });
        return res.items;
      } catch {
        return [];
      }
    },
    staleTime: 120_000,
  });

  return {
    profiles: profilesData?.items ?? [],
    proxies: proxiesData ?? [],
    total: profilesData?.total ?? 0,
    isLoading: isProfilesLoading || isProxiesLoading,
    isError: isProfilesError,
    refetch: refetchProfiles,
  };
}

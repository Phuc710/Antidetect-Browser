import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../hooks/queryKeys.js';

export function useProfileFormQuery(profileId?: string) {
  // Fetch proxies list
  const {
    data: proxiesData,
    isLoading: isProxiesLoading,
    isError: isProxiesError,
  } = useQuery({
    queryKey: queryKeys.proxies.list(),
    queryFn: async () => {
      const result = await window.desktop.proxy.list({ limit: 200, offset: 0 });
      return result.items.filter((item) => item.status !== 'pending_delete');
    },
    staleTime: 30_000,
  });

  // Fetch target profile (if editing)
  const {
    data: profileData,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useQuery({
    queryKey: queryKeys.profiles.detail(profileId ?? ''),
    queryFn: async () => {
      if (!profileId) return null;
      return window.desktop.profile.get({ profileId });
    },
    enabled: Boolean(profileId),
    staleTime: 0, // Profile detail for editing must always be fresh
  });

  return {
    proxies: proxiesData ?? [],
    profile: profileData ?? null,
    isLoading: isProxiesLoading || (Boolean(profileId) && isProfileLoading),
    isError: isProxiesError || (Boolean(profileId) && isProfileError),
  };
}

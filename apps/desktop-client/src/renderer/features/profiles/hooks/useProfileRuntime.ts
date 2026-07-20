import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../hooks/queryKeys.js';
import type { ProfileRuntimeEvent, ProfileView } from '../../../../shared/profile-contracts.js';

function toVisibleStatus(event: ProfileRuntimeEvent): ProfileView['status'] {
  if (
    event.state === 'starting' ||
    event.state === 'validating' ||
    event.state === 'waiting' ||
    event.state === 'acquiring_lock' ||
    event.state === 'preparing'
  ) {
    return 'starting';
  }
  if (event.state === 'running' || event.state === 'stopping') return 'running';
  if (event.state === 'error' || event.state === 'crashed' || event.state === 'locked') return 'error';
  return 'stopped';
}

export function useProfileRuntime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = window.desktop.profile.subscribeRuntime((event: ProfileRuntimeEvent) => {
      queryClient.setQueriesData<{ items: ProfileView[]; total: number }>(
        { queryKey: queryKeys.profiles.lists() },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            items: oldData.items.map((profile) =>
              profile.id === event.profileId
                ? { ...profile, status: toVisibleStatus(event) }
                : profile
            ),
          };
        }
      );
    });

    return unsubscribe;
  }, [queryClient]);
}

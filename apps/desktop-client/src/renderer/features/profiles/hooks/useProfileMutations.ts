import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../hooks/queryKeys.js';
import { toastService } from '../../../services/toast-service.js';
import type { ProfileView } from '../../../../shared/profile-contracts.js';

export function useProfileMutations() {
  const queryClient = useQueryClient();
  const [launchingIds, setLaunchingIds] = useState<Set<string>>(new Set());
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());

  const invalidateProfiles = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() });
  }, [queryClient]);

  const launch = useCallback(async (profileId: string) => {
    setLaunchingIds((prev) => new Set([...prev, profileId]));
    try {
      await window.desktop.profile.launch({ profileId, headless: false });
      invalidateProfiles();
    } catch (err) {
      toastService.error(err instanceof Error ? err.message : 'Khởi chạy browser thất bại.');
    } finally {
      setLaunchingIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }, [invalidateProfiles]);

  const stop = useCallback(async (profileId: string) => {
    setStoppingIds((prev) => new Set([...prev, profileId]));
    try {
      const snapshot = await window.desktop.profile.getRuntimeSnapshot();
      const session = snapshot.find((s) => s.profileId === profileId);
      if (session) {
        await window.desktop.profile.stop({ sessionId: session.browserSessionId });
      } else {
        await window.desktop.profile.stop({ sessionId: '' });
      }
      invalidateProfiles();
    } catch (err) {
      toastService.error(err instanceof Error ? err.message : 'Đóng browser thất bại.');
    } finally {
      setStoppingIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  }, [invalidateProfiles]);

  const toggleLaunch = useCallback(async ({ profile, isRunning }: { profile: ProfileView; isRunning: boolean }) => {
    if (isRunning) {
      await stop(profile.id);
    } else {
      await launch(profile.id);
    }
  }, [launch, stop]);

  const deleteProfile = useCallback(async (profileId: string) => {
    try {
      await window.desktop.profile.remove({ profileId });
      toastService.success('Đã xóa profile thành công.');
      invalidateProfiles();
    } catch (err) {
      toastService.error(err instanceof Error ? err.message : 'Không thể xóa profile.');
    }
  }, [invalidateProfiles]);

  const duplicateProfile = useCallback(async (profile: ProfileView) => {
    try {
      const name = `${profile.name} - Copy`;
      await window.desktop.profile.create({
        name,
        os: profile.os,
        engine: profile.engine,
        distribution: profile.distribution,
        channel: profile.channel,
        ...(profile.proxyId ? { proxyId: profile.proxyId } : {}),
        ...(profile.notes ? { notes: profile.notes } : {}),
        ...(profile.projectId ? { projectId: profile.projectId } : {}),
        tags: profile.tags ?? [],
        startupUrls: profile.startupUrls ?? [],
        ...(profile.cookies ? { cookies: profile.cookies } : {}),
      });
      toastService.success(`Đã sao chép thành "${name}"`);
      invalidateProfiles();
    } catch (err) {
      toastService.error(err instanceof Error ? err.message : 'Nhân bản profile thất bại.');
    }
  }, [invalidateProfiles]);

  const updateProfile = useCallback(async (input: Parameters<typeof window.desktop.profile.update>[0]) => {
    try {
      const updated = await window.desktop.profile.update(input);
      invalidateProfiles();
      return updated;
    } catch (err) {
      toastService.error(err instanceof Error ? err.message : 'Cập nhật profile thất bại.');
      throw err;
    }
  }, [invalidateProfiles]);

  const bulkLaunch = useCallback(async (profiles: ProfileView[]) => {
    try {
      await Promise.all(profiles.map((p) => window.desktop.profile.launch({ profileId: p.id, headless: false })));
      toastService.success(`Khởi chạy thành công ${profiles.length} profiles.`);
      invalidateProfiles();
    } catch (err) {
      toastService.error('Khởi chạy hàng loạt thất bại.');
    }
  }, [invalidateProfiles]);

  const bulkStop = useCallback(async (profiles: ProfileView[]) => {
    try {
      const snapshot = await window.desktop.profile.getRuntimeSnapshot();
      await Promise.all(
        profiles.map(async (p) => {
          const session = snapshot.find((s) => s.profileId === p.id);
          if (session) {
            await window.desktop.profile.stop({ sessionId: session.browserSessionId });
          }
        }),
      );
      toastService.success(`Đóng thành công ${profiles.length} profiles.`);
      invalidateProfiles();
    } catch (err) {
      toastService.error('Đóng hàng loạt thất bại.');
    }
  }, [invalidateProfiles]);

  return {
    deleteProfile,
    duplicateProfile,
    updateProfile,
    toggleLaunch,
    launchingIds,
    stoppingIds,
    bulkLaunch,
    bulkStop,
  };
}

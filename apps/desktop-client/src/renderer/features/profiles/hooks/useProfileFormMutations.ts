import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '../../../hooks/queryKeys.js';
import { toastService } from '../../../services/toast-service.js';
import type { CreateProfileInput, UpdateProfileInput } from '../../../../shared/profile-contracts.js';

export function useProfileFormMutations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidateCache = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists() });
  };

  const createMutation = useMutation({
    mutationFn: async (input: CreateProfileInput) => {
      return window.desktop.profile.create(input);
    },
    onSuccess: (newProfile) => {
      invalidateCache();
      toastService.success(`Profile "${newProfile.name}" created successfully.`);
      navigate('/profiles', { state: { createdProfileId: newProfile.id } });
    },
    onError: (error) => {
      toastService.error(error instanceof Error ? error.message : 'Failed to create profile.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      return window.desktop.profile.update(input);
    },
    onSuccess: (updatedProfile) => {
      invalidateCache();
      // Also invalidate single details cache for this profile
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(updatedProfile.id) });
      toastService.success(`Profile "${updatedProfile.name}" updated successfully.`);
      navigate('/profiles', { state: { updatedProfileId: updatedProfile.id } });
    },
    onError: (error) => {
      toastService.error(error instanceof Error ? error.message : 'Failed to update profile.');
    },
  });

  return {
    createProfile: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

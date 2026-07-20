/**
 * Centralized TanStack Query key registry.
 *
 * Every query key used across the app MUST be defined here so that
 * invalidation, prefetching and cache management are predictable.
 *
 * Pattern: Each domain exposes an `all` root and factory functions
 * that return progressively more specific key tuples.
 */

export const queryKeys = {
  profiles: {
    all: ['profiles'] as const,
    lists: () => [...queryKeys.profiles.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.profiles.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.profiles.all, 'detail'] as const,
    detail: (profileId: string) =>
      [...queryKeys.profiles.details(), profileId] as const,
    runtimeSnapshot: () =>
      [...queryKeys.profiles.all, 'runtime-snapshot'] as const,
  },

  proxies: {
    all: ['proxies'] as const,
    list: (filters?: { search?: string; status?: string }) =>
      [...queryKeys.proxies.all, 'list', filters ?? {}] as const,
    detail: (proxyId: string) =>
      [...queryKeys.proxies.all, 'detail', proxyId] as const,
  },
} as const;

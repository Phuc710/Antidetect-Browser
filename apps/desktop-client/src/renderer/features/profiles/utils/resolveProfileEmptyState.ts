import type { EmptyStateConfig } from '../types.js';
import type { ProfileTabConfig } from '../config/profileTabConfigs.js';

export function resolveProfileEmptyState(
  tabConfig: ProfileTabConfig,
  searchTerm: string,
): EmptyStateConfig {
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    return {
      icon: 'Filter',
      title: 'No Search Results',
      description: 'No matching results under current conditions. Please try other filters.',
    };
  }

  return tabConfig.emptyState;
}

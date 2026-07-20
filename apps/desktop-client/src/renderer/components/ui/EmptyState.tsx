import type { ReactNode } from 'react';
import * as Icons from 'lucide-react';

interface EmptyStateProps {
  /** Lucide icon name, e.g. "Search", "Trash2", "Share2", "FileText" */
  readonly icon: keyof typeof Icons;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
  const IconComponent = Icons[icon] as React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;

  return (
    <div className="empty-state" role="status">
      <div className="empty-state__icon-wrap">
        {IconComponent && (
          <IconComponent size={40} strokeWidth={1.5} className="empty-state__icon" />
        )}
      </div>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__desc">{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

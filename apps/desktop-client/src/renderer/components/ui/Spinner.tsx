interface SpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

/**
 * Reusable Spinner Race component dùng chung cho toàn bộ giao diện Desktop Client.
 */
export function Spinner({ size = 'md', className = '' }: SpinnerProps): JSX.Element {
  const sizeClass = size ? `spinner-race--${size}` : '';
  const combinedClassName = `spinner-race ${sizeClass} ${className}`.trim();

  return (
    <div
      className={combinedClassName}
      role="status"
      aria-label="Đang tải"
    />
  );
}

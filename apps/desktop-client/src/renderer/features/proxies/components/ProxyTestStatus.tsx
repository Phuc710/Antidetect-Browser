import type { ProxyStatus } from 'shared';

interface ProxyTestStatusProps {
  status: ProxyStatus | 'unchecked';
}

export function ProxyTestStatus({ status }: ProxyTestStatusProps): JSX.Element {
  const labelMap: Record<string, string> = {
    unchecked: 'Chưa test',
    checking: 'Checking',
    online: 'Online',
    offline: 'Offline',
    authentication_error: 'Auth Error',
    timeout: 'Timeout',
    configuration_error: 'Config Error',
  };

  return (
    <span className={`proxy-dialog__status-badge proxy-dialog__status-badge--${status}`}>
      {labelMap[status] ?? status}
    </span>
  );
}

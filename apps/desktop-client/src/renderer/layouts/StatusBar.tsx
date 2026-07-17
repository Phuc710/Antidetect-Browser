import { Cloud, Database, Activity } from 'lucide-react';
import './StatusBar.css';

export function StatusBar(): JSX.Element {
  return (
    <div className="status-bar">
      <div className="status-bar__list">
        <StatusItem icon={Cloud} label="Cloud" status="connected" />
        <StatusItem icon={Database} label="Database" status="connected" />
        <StatusItem icon={Activity} label="0 profiles đang chạy" status="idle" />
      </div>
      <span className="status-bar__version">v0.1.0</span>
    </div>
  );
}

function StatusItem({
  icon: Icon,
  label,
  status,
}: {
  icon: React.ElementType;
  label: string;
  status: 'connected' | 'disconnected' | 'idle';
}): JSX.Element {
  const statusModifier =
    status === 'connected' ? 'status-bar__item--connected'
    : status === 'disconnected' ? 'status-bar__item--disconnected'
    : 'status-bar__item--idle';

  return (
    <div className={`status-bar__item ${statusModifier}`}>
      <Icon className="status-bar__item-icon" />
      <span>{label}</span>
    </div>
  );
}

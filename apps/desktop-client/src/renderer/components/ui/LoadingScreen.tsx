import { ShieldCheck } from 'lucide-react';
import { Spinner } from './Spinner.js';

interface LoadingScreenProps {
  readonly title?: string;
  readonly message?: string;
}

export function LoadingScreen({
  title = 'Antidetect Browser',
  message = 'Đang kiểm tra phiên làm việc...',
}: LoadingScreenProps): JSX.Element {
  return (
    <div className="loading-screen">
      <div className="loading-screen__logo-wrapper">
        <ShieldCheck className="loading-screen__logo" />
      </div>
      <h1 className="loading-screen__title">{title}</h1>
      <Spinner size="lg" />
      {message && <p className="loading-screen__text">{message}</p>}
    </div>
  );
}

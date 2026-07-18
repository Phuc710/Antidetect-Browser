import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { toastService, type ToastMessage } from '../../services/toast-service.js';
import './Toast.css';

const ICON_MAP = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer(): JSX.Element | null {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastMessage>>([]);

  useEffect(() => {
    return toastService.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const IconComponent = ICON_MAP[toast.type];
        return (
          <div
            key={toast.id}
            className={`toast-item toast-item--${toast.type}`}
            role="alert"
          >
            <div className="toast-item__icon">
              <IconComponent size={18} />
            </div>
            <div className="toast-item__content">
              {toast.title && <span className="toast-item__title">{toast.title}</span>}
              <span className="toast-item__message">{toast.message}</span>
            </div>
            <button
              className="toast-item__close"
              type="button"
              onClick={() => toastService.dismiss(toast.id)}
              aria-label="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

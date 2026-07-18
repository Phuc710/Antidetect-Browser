export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  readonly id: string;
  readonly type: ToastType;
  readonly title?: string | undefined;
  readonly message: string;
  readonly duration?: number | undefined; // ms, default 4000
}

type ToastListener = (toasts: ReadonlyArray<ToastMessage>) => void;

/**
 * Singleton Service quản lý Toast Notifications toàn ứng dụng.
 * Hỗ trợ vị trí hiển thị chính giữa trên cùng màn hình (Center Top / Center Mid).
 */
export class ToastService {
  private static instance: ToastService;
  private toasts: ToastMessage[] = [];
  private listeners: Set<ToastListener> = new Set();

  private constructor() {}

  public static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const readonlyToasts = [...this.toasts];
    this.listeners.forEach((listener) => listener(readonlyToasts));
  }

  public show(options: {
    type?: ToastType | undefined;
    title?: string | undefined;
    message: string;
    duration?: number | undefined;
  }): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = options.duration ?? 4000;

    const toast: ToastMessage = {
      id,
      type: options.type ?? 'info',
      title: options.title,
      message: options.message,
      duration,
    };

    this.toasts = [toast, ...this.toasts].slice(0, 5); // Tối đa 5 toasts cùng lúc
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  public success(message: string, title?: string | undefined, duration?: number | undefined): string {
    return this.show({ type: 'success', title, message, duration });
  }

  public error(message: string, title?: string | undefined, duration?: number | undefined): string {
    return this.show({ type: 'error', title, message, duration });
  }

  public warning(message: string, title?: string | undefined, duration?: number | undefined): string {
    return this.show({ type: 'warning', title, message, duration });
  }

  public info(message: string, title?: string | undefined, duration?: number | undefined): string {
    return this.show({ type: 'info', title, message, duration });
  }

  public dismiss(id: string): void {
    const prevCount = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    if (this.toasts.length !== prevCount) {
      this.notify();
    }
  }

  public clearAll(): void {
    this.toasts = [];
    this.notify();
  }
}

export const toastService = ToastService.getInstance();

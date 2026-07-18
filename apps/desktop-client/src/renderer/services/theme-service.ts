export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

type ThemeChangeListener = (mode: ThemeMode, resolved: ResolvedTheme) => void;

/**
 * Singleton Service quản lý Theme (Sáng/Tối/Hệ thống) chuẩn OOP.
 * Tự động đồng bộ với OS preference và lưu cấu hình vào localStorage.
 */
export class ThemeService {
  private static instance: ThemeService;
  private static readonly STORAGE_KEY = 'antidetect_theme_mode';
  private currentMode: ThemeMode = 'system';
  private listeners: Set<ThemeChangeListener> = new Set();
  private mediaQuery: MediaQueryList | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  private init(): void {
    const saved = localStorage.getItem(ThemeService.STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      this.currentMode = saved;
    } else {
      this.currentMode = 'dark'; // Dark mode by default
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', () => {
        if (this.currentMode === 'system') {
          this.applyTheme();
        }
      });
    }

    this.applyTheme();
  }

  public getMode(): ThemeMode {
    return this.currentMode;
  }

  public getResolvedTheme(): ResolvedTheme {
    if (this.currentMode === 'system') {
      return this.mediaQuery?.matches ? 'dark' : 'light';
    }
    return this.currentMode;
  }

  public setMode(mode: ThemeMode): void {
    this.currentMode = mode;
    localStorage.setItem(ThemeService.STORAGE_KEY, mode);
    this.applyTheme();
  }

  public subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.currentMode, this.getResolvedTheme());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private applyTheme(): void {
    const resolved = this.getResolvedTheme();
    document.documentElement.setAttribute('data-theme', resolved);
    this.listeners.forEach((listener) => listener(this.currentMode, resolved));
  }
}

export const themeService = ThemeService.getInstance();

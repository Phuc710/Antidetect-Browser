import { useEffect, useState } from 'react';
import { themeService, type ThemeMode, type ResolvedTheme } from '../services/theme-service.js';

export function useTheme(): {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
} {
  const [mode, setModeState] = useState<ThemeMode>(() => themeService.getMode());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => themeService.getResolvedTheme());

  useEffect(() => {
    return themeService.subscribe((currentMode, resolved) => {
      setModeState(currentMode);
      setResolvedTheme(resolved);
    });
  }, []);

  return {
    mode,
    resolvedTheme,
    setThemeMode: (newMode: ThemeMode) => themeService.setMode(newMode),
  };
}

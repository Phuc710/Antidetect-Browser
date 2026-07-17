import { create } from 'zustand';
import type { User } from 'shared';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // true khi đang kiểm tra session lúc khởi động
  error: null,

  setUser: (user) =>
    set({ user, isAuthenticated: user !== null, error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clear: () =>
    set({ user: null, isAuthenticated: false, error: null, isLoading: false }),
}));

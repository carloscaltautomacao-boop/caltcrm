import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api.ts';
import type { User } from '../lib/permissions.ts';

interface AuthCtx {
  user: User | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setCarregando(false));

    const onExpired = () => setUser(null);
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);

  async function login(email: string, senha: string) {
    const r = await api.post<{ user: Omit<User, 'sub'> & { id: string } }>('/auth/login', { email, senha });
    setUser({ ...r.user, sub: r.user.id });
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
  }

  return <Ctx.Provider value={{ user, carregando, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

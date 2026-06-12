'use client';

import { createContext, useContext } from 'react';
import { AuthUser } from '@/lib/types';
import { hasChamadosGerenciar } from '@/lib/navigation';

const SessionContext = createContext<AuthUser | null>(null);

export function SessionProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser() {
  return useContext(SessionContext);
}

export function useCanGerenciarChamados() {
  const user = useSessionUser();
  return hasChamadosGerenciar(user?.permissoes ?? []);
}

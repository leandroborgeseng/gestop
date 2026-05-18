'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth, logout, StoredAuth } from '@/lib/api';
import { LoadingState } from './ui-states';

export function AuthGate({ children, requiredPermissions = [] }: { children: React.ReactNode; requiredPermissions?: string[] }) {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();

    if (!stored) {
      router.replace('/login?reason=expired');
      return;
    }

    setAuth(stored);
    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <main className="gestop-shell p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <LoadingState label="Verificando sessão..." />
        </div>
      </main>
    );
  }

  if (!auth) {
    return null;
  }

  const hasPermission = requiredPermissions.every((permission) => auth.user.permissoes.includes(permission));

  if (!hasPermission) {
    router.replace('/login?reason=denied');
    return null;
  }

  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">GestOP</p>
            <p className="text-sm text-slate-600">
              {auth.user.nome} · {auth.user.perfis.join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {auth.user.permissoes.includes('secretarias.gerenciar') ? (
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Administração
              </button>
            ) : null}
            {auth.user.permissoes.includes('checklists.gerenciar') ? (
              <button
                type="button"
                onClick={() => router.push('/checklists')}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Checklists
              </button>
            ) : null}
            {auth.user.permissoes.includes('fiscalizacoes.executar') ? (
              <button
                type="button"
                onClick={() => router.push('/mobile')}
                className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
              >
                Campo
              </button>
            ) : null}
            {auth.user.permissoes.includes('chamados.gerenciar') ? (
              <button
                type="button"
                onClick={() => router.push('/ordens-servico')}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
              >
                OS
              </button>
            ) : null}
            {auth.user.permissoes.includes('dashboard.visualizar') ? (
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Dashboard
              </button>
            ) : null}
            {auth.user.permissoes.includes('auditoria.visualizar') ? (
              <button
                type="button"
                onClick={() => router.push('/integracoes')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Integrações
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace('/login?reason=logout');
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}

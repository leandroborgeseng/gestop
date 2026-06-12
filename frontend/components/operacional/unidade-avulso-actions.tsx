'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getStoredAuth } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export function UnidadeAvulsoActions({
  unidadeId,
  unidadeNome,
  onSuccess,
  size = 'sm',
  className,
}: {
  unidadeId?: string;
  unidadeNome?: string;
  onSuccess?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const router = useRouter();
  const canManage = getStoredAuth()?.user.permissoes.includes('chamados.gerenciar') ?? false;

  if (!canManage) return null;

  const href =
    unidadeId && unidadeNome
      ? `/chamados/novo?unidadeId=${encodeURIComponent(unidadeId)}&unidadeNome=${encodeURIComponent(unidadeNome)}`
      : '/chamados/novo';

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {unidadeId && unidadeNome ? (
        <Button
          variant="outlined"
          size={size}
          className="gap-1.5"
          onClick={() => {
            onSuccess?.();
            router.push(href);
          }}
        >
          <Bell className="h-4 w-4" />
          Abrir chamado neste próprio
        </Button>
      ) : (
        <Link href={href}>
          <Button variant="outlined" size={size} className="gap-1.5">
            <Bell className="h-4 w-4" />
            Abrir chamado
          </Button>
        </Link>
      )}
    </div>
  );
}

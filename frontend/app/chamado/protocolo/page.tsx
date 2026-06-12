'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ConsultaProtocoloPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = codigo.trim().toUpperCase();
    if (normalized.length < 4) return;
    router.push(`/chamado/protocolo/${encodeURIComponent(normalized)}`);
  }

  return (
    <main className="min-h-dvh bg-[#e7ecf3] px-4 py-7 font-[family-name:var(--font-sans)]">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[20px] bg-[var(--canvas)] shadow-[var(--sh-lg)]">
        <header className="bg-gradient-to-br from-[var(--brand-hover)] to-[var(--brand-bright)] px-[18px] pt-[18px] pb-[22px] text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
              <Image src="/franca-mark.png" alt="PMF" width={26} height={31} className="object-contain" />
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight">Prefeitura de Franca</p>
              <p className="text-[11px] opacity-90">Consulta de protocolo · SIGMA</p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <p className="text-[13px] leading-snug text-[var(--ink-2)]">
            Informe o número do protocolo recebido ao abrir o chamado para acompanhar o andamento.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--ink-2)]">Protocolo</span>
            <Input
              value={codigo}
              onChange={(event) => setCodigo(event.target.value.toUpperCase())}
              placeholder="Ex.: CH-2026-00042"
              className="mono h-[46px] text-[14px] uppercase"
              required
              minLength={4}
            />
          </label>
          <Button type="submit" variant="filled" className="h-[46px] w-full gap-2">
            <Search className="h-4 w-4" />
            Consultar
          </Button>
        </form>
      </div>
      <p className="mt-5 text-center text-[12px] text-[var(--ink-3)]">
        <Link href="/login" className="text-[var(--brand)] hover:underline">
          Acesso interno
        </Link>
      </p>
    </main>
  );
}

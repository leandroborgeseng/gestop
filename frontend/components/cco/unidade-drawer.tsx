'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  ClipboardList,
  LocateFixed,
  UserRound,
  Megaphone,
  X,
} from 'lucide-react';
import { getUnidadeDetalhe } from '@/lib/api';
import { UnidadeDetalhe, UnidadeOperacional } from '@/lib/types';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { cn } from '@/lib/cn';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Tabs } from '@/components/ui/tabs';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { UnidadeAvulsoActions } from '@/components/operacional/unidade-avulso-actions';

type DrawerTab = 'geral' | 'fisc' | 'nc' | 'chamados';

export function UnidadeDrawer({
  unidade,
  open,
  onClose,
}: {
  unidade: UnidadeOperacional | null;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DrawerTab>('geral');
  const [detalhe, setDetalhe] = useState<UnidadeDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !unidade) {
      setDetalhe(null);
      setError(null);
      return;
    }

    setTab('geral');
    let active = true;
    setLoading(true);
    setError(null);

    getUnidadeDetalhe(unidade.id)
      .then((data) => {
        if (active) setDetalhe(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, unidade?.id]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !unidade) return null;

  const ncCount = detalhe?.pendenciasDetalhadas.naoConformidades.length ?? unidade.pendencias.naoConformidadesAbertas;
  const chamadosCount = detalhe?.pendenciasDetalhadas.chamados.length ?? unidade.pendencias.chamadosAbertos;
  const fiscCount = detalhe?.ultimasFiscalizacoes.length ?? unidade.totais.fiscalizacoes;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar detalhe"
        className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.35)] backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-label={`Detalhe ${unidade.nome}`}
        className="fixed top-0 right-0 z-50 flex h-dvh w-full max-w-[min(440px,calc(100%-2.5rem))] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-lg)] lg:max-w-[440px]"
      >
        <header className="shrink-0 border-b border-[var(--line-2)] p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{unidade.codigoPatrimonial}</span>
            <IconButton variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
          <h2 className="mt-2 text-[17px] font-bold leading-snug text-[var(--ink)]">{unidade.nome}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge situacao={unidade.situacao} size="sm" />
            <span className="text-[12px] text-[var(--ink-3)]">
              {formatUnidadeTipo(unidade.tipo)} · {unidade.bairro ?? 'Sem bairro'}
            </span>
          </div>
        </header>

        <div className="shrink-0 border-b border-[var(--line-2)] px-4">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as DrawerTab)}
            items={[
              { id: 'geral', label: 'Visão geral' },
              { id: 'fisc', label: 'Vistorias', count: fiscCount },
              { id: 'nc', label: 'Não conf.', count: ncCount },
              { id: 'chamados', label: 'Chamados', count: chamadosCount },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? <LoadingState label="Carregando detalhe..." /> : null}
          {error ? <ErrorState message={error} onRetry={() => void getUnidadeDetalhe(unidade.id).then(setDetalhe)} /> : null}

          {!loading && !error && detalhe ? (
            <>
              {tab === 'geral' ? (
                <GeralTab
                  unidade={detalhe}
                  onClose={onClose}
                  onRefresh={() => void getUnidadeDetalhe(unidade.id).then(setDetalhe)}
                />
              ) : null}
              {tab === 'fisc' ? <FiscTab unidade={detalhe} /> : null}
              {tab === 'nc' ? <NcTab unidade={detalhe} /> : null}
              {tab === 'chamados' ? <ChamadosTab unidade={detalhe} onClose={onClose} /> : null}
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function GeralTab({
  unidade,
  onClose,
  onRefresh,
}: {
  unidade: UnidadeDetalhe;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const hasGps = unidade.latitude !== null && unidade.longitude !== null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Vistorias" value={unidade.totais.fiscalizacoes} />
        <StatCard label="Não conf." value={unidade.pendencias.naoConformidadesAbertas} tone="warn" />
        <StatCard label="Chamados" value={unidade.pendencias.chamadosAbertos} tone="brand" />
      </div>

      <dl className="grid gap-3 text-[13px]">
        <MetaField label="Secretaria" value={`${unidade.secretaria.sigla} — ${unidade.secretaria.nome}`} />
        <MetaField label="Endereço" value={unidade.endereco} />
        <MetaField label="Responsável" value={unidade.secretaria.responsavelNome ?? 'Não informado'} />
        <MetaField label="Raio check-in" value={`${unidade.raioValidacaoMetros} m`} />
        <MetaField
          label="Coordenadas"
          value={
            hasGps
              ? `${unidade.latitude!.toFixed(4)}, ${unidade.longitude!.toFixed(4)}`
              : 'Sem localização'
          }
          mono={hasGps}
          warn={!hasGps}
        />
      </dl>

      <div className="flex flex-wrap gap-2">
        <UnidadeAvulsoActions unidadeId={unidade.id} unidadeNome={unidade.nome} onSuccess={onRefresh} />
        <Link href="/mobile" onClick={onClose}>
          <Button variant="filled" size="sm" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Nova vistoria
          </Button>
        </Link>
        <Link href="/chamados" onClick={onClose}>
          <Button variant="outlined" size="sm" className="gap-1.5">
            <Megaphone className="h-4 w-4" />
            Ver chamados
          </Button>
        </Link>
      </div>

      <Link
        href={`/cco/unidades/${unidade.id}`}
        onClick={onClose}
        className="flex w-full items-center justify-center gap-1.5 rounded-[var(--r-md)] border border-dashed border-[var(--line)] py-2.5 text-[12.5px] font-semibold text-[var(--brand-hover)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
      >
        <ArrowUpRight className="h-4 w-4" />
        Abrir página completa da unidade
      </Link>
    </div>
  );
}

function FiscTab({ unidade }: { unidade: UnidadeDetalhe }) {
  if (unidade.ultimasFiscalizacoes.length === 0) {
    return <EmptyTab icon={ClipboardList} message="Nenhuma vistoria registrada" />;
  }

  return (
    <div className="space-y-2">
      {unidade.ultimasFiscalizacoes.map((fisc) => (
        <div key={fisc.id} className="flex gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ok-bg)] text-[var(--ok)]">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              {fisc.checklistVersao.checklist.nome} v{fisc.checklistVersao.versao}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-3)]">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3 w-3" />
                {fisc.agente.nome}
              </span>
              {fisc.concluidaEm ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(fisc.concluidaEm).toLocaleDateString('pt-BR')}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">{fisc.status} · {fisc.origem}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function NcTab({ unidade }: { unidade: UnidadeDetalhe }) {
  const items = unidade.pendenciasDetalhadas.naoConformidades;
  if (items.length === 0) {
    return <EmptyTab icon={AlertTriangle} message="Nenhuma não conformidade aberta" ok />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--warn)]">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              {item.item.codigo} — {item.item.titulo}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{item.descricao}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="warning">{item.severidade}</Badge>
              <Badge variant="neutral">{item.status}</Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChamadosTab({ unidade, onClose }: { unidade: UnidadeDetalhe; onClose: () => void }) {
  const items = unidade.pendenciasDetalhadas.chamados;
  if (items.length === 0) {
    return <EmptyTab icon={Megaphone} message="Nenhum chamado aberto" ok />;
  }

  return (
    <div className="space-y-2">
      {items.map((chamado) => (
        <Link
          key={chamado.id}
          href={`/chamados?id=${chamado.id}`}
          onClick={onClose}
          className="flex gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            <Megaphone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</p>
            <p className="text-[13px] font-semibold text-[var(--ink)]">{chamado.titulo ?? chamado.descricao}</p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">
              {chamado.status} · {chamado.responsavel?.nome ?? 'Sem responsável'}
            </p>
          </div>
          <Badge variant={chamado.prioridade.toUpperCase().includes('URG') || chamado.prioridade.toUpperCase().includes('ALTA') ? 'danger' : 'warning'}>
            {chamado.prioridade}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warn' | 'brand';
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--r-md)] border px-2 py-2.5 text-center',
        tone === 'warn' && value > 0 && 'border-[var(--warn-bd)] bg-[var(--warn-bg)]',
        tone === 'brand' && value > 0 && 'border-[var(--brand-soft)] bg-[var(--brand-soft)]',
        !tone || value === 0 ? 'border-[var(--line)] bg-[var(--surface-2)]' : '',
      )}
    >
      <p className="text-[18px] font-bold text-[var(--ink)]">{value}</p>
      <p className="text-[10px] font-semibold text-[var(--ink-3)]">{label}</p>
    </div>
  );
}

function MetaField({
  label,
  value,
  mono = false,
  warn = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className={cn('mt-0.5 font-medium text-[var(--ink-2)]', mono && 'mono text-[12px]', warn && 'inline-flex items-center gap-1 text-[var(--warn)]')}>
        {warn ? <LocateFixed className="h-3.5 w-3.5" /> : null}
        {value}
      </dd>
    </div>
  );
}

function EmptyTab({
  icon: Icon,
  message,
  ok = false,
}: {
  icon: typeof ClipboardList;
  message: string;
  ok?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <span className={cn('mb-3 flex h-12 w-12 items-center justify-center rounded-full', ok ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--muted-bg)] text-[var(--muted)]')}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-[13px] text-[var(--ink-3)]">{message}</p>
    </div>
  );
}

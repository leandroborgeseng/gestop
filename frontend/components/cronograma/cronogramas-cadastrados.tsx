'use client';

/**
 * 308 — Cronogramas cadastrados: ativos por padrão; inativos numa sanfona "Mostrar/Ocultar cronogramas inativos (N)"
 * com tag Inativo e Reativar com confirmação; Inativar também confirma. Permissão e auditoria ficam no backend.
 */
import { Button } from '@/components/ui/button';
import { AvisoChecklistInativoCronograma, BotaoStatusAtivo, SanfonaInativos, TagInativo } from '@/components/inativos/inativos';
import { CRONOGRAMA_FREQUENCIA_LABELS } from '@/lib/cronograma';
import {
  avisoDependenciasCronograma,
  dependenciasInativasCronograma,
  MSG_CRONOGRAMA_INATIVO_EXISTENTE,
  separarAtivosInativos,
  TEXTOS_CRONOGRAMA,
  type AcaoStatusAtivo,
} from '@/lib/inativos';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import type { CronogramaChecagem } from '@/lib/types';
import { cn } from '@/lib/cn';

export function CronogramasCadastrados({
  cronogramas,
  canAlterar,
  canExcluir,
  onEditar,
  onAlterarStatus,
}: {
  cronogramas: CronogramaChecagem[];
  canAlterar: boolean;
  canExcluir: boolean;
  onEditar: (item: CronogramaChecagem) => void;
  onAlterarStatus: (item: CronogramaChecagem, acao: AcaoStatusAtivo) => Promise<unknown>;
}) {
  const { ativos, inativos } = separarAtivosInativos(cronogramas);
  const card = (item: CronogramaChecagem) => (
    <div
      key={item.id}
      data-testid="cronograma-card"
      data-ativo={item.ativo ? 'true' : 'false'}
      className={cn(
        'flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-start sm:justify-between',
        !item.ativo && 'opacity-80',
      )}
    >
      <div>
        <h3 className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
          {item.unidade.nome}
          {!item.ativo ? <TagInativo /> : null}
        </h3>
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
          {item.checklist.nome} · {CRONOGRAMA_FREQUENCIA_LABELS[item.frequencia]} · {formatUnidadeTipo(item.unidade.tipo)}
        </p>
        {item.ativo && item.checklist.ativo === false ? <AvisoChecklistInativoCronograma className="mt-2" /> : null}
        {!item.ativo && dependenciasInativasCronograma(item).length ? (
          <p data-testid="cronograma-dependencia-inativa" className="mt-2 rounded-[var(--r-md)] bg-[var(--warn-bg)] px-2 py-1 text-[12.5px] font-semibold text-[var(--warn)]">
            {avisoDependenciasCronograma(dependenciasInativasCronograma(item))}
          </p>
        ) : null}
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
          {item.ativo ? 'Próxima' : 'Próxima (antes de inativar)'}: {new Date(item.proximaChecagemEm).toLocaleDateString('pt-BR')}
          {item.ultimaChecagemEm ? ` · Última: ${new Date(item.ultimaChecagemEm).toLocaleDateString('pt-BR')}` : ''}
        </p>
        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
          Responsável(is):{' '}
          {item.responsaveis?.length
            ? item.responsaveis.map((r) => r.usuario.nome).join(', ')
            : item.responsavel?.nome ?? 'Sem responsável definido'}
        </p>
      </div>
      {(canAlterar && item.ativo) || canExcluir ? (
        <div className="flex flex-wrap gap-2">
          {canAlterar && item.ativo ? (
            <Button variant="tonal" size="sm" className="min-h-11" onClick={() => onEditar(item)}>
              Editar
            </Button>
          ) : null}
          {canExcluir ? (
            <BotaoStatusAtivo registro={item} textos={TEXTOS_CRONOGRAMA} onConfirmar={(acao) => onAlterarStatus(item, acao)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
  return (
    <div className="space-y-3" data-testid="cronogramas-cadastrados">
      {ativos.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">
          {inativos.length ? 'Nenhum cronograma ativo para os filtros atuais.' : 'Nenhum cronograma cadastrado para os filtros atuais.'}
        </p>
      ) : null}
      {ativos.map(card)}
      <SanfonaInativos textos={TEXTOS_CRONOGRAMA} total={inativos.length}>
        <div className="space-y-3 pt-2">{inativos.map(card)}</div>
      </SanfonaInativos>
    </div>
  );
}

/** 308 (TL #47): no formulário de novo cronograma, o par próprio + checklist já tem um cronograma inativo. */
export function AvisoCronogramaInativoExistente({
  cronograma,
  canReativar,
  onReativar,
}: {
  cronograma: CronogramaChecagem;
  canReativar: boolean;
  onReativar: (item: CronogramaChecagem) => Promise<unknown>;
}) {
  const deps = dependenciasInativasCronograma(cronograma);
  return (
    <div role="status" data-testid="cronograma-inativo-existente" className="space-y-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--warn-bg)] px-3 py-2">
      <p className="text-[13px] font-semibold text-[var(--warn)]">{MSG_CRONOGRAMA_INATIVO_EXISTENTE}</p>
      {deps.length ? <p className="text-[12.5px] text-[var(--ink-2)]">{avisoDependenciasCronograma(deps)}</p> : null}
      {canReativar ? (
        <BotaoStatusAtivo registro={cronograma} textos={TEXTOS_CRONOGRAMA} onConfirmar={() => onReativar(cronograma)} />
      ) : (
        <p className="text-[12.5px] text-[var(--ink-2)]">Peça a quem tem permissão para reativá-lo.</p>
      )}
    </div>
  );
}

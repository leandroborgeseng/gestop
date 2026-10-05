'use client';

import { Button } from '../ui/button';
import type { ChamadoTarefaDetalhe } from '../../lib/chamado-tarefa';
import {
  TAREFA_ABA_HISTORICO,
  TAREFA_BOTAO_ALTERAR_DADOS,
  TAREFA_BOTAO_ANDAMENTO,
  TAREFA_BOTAO_CANCELAR,
  TAREFA_BOTAO_CONCLUIR,
} from '../../lib/chamado-tarefa-permissoes';

export function ChamadoTarefaBarraAcoes({
  tarefa,
  busy = false,
  onAlterarDados,
  onAndamento,
  onConcluir,
  onCancelar,
}: {
  tarefa: Pick<ChamadoTarefaDetalhe, 'podeAlterarDados' | 'podeAndamento' | 'podeConcluir' | 'podeCancelar'>;
  busy?: boolean;
  onAlterarDados?: () => void;
  onAndamento?: () => void;
  onConcluir?: () => void;
  onCancelar?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
      {tarefa.podeAlterarDados ? (
        <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={onAlterarDados}>
          {TAREFA_BOTAO_ALTERAR_DADOS}
        </Button>
      ) : null}
      {tarefa.podeAndamento ? (
        <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={onAndamento}>
          {TAREFA_BOTAO_ANDAMENTO}
        </Button>
      ) : null}
      {tarefa.podeConcluir ? (
        <Button type="button" size="sm" variant="filled" disabled={busy} onClick={onConcluir}>
          {TAREFA_BOTAO_CONCLUIR}
        </Button>
      ) : null}
      {tarefa.podeCancelar ? (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancelar}>
          {TAREFA_BOTAO_CANCELAR}
        </Button>
      ) : null}
    </div>
  );
}

export function ChamadoTarefaHistoricoCabecalho({ podeVerHistorico }: { podeVerHistorico?: boolean }) {
  if (!podeVerHistorico) return null;
  return (
    <h4 className="text-[12px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{TAREFA_ABA_HISTORICO}</h4>
  );
}

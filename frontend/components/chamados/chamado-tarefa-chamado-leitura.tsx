import type { ChamadoTarefaChamadoLeitura } from '@/lib/chamado-tarefa';

export const BOTOES_GESTAO_CHAMADO = [
  'Editar chamado',
  'Mudar status',
  'Anexar',
  'Excluir anexo',
  'Comentar no histórico',
  'Encerrar chamado',
] as const;

export function ChamadoTarefaChamadoLeituraView({
  leitura,
}: {
  leitura: Pick<ChamadoTarefaChamadoLeitura, 'anexosAbertura' | 'historico' | 'somenteLeitura' | 'codigo'>;
}) {
  return (
    <section data-modo="via-tarefa" className="space-y-3 border-t border-[var(--line)] pt-3">
      <p className="text-[12px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
        Chamado {leitura.codigo} · somente leitura
      </p>

      <div className="space-y-1">
        <h4 className="text-[12px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Anexos do chamado</h4>
        {leitura.anexosAbertura.length ? (
          <ul className="space-y-1">
            {leitura.anexosAbertura.map((anexo) => (
              <li key={anexo.id} className="text-[12px] text-[var(--ink-2)]">
                {anexo.nome}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-[var(--ink-3)]">Nenhum anexo do chamado.</p>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-[12px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Histórico do chamado</h4>
        {leitura.historico.length ? (
          <ol className="space-y-2">
            {leitura.historico.map((item) => (
              <li key={item.id} className="rounded-[10px] bg-[var(--surface-2)] p-2 text-[12px]">
                <p className="font-semibold text-[var(--ink)]">{item.motivo || 'Registro'}</p>
                <p className="text-[var(--ink-3)]">
                  {[new Date(item.createdAt).toLocaleString('pt-BR'), item.alteradoPor?.nome].filter(Boolean).join(' · ')}
                </p>
                {item.anexos?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {item.anexos.map((anexo) => (
                      <li key={anexo.id}>{anexo.nome || anexo.descricao || 'Anexo'}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px] text-[var(--ink-3)]">Nenhum registro no histórico do chamado.</p>
        )}
      </div>
    </section>
  );
}

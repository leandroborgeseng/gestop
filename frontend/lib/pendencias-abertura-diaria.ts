/**
 * 289: abertura automática diária do modal de Pendências (lado do front).
 * - O SERVIDOR decide (`abrir`); o front nunca abre sozinho.
 * - Uma chamada por carregamento de página + uma a cada volta para `visible`.
 * - Navegação interna NÃO chama o endpoint; só entrega um modal adiado.
 * - Adiado (outro modal aberto / formulário com alteração): fica na memória da aba e abre
 *   no primeiro destes: o outro modal fechar, o form ser salvo/descartado ou a próxima navegação.
 */
export type ResultadoAberturaDiaria<R> = { abrir: boolean; pendencias: R };

export type DepsAberturaDiaria<R> = {
  verificar: () => Promise<ResultadoAberturaDiaria<R>>;
  /** true quando há outro modal aberto ou formulário com alteração não salva. */
  bloqueado: () => boolean;
  abrir: (pendencias: R) => void;
};

export function criarAberturaDiaria<R>(deps: DepsAberturaDiaria<R>) {
  let verificouNoCarregamento = false;
  let emVoo: Promise<void> | null = null;
  let adiado: R | null = null;

  function entregar() {
    if (adiado === null) return false;
    if (deps.bloqueado()) return false;
    const pendencias = adiado;
    adiado = null;
    deps.abrir(pendencias);
    return true;
  }

  function verificar() {
    if (emVoo) return emVoo;
    emVoo = deps
      .verificar()
      .then((resultado) => {
        if (resultado.abrir) {
          adiado = resultado.pendencias;
          entregar();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        emVoo = null;
      });
    return emVoo;
  }

  return {
    /** Montagem do shell. Só a 1ª vez por carregamento de página chama o servidor. */
    aoCarregar() {
      if (verificouNoCarregamento) return Promise.resolve();
      verificouNoCarregamento = true;
      return verificar();
    },
    /** `visibilitychange`: só quando volta a `visible`; quem decide abrir é o servidor. */
    aoMudarVisibilidade(estado: string) {
      if (estado !== 'visible') return Promise.resolve();
      return verificar();
    },
    /** Navegação interna: não chama o endpoint; só entrega o adiado, se houver. */
    aoNavegar() {
      return entregar();
    },
    /** Outro modal fechou ou o form foi salvo/descartado. */
    aoLiberarBloqueio() {
      return entregar();
    },
    temAdiado() {
      return adiado !== null;
    },
  };
}

export type AberturaDiaria<R> = ReturnType<typeof criarAberturaDiaria<R>>;

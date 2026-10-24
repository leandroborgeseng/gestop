/**
 * 309 ajuste 2 — quando o app tenta sincronizar a fila sozinho:
 * - 1 tentativa ao ABRIR, se a fila já carregou, há itens e está online;
 * - 1 tentativa a cada VOLTA da conexão (offline → online), se há itens;
 * - nunca duas ao mesmo tempo (requisição em andamento) e nada de laço: mudar outro estado não dispara de novo.
 * Guardado num useRef: o duplo mount do React strict mode reaproveita a mesma instância e não repete a abertura.
 */
export type MotivoAutoSync = 'ABERTURA' | 'RECONEXAO';

export function criarAutoSync(executar: (motivo: MotivoAutoSync) => Promise<unknown>) {
  let tentouAbertura = false;
  let ultimoOnline: boolean | null = null;
  let emAndamento = false;

  function disparar(motivo: MotivoAutoSync) {
    if (emAndamento) return false;
    emAndamento = true;
    void Promise.resolve()
      .then(() => executar(motivo))
      .catch(() => undefined)
      .finally(() => {
        emAndamento = false;
      });
    return true;
  }

  return {
    /** Chamar quando `online`, o carregamento da fila ou a fila mudarem. Devolve o motivo se disparou. */
    avaliar(estado: { online: boolean; filaCarregada: boolean; temItens: boolean }): MotivoAutoSync | null {
      const anterior = ultimoOnline;
      if (!estado.filaCarregada) return null;
      ultimoOnline = estado.online;
      if (!estado.online || !estado.temItens) {
        if (estado.online) tentouAbertura = true; // abriu online sem itens: não há "abertura" pendente
        return null;
      }
      if (!tentouAbertura) {
        tentouAbertura = true;
        return disparar('ABERTURA') ? 'ABERTURA' : null;
      }
      if (anterior === false) return disparar('RECONEXAO') ? 'RECONEXAO' : null;
      return null;
    },
    get emAndamento() {
      return emAndamento;
    },
  };
}

/**
 * 289 (Designer): o modal automático não cobre outro modal aberto nem formulário com alteração
 * não salva. Detecção genérica por DOM, sem exigir que cada tela se registre.
 */
type ElementoMin = {
  closest(seletor: string): ElementoMin | null;
  isConnected?: boolean;
};
type DocumentoMin = {
  querySelectorAll(seletor: string): ArrayLike<ElementoMin>;
};

/** Há um diálogo modal aberto que não é o de Pendências? */
export function haOutroModalAberto(doc: DocumentoMin) {
  const dialogs = Array.from(doc.querySelectorAll('[role="dialog"][aria-modal="true"]'));
  return dialogs.some((el) => !el.closest('[data-pendencias-overlay]'));
}

/** Formulários com alteração não salva (marcados por input/change; liberados por submit/reset/remoção). */
export function criarRastreioFormularios() {
  const sujos = new Set<ElementoMin>();
  return {
    aoEditar(alvo: ElementoMin | null) {
      const form = alvo?.closest('form') ?? null;
      if (form) sujos.add(form);
    },
    /** submit (salvar) ou reset (descartar). Devolve true se liberou algo. */
    aoSalvarOuDescartar(form: ElementoMin | null) {
      return form ? sujos.delete(form) : false;
    },
    /** Form removido do DOM (Cancelar fecha o painel) conta como descartado. */
    podarDesconectados() {
      let liberou = false;
      for (const form of sujos) {
        if (form.isConnected === false) {
          sujos.delete(form);
          liberou = true;
        }
      }
      return liberou;
    },
    haFormularioSujo() {
      return sujos.size > 0;
    },
  };
}

type FocavelMin = { focus(): void; isConnected?: boolean };

/** Foco: no título ao abrir; devolve ao elemento anterior ao fechar. */
export function criarControleFoco(doc: { activeElement: unknown; getElementById(id: string): FocavelMin | null }) {
  let anterior: FocavelMin | null = null;
  return {
    aoAbrir(tituloId: string) {
      const ativo = doc.activeElement as FocavelMin | null;
      anterior = ativo && typeof ativo.focus === 'function' ? ativo : null;
      doc.getElementById(tituloId)?.focus();
    },
    aoFechar() {
      const alvo = anterior;
      anterior = null;
      if (alvo && alvo.isConnected !== false) alvo.focus();
    },
  };
}

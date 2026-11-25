import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

/** Classe mínima de texto dos campos em modo somente leitura (nota de UX do 292: nunca abaixo de `--ink-3`). */
export const CLASSE_SOMENTE_LEITURA = [
  // texto AA sobre fundo neutro (testado contra globals.css)
  'text-[var(--ink-3)] bg-[var(--surface-2)]',
  // sem aparência de campo ativo: borda e sombra não reagem a hover/foco
  'hover:border-[var(--line)] focus:border-[var(--line)] focus:shadow-none',
  // texto continua selecionável/copiável
  'cursor-text select-text',
].join(' ');

/**
 * Atributos dos campos do formulário de próprio. Somente leitura usa `readOnly`
 * (focável, legível, copiável), nunca `disabled`.
 */
export function atributosCampoProprio(somenteLeitura: boolean) {
  return somenteLeitura
    ? ({ readOnly: true, 'aria-readonly': true, className: CLASSE_SOMENTE_LEITURA } as const)
    : ({} as const);
}

export function tituloSheetProprio(nome: string | null | undefined, podeSalvar: boolean) {
  if (!podeSalvar) return nome ? `Visualizar próprio — ${nome}` : 'Visualizar próprio';
  return nome ? `Editar — ${nome}` : 'Editar próprio';
}

export function RodapeSheetProprio({
  podeSalvar,
  formId,
  onClose,
}: {
  podeSalvar: boolean;
  formId: string;
  onClose: () => void;
}) {
  if (!podeSalvar) {
    return (
      <div className="flex gap-2">
        <Button type="button" variant="outlined" className="flex-1" onClick={onClose}>
          Fechar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button type="submit" form={formId} variant="filled" className="flex-1">
        Salvar alterações
      </Button>
      <Button type="button" variant="outlined" onClick={onClose}>
        Cancelar
      </Button>
    </div>
  );
}

export type OpcaoCampo = { value: string; label: string };

/**
 * Select que, em somente leitura, vira um `Input readOnly` com o rótulo da opção
 * e um `input hidden` com o valor (o `<select>` não aceita `readOnly`).
 * O valor sempre entra no FormData.
 */
export function CampoSelecaoProprio({
  name,
  value,
  opcoes,
  somenteLeitura,
  required,
  children,
}: {
  name: string;
  value: string;
  opcoes: OpcaoCampo[];
  somenteLeitura: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  if (somenteLeitura) {
    const rotulo = opcoes.find((o) => o.value === value)?.label ?? value;
    return (
      <>
        <input type="hidden" name={name} value={value} />
        <Input defaultValue={rotulo} {...atributosCampoProprio(true)} />
      </>
    );
  }
  return (
    <Select name={name} defaultValue={value} required={required}>
      {children}
    </Select>
  );
}

/**
 * Campo Secretaria do próprio. Travado na secretaria ativa: mostra o rótulo num
 * `Input readOnly` e envia o id num `input hidden` (o `select disabled` não entrava
 * no FormData). O payload continua passando por `secretariaIdDoFormulario`.
 */
export function CampoSecretariaProprio({
  travada,
  valor,
  opcoes,
  somenteLeitura = false,
}: {
  travada: boolean;
  valor: string;
  opcoes: OpcaoCampo[];
  somenteLeitura?: boolean;
}) {
  if (travada || somenteLeitura) {
    const rotulo = opcoes.find((o) => o.value === valor)?.label ?? valor;
    return (
      <>
        <input type="hidden" name="secretariaId" value={valor} />
        <Input defaultValue={rotulo} {...atributosCampoProprio(true)} />
      </>
    );
  }
  return (
    <Select name="secretariaId" defaultValue={valor} required>
      {opcoes.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

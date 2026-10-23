/** 307 — regras puras dos responsáveis do cronograma (agrupamento, situação e regularização). */
import type { ResponsavelCronogramaOpcao, SecretariaOption, SituacaoResponsavel } from '@/lib/types';

export const ROTULO_SITUACAO: Record<Exclude<SituacaoResponsavel, 'OK'>, string> = {
  INATIVO: 'Inativo',
  OUTRA_SECRETARIA: 'Outra Secretaria',
};

export const DICA_FORA_ESCOPO = 'Este responsável não pertence mais à Secretaria ativa';
export const MSG_REGULARIZAR = 'Remova ou substitua os responsáveis destacados para salvar';

export function avisoRegularizacao(n: number) {
  return n === 1 ? '1 responsável precisa ser regularizado.' : `${n} responsáveis precisam ser regularizados.`;
}

export type GrupoResponsaveis = { chave: string; titulo: string | null; usuarios: ResponsavelCronogramaOpcao[] };

function secretariasDe(u: ResponsavelCronogramaOpcao): SecretariaOption[] {
  if (u.secretarias?.length) return u.secretarias;
  return u.secretaria ? [u.secretaria] : [];
}

/** Rótulo secundário: Secretarias do usuário (em "Todas"), sem repetir. */
export function siglasDe(u: ResponsavelCronogramaOpcao) {
  return secretariasDe(u).map((s) => s.sigla).join(', ');
}

/**
 * Remove duplicados (mesmo id) e, em "Todas", agrupa pela 1ª Secretaria (ordem de sigla).
 * Quem tem vários vínculos aparece UMA vez, com as Secretarias listadas.
 */
export function agruparResponsaveis(rows: ResponsavelCronogramaOpcao[], todas: boolean): GrupoResponsaveis[] {
  const unicos = [...new Map(rows.map((u) => [u.id, u])).values()];
  if (!todas) return [{ chave: 'lista', titulo: null, usuarios: unicos }];
  const grupos = new Map<string, GrupoResponsaveis>();
  for (const u of unicos) {
    const sec = [...secretariasDe(u)].sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR'))[0];
    const chave = sec?.id ?? 'sem';
    if (!grupos.has(chave)) grupos.set(chave, { chave, titulo: sec?.sigla ?? 'Sem Secretaria', usuarios: [] });
    grupos.get(chave)!.usuarios.push(u);
  }
  return [...grupos.values()].sort((a, b) => (a.titulo ?? '').localeCompare(b.titulo ?? '', 'pt-BR'));
}

/** Responsáveis selecionados que não estão OK no escopo atual. */
export function pendentesRegularizacao(
  selectedIds: string[],
  situacoes: Record<string, SituacaoResponsavel | undefined>,
) {
  return selectedIds.filter((id) => situacoes[id] && situacoes[id] !== 'OK');
}

/**
 * R5: depois de trocar o contexto com o modal aberto, salvar exige regularizar — remover os destacados
 * ou confirmar explicitamente que ficam. Sem troca de contexto (R4), os destacados só são sinalizados.
 */
export function bloqueioSalvar(input: { pendentes: number; escopoTrocado: boolean; confirmado: boolean }) {
  return input.escopoTrocado && input.pendentes > 0 && !input.confirmado;
}

/**
 * 309 (e base para o 308) — padrão comum de cadastro com inativação lógica:
 * somente leitura quando inativo, Inativar/Reativar com permissão e auditoria (quem, quando, antes e depois).
 * Nada aqui apaga registro: inativar é só `ativo = false`.
 */
import { ConflictException } from '@nestjs/common';

export type AcaoStatusAtivo = 'INATIVAR' | 'REATIVAR';

export type EntidadeInativavel = {
  /** Ex.: "Este checklist está inativo. Reative o modelo para realizar alterações" */
  mensagemSomenteLeitura: string;
  /** Ex.: "Este checklist está inativo e não pode iniciar vistoria, documento ou aplicação nova." */
  mensagemNaoInicia: string;
  jaAtivo: string;
  jaInativo: string;
};

export const CHECKLIST_INATIVO: EntidadeInativavel = {
  mensagemSomenteLeitura: 'Este checklist está inativo. Reative o modelo para realizar alterações',
  mensagemNaoInicia: 'Este checklist está inativo e não pode iniciar vistoria, documento ou aplicação nova.',
  jaAtivo: 'Este checklist já está ativo.',
  jaInativo: 'Este checklist já está inativo.',
};

export class RegistroInativoException extends ConflictException {
  constructor(message: string) {
    super({ statusCode: 409, error: 'Conflict', code: 'REGISTRO_INATIVO', message });
  }
}

/** Somente leitura no backend: qualquer alteração em registro inativo responde 409 com a mensagem da entidade. */
export function assertRegistroEditavel(registro: { ativo: boolean }, entidade: EntidadeInativavel): void {
  if (!registro.ativo) throw new RegistroInativoException(entidade.mensagemSomenteLeitura);
}

/** Registro inativo não inicia uso novo (vistoria, documento, aplicação). Os já existentes não são tocados. */
export function assertRegistroPodeIniciar(registro: { ativo: boolean }, entidade: EntidadeInativavel): void {
  if (!registro.ativo) throw new RegistroInativoException(entidade.mensagemNaoInicia);
}

/** Valida a transição e devolve o novo valor de `ativo`. Repetir a mesma ação responde 409 (não gera auditoria duplicada). */
export function planejarStatusAtivo(atual: boolean, acao: AcaoStatusAtivo, entidade: EntidadeInativavel): boolean {
  if (acao === 'INATIVAR' && !atual) throw new ConflictException(entidade.jaInativo);
  if (acao === 'REATIVAR' && atual) throw new ConflictException(entidade.jaAtivo);
  return acao === 'REATIVAR';
}

/** Payload de auditoria comum (quem, quando, antes e depois). */
export function auditoriaStatusAtivo(input: {
  acao: AcaoStatusAtivo;
  usuarioId: string;
  quando: Date;
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
}) {
  const base = { evento: input.acao, usuarioId: input.usuarioId, em: input.quando.toISOString() };
  return {
    valorAntigo: { ...base, ...input.antes },
    valorNovo: { ...base, ...input.depois },
  };
}

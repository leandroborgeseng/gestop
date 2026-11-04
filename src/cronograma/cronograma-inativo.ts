/** 308 (decisões do TL no PR #47): regras de Reativar e de par próprio + checklist já existente. */
import { ConflictException } from '@nestjs/common';

export const MSG_CRONOGRAMA_INATIVO_EXISTENTE = 'Já existe um cronograma inativo para este próprio e checklist';
export const MSG_CRONOGRAMA_EXISTENTE = 'Já existe um cronograma para este próprio e checklist';

export type DependenciaInativa = 'PROPRIO' | 'CHECKLIST';

export function dependenciasInativas(c: { unidade: { ativo?: boolean | null }; checklist: { ativo?: boolean | null } }): DependenciaInativa[] {
  const out: DependenciaInativa[] = [];
  if (c.unidade.ativo === false) out.push('PROPRIO');
  if (c.checklist.ativo === false) out.push('CHECKLIST');
  return out;
}

export function mensagemDependenciasInativas(
  deps: DependenciaInativa[],
  nomes: { proprio: string; checklist: string },
): string {
  if (deps.length > 1) {
    return `Não é possível reativar: o próprio "${nomes.proprio}" e o checklist "${nomes.checklist}" estão inativos. Reative os dois primeiro.`;
  }
  return deps[0] === 'PROPRIO'
    ? `Não é possível reativar: o próprio "${nomes.proprio}" está inativo. Reative o próprio primeiro.`
    : `Não é possível reativar: o checklist "${nomes.checklist}" está inativo. Reative o checklist primeiro.`;
}

/** Reativar exige próprio e checklist ativos; 409 diz qual reativar antes. */
export function assertDependenciasAtivas(c: {
  unidade: { ativo?: boolean | null; nome: string };
  checklist: { ativo?: boolean | null; nome: string };
}) {
  const deps = dependenciasInativas(c);
  if (!deps.length) return;
  throw new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    codigo: 'DEPENDENCIA_INATIVA',
    dependencias: deps,
    message: mensagemDependenciasInativas(deps, { proprio: c.unidade.nome, checklist: c.checklist.nome }),
  });
}

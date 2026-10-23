/**
 * 307 — responsáveis do cronograma no escopo de Secretaria da sessão (mesma função de escopo do 306).
 * Um usuário está no escopo se a Secretaria principal OU algum vínculo (UsuarioSecretaria) está no escopo.
 */
import { Prisma } from '@prisma/client';

export type SituacaoResponsavel = 'OK' | 'INATIVO' | 'OUTRA_SECRETARIA';

export type SecretariaResumo = { id: string; nome: string; sigla: string };

export const usuarioResponsavelSelect = {
  id: true,
  nome: true,
  email: true,
  ativo: true,
  cargo: true,
  cargoRef: { select: { id: true, nome: true } },
  secretaria: { select: { id: true, nome: true, sigla: true } },
  secretariasVinculos: { select: { secretaria: { select: { id: true, nome: true, sigla: true } } } },
} satisfies Prisma.UsuarioSelect;

export type UsuarioResponsavelRow = Prisma.UsuarioGetPayload<{ select: typeof usuarioResponsavelSelect }>;

/** `ids === undefined` = global (sem filtro); `[]` = nenhum usuário. */
export function whereUsuarioNoEscopo(ids: string[] | undefined): Prisma.UsuarioWhereInput {
  if (!ids) return {};
  if (ids.length === 0) return { id: { in: [] } };
  return {
    OR: [{ secretariaId: { in: ids } }, { secretariasVinculos: { some: { secretariaId: { in: ids } } } }],
  };
}

/** Secretarias do usuário (principal + vínculos), sem repetir, ordenadas por sigla. */
export function secretariasDoUsuario(u: Pick<UsuarioResponsavelRow, 'secretaria' | 'secretariasVinculos'>): SecretariaResumo[] {
  const mapa = new Map<string, SecretariaResumo>();
  if (u.secretaria) mapa.set(u.secretaria.id, u.secretaria);
  for (const v of u.secretariasVinculos ?? []) mapa.set(v.secretaria.id, v.secretaria);
  return [...mapa.values()].sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR'));
}

export function situacaoResponsavel(
  u: Pick<UsuarioResponsavelRow, 'ativo' | 'secretaria' | 'secretariasVinculos'>,
  scopeIds: string[] | undefined,
): SituacaoResponsavel {
  if (!u.ativo) return 'INATIVO';
  if (!scopeIds) return 'OK';
  return secretariasDoUsuario(u).some((s) => scopeIds.includes(s.id)) ? 'OK' : 'OUTRA_SECRETARIA';
}

/** Formato devolvido ao front (opções e situação). Secretarias limitadas ao escopo quando houver escopo. */
export function responsavelOpcao(u: UsuarioResponsavelRow, scopeIds: string[] | undefined) {
  const todas = secretariasDoUsuario(u);
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cpf: null,
    cargo: u.cargo,
    cargoRef: u.cargoRef,
    ativo: u.ativo,
    // Ciclo 2 (F3): a Secretaria principal só aparece se estiver no escopo de quem consulta.
    secretaria: u.secretaria && (!scopeIds || scopeIds.includes(u.secretaria.id)) ? u.secretaria : null,
    secretarias: scopeIds ? todas.filter((s) => scopeIds.includes(s.id)) : todas,
    situacao: situacaoResponsavel(u, scopeIds),
  };
}

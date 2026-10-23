import { Prisma } from '@prisma/client';
import { whereSecretariaIdIn } from '../auth/secretaria-scope';

/**
 * 306 — filtros de Secretaria por entidade, todos a partir do MESMO escopo efetivo
 * (`resolveSecretariaFiltroEscopo`). `ids === undefined` = global sem filtro.
 * - Chamados: Secretaria executora (`chamado.secretariaId`).
 * - Vistorias: Secretaria da vistoria (`fiscalizacao.secretariaId`).
 * - Próprios: Secretaria do próprio (`unidade.secretariaId`).
 * - Não conformidades: Secretaria da vistoria de origem (o model não tem `secretariaId`).
 * - Sync: Secretaria (principal ou vínculo) do usuário que gerou o evento.
 * - Auditoria: Secretaria ativa registrada no log.
 */
export function escopoDashboard(ids: string[] | undefined) {
  return {
    ids,
    chamado: (): Prisma.ChamadoWhereInput => whereSecretariaIdIn(ids),
    fiscalizacao: (): Prisma.FiscalizacaoWhereInput => whereSecretariaIdIn(ids),
    unidade: (): Prisma.UnidadePublicaWhereInput => whereSecretariaIdIn(ids),
    naoConformidade: (): Prisma.NaoConformidadeWhereInput =>
      ids ? { fiscalizacao: { secretariaId: { in: ids } } } : {},
    secretaria: (): Prisma.SecretariaWhereInput => (ids ? { id: { in: ids } } : {}),
    syncEvent: (): Prisma.OfflineSyncEventWhereInput =>
      ids
        ? {
            usuario: {
              OR: [{ secretariaId: { in: ids } }, { secretariasVinculos: { some: { secretariaId: { in: ids } } } }],
            },
          }
        : {},
    auditoria: (): Prisma.LogAuditoriaWhereInput => (ids ? { secretariaAtivaId: { in: ids } } : {}),
  };
}

export type EscopoDashboard = ReturnType<typeof escopoDashboard>;

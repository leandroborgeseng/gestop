import { PrismaClient } from '@prisma/client';
import { catalogEntryForKey, listCatalogMatrixKeys } from '../domain/permissions-catalog';

export async function syncPermissionsCatalog(prisma: PrismaClient) {
  const entries = listCatalogMatrixKeys().map((chave) => {
    const entry = catalogEntryForKey(chave);
    const descricao = entry
      ? `${entry.tela.label} · ${entry.funcao.label} · ${entry.acao}`
      : chave;
    return {
      chave,
      descricao,
      modulo: entry?.tela.id ?? 'matriz',
    };
  });

  entries.push({
    chave: 'permissoes.gerenciar',
    descricao: 'Configurar permissões por perfil',
    modulo: 'permissoes',
  });

  for (const entry of entries) {
    await prisma.permissao.upsert({
      where: { chave: entry.chave },
      update: { descricao: entry.descricao, modulo: entry.modulo },
      create: entry,
    });
  }

  return entries.length;
}

import { PrismaClient } from '@prisma/client';
import { catalogActionLabel, catalogEntryForKey, listCatalogMatrixKeys } from '../domain/permissions-catalog';

export type PermissaoCatalogo = {
  chave: string;
  descricao: string;
  modulo: string;
};

export function listPermissionsCatalogEntries(): PermissaoCatalogo[] {
  const entries = listCatalogMatrixKeys().map((chave) => {
    const entry = catalogEntryForKey(chave);
    const descricao = entry
      ? `${entry.tela.label} · ${catalogActionLabel(entry.funcao, entry.acao)}`
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

  entries.push({
    chave: 'chamados.abrir',
    descricao: 'Abrir novo chamado (sem acesso à triagem)',
    modulo: 'chamados',
  });

  entries.push({
    chave: 'meus_chamados.visualizar',
    descricao: 'Visualizar chamados abertos por mim ou em que sou observador',
    modulo: 'meus_chamados',
  });

  entries.push(
    {
      chave: 'cronograma.visualizar',
      descricao: 'Visualizar tela Cronograma',
      modulo: 'cronograma',
    },
    {
      chave: 'cronograma.inserir',
      descricao: 'Criar cronograma de checagem',
      modulo: 'cronograma',
    },
    {
      chave: 'cronograma.alterar',
      descricao: 'Editar cronograma de checagem',
      modulo: 'cronograma',
    },
    {
      chave: 'cronograma.excluir',
      descricao: 'Inativar ou excluir cronograma',
      modulo: 'cronograma',
    },
    {
      chave: 'cronograma.executar',
      descricao: 'Executar ações operacionais do Cronograma (ex.: cobertura)',
      modulo: 'cronograma',
    },
  );

  entries.push(
    {
      chave: 'documentos.visualizar',
      descricao: 'Visualizar documentos do módulo Documentos',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.criar_avulso',
      descricao: 'Criar documento avulso',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.editar_vinculo',
      descricao: 'Editar vínculos de documento',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.gerar_pdf',
      descricao: 'Gerar e visualizar PDF de documento',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.coletar_assinatura',
      descricao: 'Coletar assinatura de documento',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.assinar_interno',
      descricao: 'Assinar documento internamente com usuário e senha',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.disponibilizar_assinatura',
      descricao: 'Disponibilizar documento para assinatura interna',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.cancelar_assinado',
      descricao: 'Cancelar PDF assinado',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.cancelar',
      descricao: 'Cancelar documento (cancelamento lógico)',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.administrar',
      descricao: 'Administrar documentos',
      modulo: 'documentos',
    },
  );

  return entries;
}

/** Cria chaves ausentes. Não altera descrição nem módulo do que já existe. */
export async function ensurePermissoesCreateOnly(prisma: PrismaClient, entries: readonly PermissaoCatalogo[]) {
  if (entries.length === 0) return 0;
  const existing = await prisma.permissao.findMany({
    where: { chave: { in: entries.map((entry) => entry.chave) } },
    select: { chave: true },
  });
  const have = new Set(existing.map((entry) => entry.chave));
  const missing = entries.filter((entry) => !have.has(entry.chave));
  if (missing.length > 0) {
    await prisma.permissao.createMany({ data: [...missing] });
  }
  return missing.length;
}

/** Boot: só insere permissão nova. Descrição já gravada permanece. */
export async function ensurePermissionsCatalog(prisma: PrismaClient) {
  const entries = listPermissionsCatalogEntries();
  const created = await ensurePermissoesCreateOnly(prisma, entries);
  return { total: entries.length, created };
}

export async function syncPermissionsCatalog(prisma: PrismaClient) {
  const entries = listPermissionsCatalogEntries();

  for (const entry of entries) {
    await prisma.permissao.upsert({
      where: { chave: entry.chave },
      update: { descricao: entry.descricao, modulo: entry.modulo },
      create: entry,
    });
  }

  return entries.length;
}

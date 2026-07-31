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
      chave: 'documentos.cancelar_assinado',
      descricao: 'Cancelar PDF assinado',
      modulo: 'documentos',
    },
    {
      chave: 'documentos.administrar',
      descricao: 'Administrar documentos',
      modulo: 'documentos',
    },
  );

  for (const entry of entries) {
    await prisma.permissao.upsert({
      where: { chave: entry.chave },
      update: { descricao: entry.descricao, modulo: entry.modulo },
      create: entry,
    });
  }

  return entries.length;
}

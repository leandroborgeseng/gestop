import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt';
import { chavesEfetivasDaSessao, ehAdministradorSistema, sessaoTemEscopoSecretaria } from '../auth/matriz/avaliar-matriz';
import { negarAcesso } from '../auth/matriz/matriz-permissoes.guard';
import { chaveMatriz } from '../auth/matriz/permissoes-matriz';
import { resolveChamadoSecretariaFilter, resolveSecretariaScopeIds } from '../auth/secretaria-scope';
import { PrismaService } from '../prisma/prisma.service';

/** Chaves (qualquer uma) para visualizar arquivos de cada rotina dona. */
export const STORAGE_VER_CHAMADO = [
  chaveMatriz('chamados', '_tela', 'visualizar'),
  chaveMatriz('execucao', '_tela', 'visualizar'),
  chaveMatriz('meus_chamados', 'fotos_abertura', 'visualizar'),
  chaveMatriz('meus_chamados', 'evidencias_execucao', 'visualizar'),
  chaveMatriz('meus_chamados', 'evidencias_registradas', 'visualizar'),
];
export const STORAGE_VER_TAREFA = [
  chaveMatriz('chamados', 'tarefas', 'visualizar'),
  chaveMatriz('chamados', 'tarefas_historico', 'visualizar'),
  chaveMatriz('chamados', 'tarefas_atribuidas', 'visualizar'),
  chaveMatriz('execucao', 'tarefas', 'visualizar'),
];
export const STORAGE_VER_VISTORIA = [
  chaveMatriz('vistorias', '_tela', 'visualizar'),
  chaveMatriz('vistorias', 'consultar', 'visualizar'),
  chaveMatriz('vistoria_campo', '_tela', 'visualizar'),
];
export const STORAGE_VER_DOCUMENTO = [
  chaveMatriz('documentos', '_tela', 'visualizar'),
  chaveMatriz('documentos', 'consultar', 'visualizar'),
  chaveMatriz('meus_chamados', 'consultar_documentos', 'visualizar'),
];

type Dono =
  | { tipo: 'chamado'; chamadoId: string }
  | { tipo: 'tarefa'; chamadoId: string }
  | { tipo: 'vistoria'; secretariaId: string }
  | { tipo: 'documento'; secretariaId: string }
  | { tipo: 'prefixo'; rotina: 'chamado' | 'documento' }
  | null;

/**
 * 285: GET /storage confere permissão de visualizar a rotina dona do arquivo e o escopo
 * de Secretaria do registro dono. Sem dono identificado → 403.
 */
@Injectable()
export class StorageAcessoService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPodeBaixar(user: JwtPayload | undefined, storageKey: string) {
    if (!user) negarAcesso();
    if (ehAdministradorSistema(user)) return;
    const dono = await this.resolverDono(storageKey);
    if (!dono) negarAcesso();
    const efetivas = chavesEfetivasDaSessao(user);
    const tem = (chaves: string[]) => chaves.some((chave) => efetivas.has(chave));

    switch (dono.tipo) {
      case 'chamado':
      case 'tarefa': {
        if (!tem(dono.tipo === 'tarefa' ? [...STORAGE_VER_TAREFA, ...STORAGE_VER_CHAMADO] : STORAGE_VER_CHAMADO)) negarAcesso();
        const visivel = await this.prisma.chamado.count({
          where: { AND: [{ id: dono.chamadoId }, resolveChamadoSecretariaFilter(user)] },
        });
        if (visivel === 0) negarAcesso();
        return;
      }
      case 'vistoria':
        if (!tem(STORAGE_VER_VISTORIA)) negarAcesso();
        if (!secretariaNoEscopo(user, dono.secretariaId)) negarAcesso();
        return;
      case 'documento':
        if (!tem(STORAGE_VER_DOCUMENTO)) negarAcesso();
        if (!secretariaNoEscopo(user, dono.secretariaId)) negarAcesso();
        return;
      case 'prefixo':
        // Arquivo sem registro indexado (ex.: anexo guardado só em JSON): exige a permissão
        // da rotina e escopo de Secretaria na sessão.
        if (!tem(dono.rotina === 'documento' ? STORAGE_VER_DOCUMENTO : STORAGE_VER_CHAMADO)) negarAcesso();
        if (!sessaoTemEscopoSecretaria(user)) negarAcesso();
        return;
    }
  }

  async resolverDono(storageKey: string): Promise<Dono> {
    const porChaveOuUrl = { OR: [{ storageKey }, { url: { endsWith: `/${storageKey}` } }] };

    const evidencia = await this.prisma.evidencia.findFirst({
      where: porChaveOuUrl,
      select: {
        chamadoId: true,
        fiscalizacao: { select: { secretariaId: true } },
        resposta: { select: { fiscalizacao: { select: { secretariaId: true } } } },
      },
    });
    if (evidencia?.chamadoId) return { tipo: 'chamado', chamadoId: evidencia.chamadoId };
    const secretariaVistoria = evidencia?.fiscalizacao?.secretariaId ?? evidencia?.resposta?.fiscalizacao?.secretariaId;
    if (secretariaVistoria) return { tipo: 'vistoria', secretariaId: secretariaVistoria };

    const anexoTarefa = await this.prisma.chamadoTarefaAnexo.findFirst({
      where: porChaveOuUrl,
      select: { tarefa: { select: { chamadoId: true } } },
    });
    if (anexoTarefa?.tarefa?.chamadoId) return { tipo: 'tarefa', chamadoId: anexoTarefa.tarefa.chamadoId };

    const documento = await this.prisma.documento.findFirst({
      where: { OR: [{ pdfOriginalStorageKey: storageKey }, { pdfAssinadoStorageKey: storageKey }] },
      select: { secretariaId: true },
    });
    if (documento) return { tipo: 'documento', secretariaId: documento.secretariaId };

    if (storageKey.startsWith('documentos/')) return { tipo: 'prefixo', rotina: 'documento' };
    if (storageKey.startsWith('evidencias/')) return { tipo: 'prefixo', rotina: 'chamado' };
    return null;
  }
}

function secretariaNoEscopo(user: JwtPayload, secretariaId: string) {
  const ids = resolveSecretariaScopeIds(user);
  return ids === undefined || ids.includes(secretariaId);
}

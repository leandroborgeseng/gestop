import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChamadosService } from './chamados.service';
import { extrairTextoPdf } from '../checklists/pdf-texto';
import type { JwtPayload } from '../auth/jwt';

function makeService() {
  const prisma = {
    evidencia: { findMany: vi.fn().mockResolvedValue([]) },
    checklistVersao: { findUnique: vi.fn() },
  };
  const service = new ChamadosService(
    prisma as never,
    {} as never,
    { readObjectBuffer: vi.fn() } as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

const user: JwtPayload = {
  sub: 'u1',
  email: 'joao@example.com',
  nome: 'João',
  perfis: [],
  permissoes: [],
};

const respostas = [
  {
    codigo: 'ZZ-COD-001',
    titulo: 'Estado das paredes internas',
    tipo: 'MULTIPLA_ESCOLHA',
    valorTexto: '["Bom","Ótimo"]',
  },
  {
    codigo: 'ZZ-COD-002',
    titulo: 'Estado do piso',
    tipo: 'MULTIPLA_ESCOLHA',
    valorTexto: 'Regular',
  },
  {
    codigo: 'ZZ-COD-004',
    titulo: 'Observações gerais adicionais',
    tipo: 'TEXTO',
    valorTexto: 'Escola bem mantida no geral.',
  },
];

describe('ChamadosService apresenta respostas da execução formatadas', () => {
  it('P15 formatExecucaoRespostaTexto: JSON, única e texto livre', () => {
    const { service } = makeService();
    const format = (
      service as unknown as {
        formatExecucaoRespostaTexto: (item: { valorTexto?: string | null }) => string;
      }
    ).formatExecucaoRespostaTexto.bind(service);

    expect(format({ valorTexto: '["Bom","Ótimo"]' })).toBe('Bom, Ótimo');
    expect(format({ valorTexto: 'Regular' })).toBe('Regular');
    expect(format({ valorTexto: 'Escola bem mantida no geral.' })).toBe('Escola bem mantida no geral.');
  });

  it('monta o PDF de execução com valor formatado', async () => {
    const { service } = makeService();
    const buffer = await (
      service as unknown as {
        buildRelatorioExecucaoPdfBuffer: (
          chamado: Record<string, unknown>,
          user: JwtPayload,
          opts: Record<string, unknown>,
          documentoCodigo?: string | null,
        ) => Promise<Buffer>;
      }
    ).buildRelatorioExecucaoPdfBuffer(
      {
        id: 'ch-1',
        codigo: 'CH-1',
        status: 'CONCLUIDO',
        secretaria: { nome: 'Educação', sigla: 'SEDUC' },
        unidade: { nome: 'Escola', codigoPatrimonial: 'EM-001', endereco: 'Rua 1' },
        enderecoTexto: 'Rua 1',
        tipoChamado: { nome: 'Manutenção' },
        responsavel: { nome: 'João' },
        equipe: { nome: 'Equipe' },
      },
      user,
      {
        relatorio: 'Feito',
        checklistNome: 'Checklist',
        checklistRespostas: respostas,
        origem: 'execucao_manual',
        evidenciaIds: [],
        executadoEm: '2026-10-05T14:30:00.000Z',
      },
      null,
    );

    const texto = await extrairTextoPdf(buffer);
    expect(texto).toContain('Bom, Ótimo');
    expect(texto).toContain('Regular');
    expect(texto).toContain('Escola bem mantida no geral.');
    expect(texto).not.toContain('["');
  });

  it('não usa valorTexto cru no formatador da execução (P15)', () => {
    const src = readFileSync(resolve('src/chamados/chamados.service.ts'), 'utf8');
    expect(src).toContain('return resolveRespostaTexto(item);');
    expect(src).not.toContain('item.valorTexto?.trim() || resolveRespostaTexto(item)');
  });
});

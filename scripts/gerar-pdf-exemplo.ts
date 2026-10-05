import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { buildVistoriaRealizadaPdf, type VistoriaRealizadaPdfInput } from '../src/fiscalizacoes/vistoria-realizada-pdf';

async function gerarPdfExemplo() {
  const input: VistoriaRealizadaPdfInput = {
    unidadeNome: 'Escola Municipal Exemplo',
    unidadeCodigoPatrimonial: 'EM-001',
    secretariaSigla: 'SEDUC',
    secretariaNome: 'Secretaria de Educação',
    endereco: 'Rua Exemplo, 123',
    bairro: 'Centro',
    checklistNome: 'Vistoria de Infraestrutura Escolar',
    checklistVersao: 2,
    dataHora: new Date('2026-10-05T14:30:00').toISOString(),
    origemLabel: 'App Mobile',
    realizadaPorLabel: 'João Silva',
    lancamentoManual: false,
    lancadoPorLabel: null,
    responsaveisPrevistosLabel: 'Equipe de Manutenção',
    observacoes: 'Vistoria realizada em período chuvoso. Algumas áreas necessitam de manutenção preventiva.',
    notaGeral: 7.8,
    notasPorCategoria: [
      { categoriaNome: 'Estrutura física', nota: 8.5 },
      { categoriaNome: 'Equipamentos', nota: 7.2 },
    ],
    respostas: [
      {
        codigo: 'INF-001',
        secao: 'Infraestrutura básica',
        titulo: 'Estado das paredes internas',
        categoriaNome: 'Estrutura física',
        tipo: 'MULTIPLA_ESCOLHA',
        respostaTexto: 'Bom, Ótimo',
        comentario: 'Apenas pequenos riscos nas paredes do corredor principal',
        conformidade: 'CONFORME',
        naoConformidade: null,
        evidencias: [],
      },
      {
        codigo: 'INF-002',
        secao: 'Infraestrutura básica',
        titulo: 'Estado do piso',
        categoriaNome: 'Estrutura física',
        tipo: 'MULTIPLA_ESCOLHA',
        respostaTexto: 'Regular',
        comentario: 'Piso com rachaduras em sala 3 e sala 5',
        conformidade: 'NAO_CONFORME',
        naoConformidade: {
          status: 'ABERTA',
          motivoBaixa: null,
          chamado: { codigo: '#12345', status: 'Em triagem' },
        },
        evidencias: [],
      },
      {
        codigo: 'INF-003',
        secao: 'Infraestrutura básica',
        titulo: 'Portas e janelas',
        categoriaNome: 'Estrutura física',
        tipo: 'MULTIPLA_ESCOLHA',
        respostaTexto: 'Bom',
        comentario: null,
        conformidade: 'CONFORME',
        naoConformidade: null,
        evidencias: [],
      },
      {
        codigo: 'EQUIP-001',
        secao: 'Equipamentos e mobiliário',
        titulo: 'Estado das carteiras',
        categoriaNome: 'Equipamentos',
        tipo: 'MULTIPLA_ESCOLHA',
        respostaTexto: 'Bom, Regular',
        comentario: '15 carteiras precisam de pequenos reparos',
        conformidade: 'CONFORME',
        naoConformidade: null,
        evidencias: [],
      },
      {
        codigo: 'EQUIP-002',
        secao: 'Equipamentos e mobiliário',
        titulo: 'Lousas e quadros',
        categoriaNome: 'Equipamentos',
        tipo: 'TEXTO',
        respostaTexto: 'Todas as lousas estão em bom estado',
        comentario: null,
        conformidade: null,
        naoConformidade: null,
        evidencias: [],
      },
      {
        codigo: 'OBS-001',
        secao: null,
        titulo: 'Observações gerais adicionais',
        categoriaNome: null,
        tipo: 'TEXTO',
        respostaTexto: 'Escola bem mantida no geral. Recomenda-se manutenção preventiva no piso.',
        comentario: null,
        conformidade: null,
        naoConformidade: null,
        evidencias: [],
      },
    ],
  };

  const pdfBuffer = await buildVistoriaRealizadaPdf(input);
  const outputPath = resolve(process.cwd(), 'vistoria-exemplo-depois.pdf');
  writeFileSync(outputPath, pdfBuffer);
  console.log(`PDF gerado: ${outputPath}`);
  console.log(`Tamanho: ${pdfBuffer.length} bytes`);
}

gerarPdfExemplo().catch(console.error);

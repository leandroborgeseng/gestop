import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildVistoriaRealizadaPdf } from '../src/fiscalizacoes/vistoria-realizada-pdf';
import { buildDocumentoPdf } from '../src/documentos/documentos-pdf';
import { resolveRespostaTexto } from '../src/checklists/checklist-resposta-apresentacao';
import { AMOSTRA_RESPOSTAS_BANCO, respostasAmostraParaPdf } from '../src/checklists/checklist-resposta-amostra';

async function main() {
  const outDir = process.argv[2] || '/opt/cursor/artifacts';
  mkdirSync(outDir, { recursive: true });

  const vistoria = await buildVistoriaRealizadaPdf({
    unidadeNome: 'Escola Municipal Exemplo',
    unidadeCodigoPatrimonial: 'EM-001',
    secretariaSigla: 'SEDUC',
    secretariaNome: 'Secretaria de Educação',
    endereco: 'Rua Exemplo, 123',
    bairro: 'Centro',
    checklistNome: 'Vistoria de Infraestrutura Escolar',
    checklistVersao: 2,
    dataHora: '2026-10-05T14:30:00.000Z',
    origemLabel: 'App Mobile',
    realizadaPorLabel: 'João Silva',
    lancamentoManual: false,
    lancadoPorLabel: null,
    responsaveisPrevistosLabel: 'Equipe de Manutenção',
    observacoes: 'Amostra fictícia para QA 277/279.',
    notaGeral: 7.8,
    notasPorCategoria: [{ categoriaNome: 'Estrutura física', nota: 8.5 }],
    respostas: respostasAmostraParaPdf(),
  });
  const vistoriaPath = resolve(outDir, 'vistoria-depois.pdf');
  writeFileSync(vistoriaPath, vistoria);

  const documento = await buildDocumentoPdf({
    codigo: 'DOC-EXEMPLO',
    codigoValidacao: 'VAL',
    codigoVerificador: 'VER',
    tipoLabel: 'Avulso',
    situacaoLabel: 'Concluído',
    origemLabel: 'Avulso',
    titulo: 'Documento de exemplo',
    secretariaLabel: 'SEDUC',
    unidadeLabel: 'EM-001 Escola Municipal Exemplo',
    endereco: 'Rua Exemplo, 123',
    chamadoCodigo: null,
    vistoriaLabel: null,
    checklistLabel: 'Checklist v2',
    responsavelLabel: 'João Silva',
    criadoEm: '2026-10-05T14:30:00.000Z',
    geradoEm: '2026-10-05T14:30:00.000Z',
    validationUrl: 'https://example.invalid/validar',
    hashResumo: null,
    respostas: AMOSTRA_RESPOSTAS_BANCO.map((item) => ({
      codigo: item.codigo,
      secao: item.secao,
      titulo: item.titulo,
      tipo: item.tipo,
      respostaTexto: resolveRespostaTexto(item),
      comentario: item.comentario,
      conformidade: item.conformidade,
      evidencias: [],
    })),
    incluirAssinaturas: false,
    incluirBlocoAutenticidade: false,
  });
  const documentoPath = resolve(outDir, 'documento-depois.pdf');
  writeFileSync(documentoPath, documento);

  console.log(`PDF vistoria: ${vistoriaPath} (${vistoria.length} bytes)`);
  console.log(`PDF documento: ${documentoPath} (${documento.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

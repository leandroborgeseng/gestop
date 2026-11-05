/**
 * Fixture sintético ZZTESTE para evidências do #311 (só dados de teste).
 * Não usar em produção.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ChecklistEscopo,
  ChecklistItemTipo,
  ChecklistVersaoStatus,
  EvidenciaTipo,
  FiscalizacaoOrigem,
  FiscalizacaoStatus,
  PrismaClient,
} from '@prisma/client';

const connectionString = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function png1x1(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}
function pngRed(): Buffer {
  // 2x2 red-ish PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC',
    'base64',
  );
}

async function main() {
  const admin = await prisma.usuario.findFirst({ where: { email: 'admin.gestop@franca.sp.gov.br' } });
  if (!admin) throw new Error('admin seed ausente');
  const secretaria = await prisma.secretaria.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!secretaria) throw new Error('secretaria ausente');

  const storageDir = join(process.cwd(), 'storage', 'evidencias', 'zzteste-311');
  mkdirSync(storageDir, { recursive: true });
  writeFileSync(join(storageDir, 'foto1.png'), png1x1());
  writeFileSync(join(storageDir, 'foto2.png'), pngRed());
  writeFileSync(join(storageDir, 'anexo.pdf'), Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'));

  const checklist = await prisma.checklist.create({
    data: {
      nome: 'ZZTESTE Checklist CCO',
      descricao: 'Checklist sintético #311',
      escopo: ChecklistEscopo.GLOBAL,
      ativo: true,
      versoes: {
        create: {
          versao: 1,
          status: ChecklistVersaoStatus.PUBLICADO,
          publicadoAt: new Date(),
          itens: {
            create: [
              { ordem: 1, codigo: 'X', titulo: 'ZZTESTE pergunta X', tipo: ChecklistItemTipo.TEXTO, obrigatorio: true },
              { ordem: 2, codigo: 'Y', titulo: 'ZZTESTE pergunta Y', tipo: ChecklistItemTipo.TEXTO, obrigatorio: true },
              { ordem: 3, codigo: 'Z', titulo: 'ZZTESTE pergunta Z', tipo: ChecklistItemTipo.TEXTO, obrigatorio: false },
            ],
          },
        },
      },
    },
    include: { versoes: { include: { itens: true } } },
  });
  const versao = checklist.versoes[0];
  const itens = [...versao.itens].sort((a, b) => a.ordem - b.ordem);

  const unidade = await prisma.unidadePublica.create({
    data: {
      secretariaId: secretaria.id,
      nome: 'ZZTESTE Próprio Público CCO',
      codigoPatrimonial: 'ZZTESTE-311',
      tipo: "OUTRO",
      bairro: 'ZZTESTE',
      endereco: 'Rua ZZTESTE, 311',
      latitude: -20.5382,
      longitude: -47.4009,
      ativo: true,
    },
  });

  const baseUrl = process.env.STORAGE_PUBLIC_URL_BASE ?? 'http://127.0.0.1:3301';
  const url = (name: string) => `${baseUrl}/storage/evidencias/zzteste-311/${name}`;

  async function criaVistoria(opts: {
    concluidaEm: Date;
    origem: FiscalizacaoOrigem;
    comFotos: boolean;
    comPdf: boolean;
  }) {
    const fisc = await prisma.fiscalizacao.create({
      data: {
        secretariaId: secretaria.id,
        unidadeId: unidade.id,
        checklistVersaoId: versao.id,
        agenteId: admin.id,
        status: FiscalizacaoStatus.CONCLUIDA,
        origem: opts.origem,
        iniciadaEm: new Date(opts.concluidaEm.getTime() - 3600_000),
        concluidaEm: opts.concluidaEm,
        checkinLatitude: -20.5383,
        checkinLongitude: -47.401,
        distanciaCheckinMetros: 15,
        dentroRaioPermitido: true,
        observacoes: 'ZZTESTE observação geral',
      },
    });

    for (const [i, item] of itens.entries()) {
      const resp = await prisma.respostaChecklist.create({
        data: {
          fiscalizacaoId: fisc.id,
          itemId: item.id,
          valorTexto: `ZZTESTE resposta ${item.codigo}`,
          respondidoEm: new Date(opts.concluidaEm.getTime() - (itens.length - i) * 60_000),
        },
      });
      if (opts.comFotos && i === 0) {
        for (const [n, file] of [
          ['foto1.png', 'image/png'],
          ['foto2.png', 'image/png'],
        ] as const) {
          await prisma.evidencia.create({
            data: {
              fiscalizacaoId: fisc.id,
              respostaId: resp.id,
              tipo: EvidenciaTipo.FOTO,
              url: url(n),
              mimeType: file[1],
              capturadaEm: opts.concluidaEm,
            },
          });
        }
      }
      if (opts.comPdf && i === 1) {
        await prisma.evidencia.create({
          data: {
            fiscalizacaoId: fisc.id,
            respostaId: resp.id,
            tipo: EvidenciaTipo.DOCUMENTO,
            url: url('anexo.pdf'),
            mimeType: 'application/pdf',
            capturadaEm: opts.concluidaEm,
          },
        });
      }
    }
    return fisc.id;
  }

  const idRecente = await criaVistoria({
    concluidaEm: new Date('2026-11-05T14:00:00-03:00'),
    origem: FiscalizacaoOrigem.ROTINA,
    comFotos: true,
    comPdf: true,
  });
  await criaVistoria({
    concluidaEm: new Date('2026-11-04T10:00:00-03:00'),
    origem: FiscalizacaoOrigem.OFFLINE,
    comFotos: false,
    comPdf: false,
  });
  await criaVistoria({
    concluidaEm: new Date('2026-11-03T09:00:00-03:00'),
    origem: FiscalizacaoOrigem.MANUAL,
    comFotos: false,
    comPdf: false,
  });

  console.log(JSON.stringify({ unidadeId: unidade.id, fiscalizacaoComMidias: idRecente, codigo: 'ZZTESTE-311' }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

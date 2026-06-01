import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UnidadeTipo } from '@prisma/client';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from './startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type CsvRow = {
  secretaria_sigla: string;
  codigo_patrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro?: string;
  cep?: string;
  latitude: number;
  longitude: number;
  raio_validacao_metros: number;
  ativo: boolean;
};

const VALID_TIPOS = new Set<string>(Object.values(UnidadeTipo));

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find((arg) => !arg.startsWith('--'));
  const filePath = resolve(process.cwd(), fileArg ?? 'data/unidades.template.csv');

  logStep('import', `Importando unidades de ${filePath}`);
  logInfo('import', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  if (dryRun) {
    logWarn('import', 'Modo dry-run: nenhuma alteracao sera persistida.');
  }

  const content = await readFile(filePath, 'utf8');
  const rows = parseCsv(content);
  logInfo('import', `${rows.length} linhas validas encontradas.`);

  const secretarias = await prisma.secretaria.findMany({
    select: { id: true, sigla: true },
  });
  const secretariaBySigla = new Map(secretarias.map((item) => [item.sigla.toUpperCase(), item.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const secretariaId = secretariaBySigla.get(row.secretaria_sigla.toUpperCase());
    if (!secretariaId) {
      skipped += 1;
      logWarn('import', `Secretaria ${row.secretaria_sigla} nao encontrada para ${row.codigo_patrimonial}.`);
      continue;
    }

    const payload = {
      secretariaId,
      codigoPatrimonial: row.codigo_patrimonial.trim().toUpperCase(),
      nome: row.nome.trim(),
      tipo: row.tipo,
      endereco: row.endereco.trim(),
      bairro: row.bairro?.trim() || null,
      cep: row.cep?.trim() || null,
      latitude: row.latitude,
      longitude: row.longitude,
      raioValidacaoMetros: row.raio_validacao_metros,
      ativo: row.ativo,
    };

    if (dryRun) {
      logInfo('import', `[dry-run] ${payload.codigoPatrimonial} -> ${payload.nome}`);
      continue;
    }

    const existing = await prisma.unidadePublica.findUnique({
      where: { codigoPatrimonial: payload.codigoPatrimonial },
      select: { id: true },
    });

    if (existing) {
      await prisma.unidadePublica.update({
        where: { id: existing.id },
        data: payload,
      });
      updated += 1;
    } else {
      await prisma.unidadePublica.create({ data: payload });
      created += 1;
    }
  }

  const total = await prisma.unidadePublica.count();
  logInfo('import', `Importacao concluida: ${created} criadas, ${updated} atualizadas, ${skipped} ignoradas.`);
  logInfo('import', `Total de unidades no banco: ${total}`);
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV vazio ou sem dados.');
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const required = [
    'secretaria_sigla',
    'codigo_patrimonial',
    'nome',
    'tipo',
    'endereco',
    'latitude',
    'longitude',
  ];

  for (const column of required) {
    if (!headers.includes(column)) {
      throw new Error(`Coluna obrigatoria ausente: ${column}`);
    }
  }

  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']));

    const tipo = record.tipo.toUpperCase();
    if (!VALID_TIPOS.has(tipo)) {
      throw new Error(`Tipo invalido "${record.tipo}" em ${record.codigo_patrimonial}`);
    }

    const latitude = Number(record.latitude);
    const longitude = Number(record.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`Coordenadas invalidas em ${record.codigo_patrimonial}`);
    }

    rows.push({
      secretaria_sigla: record.secretaria_sigla,
      codigo_patrimonial: record.codigo_patrimonial,
      nome: record.nome,
      tipo: tipo as UnidadeTipo,
      endereco: record.endereco,
      bairro: record.bairro || undefined,
      cep: record.cep || undefined,
      latitude,
      longitude,
      raio_validacao_metros: Number(record.raio_validacao_metros || 200),
      ativo: (record.ativo || 'true').toLowerCase() !== 'false',
    });
  }

  return rows;
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    logError('import', 'Falha ao importar unidades', error);
    await prisma.$disconnect();
    process.exit(1);
  });

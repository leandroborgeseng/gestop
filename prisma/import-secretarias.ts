import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { logError, logInfo, logStep, logWarn, maskDatabaseUrl } from './startup-log';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://gestop:gestop@localhost:5432/gestop?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find((arg) => !arg.startsWith('--'));
  const filePath = resolve(process.cwd(), fileArg ?? 'data/secretarias.template.csv');

  logStep('import', `Importando secretarias de ${filePath}`);
  logInfo('import', `DATABASE_URL=${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  if (dryRun) logWarn('import', 'Modo dry-run: nenhuma alteracao sera persistida.');

  const content = await readFile(filePath, 'utf8');
  const rows = parseCsv(content);
  logInfo('import', `${rows.length} linhas validas encontradas.`);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const sigla = row.sigla.trim().toUpperCase();
    const payload = {
      nome: row.nome.trim(),
      sigla,
      responsavelNome: row.responsavel_nome?.trim() || null,
      responsavelEmail: row.responsavel_email?.trim().toLowerCase() || null,
      ativo: (row.ativo || 'true').toLowerCase() !== 'false',
    };

    if (dryRun) {
      logInfo('import', `[dry-run] ${sigla} -> ${payload.nome}`);
      continue;
    }

    const existing = await prisma.secretaria.findUnique({ where: { sigla }, select: { id: true } });
    if (existing) {
      await prisma.secretaria.update({ where: { id: existing.id }, data: payload });
      updated += 1;
    } else {
      await prisma.secretaria.create({ data: payload });
      created += 1;
    }
  }

  const total = await prisma.secretaria.count();
  logInfo('import', `Importacao concluida: ${created} criadas, ${updated} atualizadas.`);
  logInfo('import', `Total de secretarias no banco: ${total}`);
}

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV vazio ou sem dados.');

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  for (const column of ['sigla', 'nome']) {
    if (!headers.includes(column)) throw new Error(`Coluna obrigatoria ausente: ${column}`);
  }

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']));
    return record as Record<string, string>;
  });
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
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    logError('import', 'Falha ao importar secretarias', error);
    await prisma.$disconnect();
    process.exit(1);
  });

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

export type SecretariaImportRow = {
  sigla: string;
  nome: string;
  responsavel_nome?: string;
  responsavel_email?: string;
  ativo?: string;
};

export type SecretariasImportResult = {
  created: number;
  updated: number;
  total: number;
  dryRun: boolean;
};

export async function importSecretariasFromCsvContent(
  prisma: PrismaClient,
  content: string,
  dryRun = false,
): Promise<SecretariasImportResult> {
  const rows = parseCsv(content);
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

    if (dryRun) continue;

    const existing = await prisma.secretaria.findUnique({ where: { sigla }, select: { id: true } });
    if (existing) {
      await prisma.secretaria.update({ where: { id: existing.id }, data: payload });
      updated += 1;
    } else {
      await prisma.secretaria.create({ data: payload });
      created += 1;
    }
  }

  const total = dryRun ? rows.length : await prisma.secretaria.count();
  return { created, updated, total, dryRun };
}

export async function importSecretariasFromFile(
  prisma: PrismaClient,
  filePath: string,
  dryRun = false,
) {
  const content = await readFile(resolve(filePath), 'utf8');
  return importSecretariasFromCsvContent(prisma, content, dryRun);
}

export function parseCsv(content: string): SecretariaImportRow[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV vazio ou sem dados.');

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  for (const column of ['sigla', 'nome']) {
    if (!headers.includes(column)) throw new Error(`Coluna obrigatoria ausente: ${column}`);
  }

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])) as SecretariaImportRow;
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

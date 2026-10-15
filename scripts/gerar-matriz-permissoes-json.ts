/**
 * 285: gera `src/auth/matriz/permissoes-matriz.json` (cópia legível por máquina da matriz).
 * Uso: npx tsx scripts/gerar-matriz-permissoes-json.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializarMatriz } from '../src/auth/matriz/permissoes-matriz-json';

const destino = join(__dirname, '..', 'src', 'auth', 'matriz', 'permissoes-matriz.json');
writeFileSync(destino, serializarMatriz());
console.log(`Matriz gravada em ${destino}`);

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMINISTRADOR_SISTEMA_NOME, isAdministradorSistemaAtivo } from './administrador-sistema';

const matrixSrc = readFileSync(join(__dirname, 'permissions-matrix.ts'), 'utf8');
const coletarSrc = readFileSync(join(__dirname, 'can-coletar-assinatura.ts'), 'utf8');

describe('administrador-sistema — módulo único', () => {
  it('é a única definição do nome e da regra no front', () => {
    expect(ADMINISTRADOR_SISTEMA_NOME).toBe('Administrador do Sistema');
    expect(isAdministradorSistemaAtivo({ perfis: [ADMINISTRADOR_SISTEMA_NOME] })).toBe(true);
    expect(isAdministradorSistemaAtivo({ perfis: ['Gestor'] })).toBe(false);
    expect(matrixSrc).toContain("from './administrador-sistema'");
    expect(matrixSrc).not.toContain("export const ADMINISTRADOR_SISTEMA_NOME");
    expect(coletarSrc).toContain("from './administrador-sistema'");
    expect(coletarSrc).not.toContain("const ADMINISTRADOR_SISTEMA_NOME");
    expect(coletarSrc).not.toContain('function isAdministradorSistemaAtivo');
  });
});

import { describe, expect, it } from 'vitest';
import { parseCommitSha, resolveCommitFields, resolveCommitSha, toCommitShort } from './commit-sha';

const APP = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const RAILWAY = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SOURCE = 'cccccccccccccccccccccccccccccccccccccccc';
const GIT = 'dddddddddddddddddddddddddddddddddddddddd';
const MIXED = '377C3E48F756AA2D7A5DBE05088B0134CEFC47EE';
const MIXED_LOWER = '377c3e48f756aa2d7a5dbe05088b0134cefc47ee';

describe('parseCommitSha', () => {
  it('aceita SHA de 40 hex e normaliza para minusculas', () => {
    expect(parseCommitSha(MIXED)).toBe(MIXED_LOWER);
  });

  it('remove espacos nas bordas antes de validar', () => {
    expect(parseCommitSha(`  ${MIXED}  \n`)).toBe(MIXED_LOWER);
  });

  it.each([
    ['vazio', ''],
    ['so espacos', '   '],
    ['unknown', 'unknown'],
    ['SHA curto de 7', '377c3e4'],
    ['SHA de 39 hex', 'a'.repeat(39)],
    ['nao hex', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'],
    ['41 chars', 'a'.repeat(41)],
    ['hex com espaco no meio', 'aaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaa'],
  ])('rejeita %s', (_label, value) => {
    expect(parseCommitSha(value)).toBeNull();
  });
});

describe('resolveCommitSha — precedencia', () => {
  it('APP_COMMIT_SHA vence as demais', () => {
    expect(
      resolveCommitSha({
        APP_COMMIT_SHA: APP,
        RAILWAY_GIT_COMMIT_SHA: RAILWAY,
        SOURCE_COMMIT: SOURCE,
        GIT_COMMIT: GIT,
      }),
    ).toBe(APP);
  });

  it('RAILWAY_GIT_COMMIT_SHA vence SOURCE_COMMIT quando ambos sao validos', () => {
    expect(
      resolveCommitSha({
        RAILWAY_GIT_COMMIT_SHA: RAILWAY,
        SOURCE_COMMIT: SOURCE,
      }),
    ).toBe(RAILWAY);
  });

  it('SOURCE_COMMIT vence GIT_COMMIT', () => {
    expect(
      resolveCommitSha({
        SOURCE_COMMIT: SOURCE,
        GIT_COMMIT: GIT,
      }),
    ).toBe(SOURCE);
  });

  it('usa GIT_COMMIT quando as anteriores estao vazias', () => {
    expect(
      resolveCommitSha({
        APP_COMMIT_SHA: '',
        RAILWAY_GIT_COMMIT_SHA: '   ',
        SOURCE_COMMIT: undefined,
        GIT_COMMIT: GIT,
      }),
    ).toBe(GIT);
  });

  it('Railway invalido nao bloqueia SOURCE_COMMIT valido', () => {
    expect(
      resolveCommitSha({
        RAILWAY_GIT_COMMIT_SHA: 'unknown',
        SOURCE_COMMIT: SOURCE,
      }),
    ).toBe(SOURCE);
  });

  it('valor invalido de prioridade maior nao bloqueia o proximo valido', () => {
    expect(
      resolveCommitSha({
        APP_COMMIT_SHA: '377c3e4',
        RAILWAY_GIT_COMMIT_SHA: 'not-a-sha',
        SOURCE_COMMIT: SOURCE,
      }),
    ).toBe(SOURCE);
  });

  it('ausente ou so invalidos vira null', () => {
    expect(resolveCommitSha({})).toBeNull();
    expect(
      resolveCommitSha({
        APP_COMMIT_SHA: '',
        RAILWAY_GIT_COMMIT_SHA: 'unknown',
        SOURCE_COMMIT: '377c3e4',
        GIT_COMMIT: '   ',
      }),
    ).toBeNull();
  });
});

describe('resolveCommitFields', () => {
  it('commitShort sao os 7 primeiros de commit', () => {
    expect(resolveCommitFields({ APP_COMMIT_SHA: MIXED })).toEqual({
      commit: MIXED_LOWER,
      commitShort: MIXED_LOWER.slice(0, 7),
    });
  });

  it('os dois campos ficam null quando nao ha SHA valido', () => {
    expect(resolveCommitFields({ APP_COMMIT_SHA: 'unknown' })).toEqual({
      commit: null,
      commitShort: null,
    });
  });

  it('toCommitShort devolve null sem commit', () => {
    expect(toCommitShort(null)).toBeNull();
    expect(toCommitShort(APP)).toBe('aaaaaaa');
  });
});

# Mutações 12 (não commitadas no código)

As três mutações abaixo foram aplicadas localmente, fizeram o teste indicado ficar vermelho e foram revertidas. O código da branch permanece sem elas.

## M1 — troca a precedência Railway / SOURCE_COMMIT

- Arquivo: `src/config/commit-sha.ts` (`COMMIT_ENV_KEYS`)
- Alteração: `SOURCE_COMMIT` passou a vir antes de `RAILWAY_GIT_COMMIT_SHA`.
- Teste vermelho: `RAILWAY_GIT_COMMIT_SHA vence SOURCE_COMMIT quando ambos sao validos`

Saída:

```
 FAIL  src/config/commit-sha.spec.ts > resolveCommitSha — precedencia > RAILWAY_GIT_COMMIT_SHA vence SOURCE_COMMIT quando ambos sao validos
AssertionError: expected 'ccccccccccccccccccccccccccccccccccccc…' to be 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb…' // Object.is equality

Expected: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
Received: "cccccccccccccccccccccccccccccccccccccccc"

 ❯ src/config/commit-sha.spec.ts:52:7
     50|         SOURCE_COMMIT: SOURCE,
     51|       }),
     52|     ).toBe(RAILWAY);

 Test Files  1 failed (1)
      Tests  1 failed | 19 passed (20)
```

Com a ordem invertida, Coolify (`SOURCE_COMMIT`) mascara o SHA do Railway mesmo quando os dois estão definidos.

## M2 — aceita SHA de 7 a 40 hex (quebra a regra de 40)

- Arquivo: `src/config/commit-sha.ts` (`FULL_SHA`)
- Alteração: `/^[0-9a-f]{40}$/` → `/^[0-9a-f]{7,40}$/`.
- Testes vermelhos: `rejeita SHA curto de 7`, `rejeita SHA de 39 hex`, `valor invalido de prioridade maior nao bloqueia o proximo valido`, `ausente ou so invalidos vira null`

Saída:

```
 ❯ src/config/commit-sha.spec.ts (20 tests | 4 failed) 10ms
     × rejeita SHA curto de 7 3ms
     × rejeita SHA de 39 hex 1ms
     × valor invalido de prioridade maior nao bloqueia o proximo valido 2ms
     × ausente ou so invalidos vira null 0ms

 FAIL  src/config/commit-sha.spec.ts > parseCommitSha > rejeita SHA curto de 7
AssertionError: expected '377c3e4' to be null

- Expected:
null

+ Received:
"377c3e4"

 ❯ src/config/commit-sha.spec.ts:30:35
     29|   ])('rejeita %s', (_label, value) => {
     30|     expect(parseCommitSha(value)).toBeNull();

 Test Files  1 failed (1)
      Tests  4 failed | 16 passed (20)
```

A forma curta e o SHA de 39 passam a ser aceitos. QA deixaria de distinguir commit incompleto de commit implantado.

## M3 — valor inválido de maior prioridade bloqueia o seguinte

- Arquivo: `src/config/commit-sha.ts` (`resolveCommitSha`)
- Alteração: o primeiro valor não-vazio vira o resultado; se for inválido, retorna `null` em vez de cair no próximo.
- Testes vermelhos: `Railway invalido nao bloqueia SOURCE_COMMIT valido`, `valor invalido de prioridade maior nao bloqueia o proximo valido`

Saída:

```
 ❯ src/config/commit-sha.spec.ts (20 tests | 2 failed) 8ms
     × Railway invalido nao bloqueia SOURCE_COMMIT valido 3ms
     × valor invalido de prioridade maior nao bloqueia o proximo valido 1ms

 FAIL  src/config/commit-sha.spec.ts > resolveCommitSha — precedencia > Railway invalido nao bloqueia SOURCE_COMMIT valido
AssertionError: expected null to be 'ccccccccccccccccccccccccccccccccccccc…' // Object.is equality

- Expected:
"cccccccccccccccccccccccccccccccccccccccc"

+ Received:
null

 ❯ src/config/commit-sha.spec.ts:81:7
     79|         SOURCE_COMMIT: SOURCE,
     80|       }),
     81|     ).toBe(SOURCE);

 Test Files  1 failed (1)
      Tests  2 failed | 18 passed (20)
```

Um `RAILWAY_GIT_COMMIT_SHA=unknown` (ou SHA curto) apaga o `SOURCE_COMMIT` válido do Coolify.

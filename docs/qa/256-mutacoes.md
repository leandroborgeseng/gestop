# Item 256 — mutações de QA

As mutações abaixo **não estão no código**. Foram aplicadas uma a uma, a suíte `src/documentos/documentos-vinculos.spec.ts` foi rodada, e o arquivo de produção foi restaurado (`git restore`) antes da mutação seguinte.

Comando: `npx vitest run src/documentos/documentos-vinculos.spec.ts`

## M1 — decorator do `PATCH :id/vinculos` revertido ao estado de `main`

**Mutação:** `@RequireAnyPermissions('documentos.editar_vinculo', 'documentos.administrar')` (sem `criar_avulso`).

**Teste vermelho:** `decorator @RequireAnyPermissions do updateVinculos inclui documentos.criar_avulso`

```
AssertionError: expected [ 'documentos.editar_vinculo', …(1) ] to include 'documentos.criar_avulso'
 ❯ src/documentos/documentos-vinculos.spec.ts:140:35

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)
```

## M2 — `$transaction` removido de `substituirChamadosVinculados`

**Mutação:** `deleteMany` + `createMany` no client raiz (`this.prisma.documentoChamado`), sem `$transaction`.

**Testes vermelhos:**
- `deleteMany e createMany rodam no TX, nunca no client raiz`
- `transação com lista vazia não chama createMany`

```
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ src/documentos/documentos-vinculos.spec.ts:318:39
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ src/documentos/documentos-vinculos.spec.ts:334:39

 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)
```

## M3 — `podeVincularChamadosAvulso` ignora a situação (CONCLUÍDO tratado como RASCUNHO)

**Mutação:** após admin/`administrar`/`usuarios.gerenciar`, retorna `criar_avulso || editar_vinculo` sem checar `situacao === RASCUNHO`.

**Mock:** mesmos chamados visíveis do caso feliz (`CHAM-001`); `documento.update` devolve o documento. Sem a regra, a operação **conclui com sucesso**.

**Teste vermelho:** `só criar_avulso em documento CONCLUÍDO → ForbiddenException`

```
AssertionError: promise resolved "{ id: 'doc-2', …(34) }" instead of rejecting

- Expected
+ Received
- Error { "message": "rejected promise" }
+ { "id": "doc-2", "origem": "AVULSO", "chamados": [{ "codigo": "CHAM-001", ... }], ... }

 ❯ src/documentos/documentos-vinculos.spec.ts:190:62

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)
```

## M4 — `podeVincularChamadosAvulso` deixa de checar `origem === AVULSO`

**Mutação:** removido `if (documento.origem !== DocumentoOrigem.AVULSO) return false`.

**Testes vermelhos:**
- `podeVincularChamadosAvulso é false para VISTORIA mesmo com criar_avulso em RASCUNHO`
- `podeVincularChamadosAvulso é false para CHAMADO_EXECUCAO mesmo com criar_avulso em RASCUNHO`

```
AssertionError: expected true to be false // Object.is equality
 ❯ src/documentos/documentos-vinculos.spec.ts:290:9
AssertionError: expected true to be false // Object.is equality
 ❯ src/documentos/documentos-vinculos.spec.ts:299:9

 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)
```

`updateVinculos` em VISTORIA/CHAMADO_EXECUCAO com só `criar_avulso` continua Forbidden pelo outro gate (`assertPermission` de `editar_vinculo`/`administrar`, porque `somenteChamadosAvulso` exige origem AVULSO). A M4 prova a checagem de origem **dentro** de `podeVincularChamadosAvulso`.

## Verde final (produção restaurada)

```
 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  899ms
```

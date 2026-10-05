# Mutações — item 275 (assinatura no chamado)

Rodadas em 05/10/2026 sobre o código restaurado (sem commit das mutações). Specs alvo: card renderizado com `renderToStaticMarkup` e paridade `canColetarAssinatura` × `PermissionsGuard`.

## M1 — botão Coletar usa acesso ao módulo

Alteração (não commitada): em `documento-relacionado-card.tsx`,

`const podeColetar = resolvePodeColetar(permissoes, user)`
→ `const podeColetar = hasDocumentosModuloAccess(permissoes)`.

Comando: `npx vitest run frontend/components/documentos/documento-relacionado-card.spec.ts`

Ficaram vermelhos:

- `DocumentoRelacionadoCard > não mostra Coletar só com acesso ao módulo Documentos`
- `DocumentoRelacionadoCard > mostra Coletar com documentos.coletar_assinatura`

Saída: `Test Files  1 failed (1)` / `Tests  2 failed | 3 passed (5)`.

Quem só tem o módulo passa a ver o botão; quem só tem `documentos.coletar_assinatura` deixa de ver.

## M2 — lista de signatários internos pendentes removida

Alteração (não commitada): bloco `{pendentes.length > 0 ? ...}` removido do card.

Comando: o mesmo spec do card.

Ficou vermelho:

- `DocumentoRelacionadoCard > lista signatários internos pendentes com nome e e-mail`

Saída: `Tests  1 failed | 4 passed (5)` — o HTML deixou de conter `Signatários internos pendentes:`.

## M3 — `usuarios.gerenciar` de volta no helper do front

Alteração (não commitada): no início de `canColetarAssinatura`, `if (permissoes.includes('usuarios.gerenciar')) return true`.

Comando: `npx vitest run src/documentos/documentos-coletar-assinatura-parity.spec.ts frontend/lib/permissions-coletar-assinatura.spec.ts`

Ficaram vermelhos:

- `canColetarAssinatura … > retorna false para usuarios.gerenciar sem ser Administrador do Sistema`
- `paridade canColetarAssinatura × PermissionsGuard … > 'usuarios.gerenciar sem admin de sistema': front e guard coincidem (esperado false)`

Saída: `Test Files  2 failed (2)` / `Tests  2 failed | 12 passed (14)`. O guard continua 403; o front voltaria a mostrar o botão.

## Verde (código restaurado)

`npx vitest run frontend/components/documentos/documento-relacionado-card.spec.ts frontend/lib/permissions-coletar-assinatura.spec.ts src/documentos/documentos-coletar-assinatura-parity.spec.ts src/documentos/documentos-list-by-chamado.spec.ts`

`Test Files  4 passed (4)` / `Tests  22 passed (22)`.

## M4 — tirar o filtro `status: 'PENDENTE'` do include

Alteração (não commitada): em `DOCUMENTO_INCLUDE` (`documentos.service.ts`), removido `where: { status: 'PENDENTE' as const }` de `assinaturaPedidos`.

Comando: `npx vitest run src/documentos/documentos-list-by-chamado.spec.ts`

Ficou vermelho:

- `DocumentosService.listByChamado > devolve signatários internos pendentes (pedidos a Usuario), não a assinatura externa`

Asserção: `findManyArg.include.assinaturaPedidos?.where` esperava `{ status: 'PENDENTE' }` e veio `undefined`.

Saída: `Tests  1 failed | 2 passed (3)`.

## M5 — ignorar `matriz.documentos.administrar.*` no helper

Alteração (não commitada): em `frontend/lib/can-coletar-assinatura.ts` (reexportado por `permissions-matrix.ts`; o spec de paridade importa o helper por `../../frontend/lib/can-coletar-assinatura.js`), o retorno das chaves `administrar.alterar|excluir|executar` virou `return false`.

Comando: `npx vitest run src/documentos/documentos-coletar-assinatura-parity.spec.ts`

Ficou vermelho:

- `paridade canColetarAssinatura × PermissionsGuard … > 'matriz.documentos.administrar.alterar (sessão crua, sem chave legada)': front e guard coincidem (esperado true)`

O guard continua true (expande para `documentos.administrar`); o front passou a false (`expect(front).toBe(esperado)` recebeu `false`).

Saída: `Test Files  1 failed (1)` / `Tests  1 failed | 9 passed (10)`.

Refeito em 05/10/2026 contra o helper puro do frontend (sem `src/domain/can-coletar-assinatura.ts`).

## M6 — mostrar Coletar em documento CANCELADO

Alteração (não commitada): no card, `item.possuiPdfOriginal && item.situacao !== 'CANCELADO' && podeColetar` virou `item.possuiPdfOriginal && podeColetar`.

Comando: `npx vitest run frontend/components/documentos/documento-relacionado-card.spec.ts`

Ficou vermelho:

- `DocumentoRelacionadoCard > não mostra Coletar em documento CANCELADO mesmo com permissão`

Saída: `Tests  1 failed | 6 passed (7)`.

## Verde após M4–M6 (código restaurado)

`npx vitest run src/documentos/documentos-list-by-chamado.spec.ts src/documentos/documentos-coletar-assinatura-parity.spec.ts frontend/components/documentos/documento-relacionado-card.spec.ts frontend/lib/permissions-coletar-assinatura.spec.ts`

`Test Files  4 passed (4)` / `Tests  28 passed (28)`.

`tsc -p tsconfig.json` (raiz): mesmos 11 erros da `main` (auth.spec, chamado-tarefa.regras.spec sem tipos de teste, vitest.config ESM). Sem `TS2307` de `@/lib/permissions-matrix`. Sem `TS1479`/`TS2835` no spec de paridade (import dinâmico de `../../frontend/lib/can-coletar-assinatura.js`). `tsconfig.build.json` exclui `**/*.spec.ts`.

`cd frontend && npx tsc --noEmit`: 0 erros (igual à `main`). Helper em `frontend/lib/can-coletar-assinatura.ts`, sem import de `src/`.

`npm run build --prefix frontend`: passou (Next.js 16.2.6 Turbopack, TypeScript do `next build` ok).

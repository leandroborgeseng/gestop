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

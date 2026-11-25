# QA 307 — testes de UI locais (seed fictício 306+307)

Rodam contra front local (127.0.0.1:3717 → API 3707) com `npm run seed:responsaveis-307` num Postgres LOCAL.
A senha dos usuários fictícios é lida de `/tmp/pr307/senha` (não versionada). Screenshots/log são gravados ao lado do script.

- `ui-307-ajuste1.js` — R1, R2, R4 e, no passo R5, o comportamento R5c (multi.ab edita A, outra aba troca para B: aviso,
  Salvar travado, nenhuma requisição; volta para A: Salvar liberado).
- `ui-ciclo2.js` — R5c e R5b (usuário `todas.307`: "manter" grava `responsaveis.manter_fora_escopo` na auditoria).

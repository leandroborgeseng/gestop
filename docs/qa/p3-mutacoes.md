# Mutações P3 (não commitadas no código)

As mutações abaixo foram aplicadas localmente, fizeram o teste indicado ficar vermelho e foram revertidas. O código da branch permanece sem elas.

Comando-base: `npx vitest run --maxWorkers=2 <spec>`

## Q1 — remover a coluna Resumo do chamado

- Arquivo: `frontend/components/chamados/execucao-tarefas-panel.tsx` (linha 259)
- Alteração: apagou `<th className="p-2">Resumo do chamado</th>`.
- Teste vermelho: `a grade da aba Tarefas tem a coluna Resumo do chamado preenchida pelo helper`

Saída:

```
FAIL  frontend/lib/execucao-tarefas-251.spec.ts > 251 — coluna Resumo do chamado > a grade da aba Tarefas tem a coluna Resumo do chamado preenchida pelo helper
AssertionError: expected '\'use client\';\n\nimport { useEffect…' to contain '<th className="p-2">Resumo do chamado</th>'
 ❯ frontend/lib/execucao-tarefas-251.spec.ts:72:22

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

## Q2 — remover o responsável do pop-up do pin

- Arquivo: `frontend/lib/chamado-map-popup.ts` (linha 21)
- Alteração: removeu a linha que renderiza `Responsável:` quando `point.responsavelNome` existe.
- Teste vermelho: `o pop-up mostra responsável e mantém Tarefa ·, título, número, prazo, equipe e o botão`

Saída:

```
FAIL  frontend/lib/execucao-tarefas-251.spec.ts > 251 — responsável no pop-up do pin > o pop-up mostra responsável e mantém Tarefa ·, título, número, prazo, equipe e o botão
AssertionError: expected '<div style="min-width:240px;font-fami…' to contain 'Responsável:'
 ❯ frontend/lib/execucao-tarefas-251.spec.ts:108:18

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

## Q3 — agrupamentos voltam a ter só o total

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`relatorio`, função `por`, linhas 414–429)
- Alteração: o `por()` voltou a contar um único `total`, sem `pendentes` nem `atrasadas`.
- Teste vermelho: `agrupa secretaria e equipe com pendentes e atrasadas, não só o total`

Saída:

```
FAIL  src/chamados/chamado-tarefas.relatorio.spec.ts > ChamadoTarefasService — relatório P3 > agrupa secretaria e equipe com pendentes e atrasadas, não só o total
AssertionError: expected [ { nome: 'EDU', total: 3 }, …(1) ] to deeply equal [ …(2) ]

- Expected
+ Received

-     "atrasadas": 1,
      "nome": "EDU",
-     "pendentes": 2,
      "total": 3,

 ❯ src/chamados/chamado-tarefas.relatorio.spec.ts:131:49

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

## Q4 — tarefa entra nos indicadores de chamados

- Arquivo: `src/monitoramento/monitoramento.service.ts` (linha 165)
- Alteração: `abertos: chamadosAbertos` passou a somar `await this.prisma.chamadoTarefa.count()`.
- Teste vermelho: `tarefa não entra nos indicadores de chamados`

Saída:

```
FAIL  src/monitoramento/monitoramento.indicadores.spec.ts > MonitoramentoService — indicadores de chamados (254) > tarefa não entra nos indicadores de chamados
AssertionError: expected 101 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 101

 ❯ src/monitoramento/monitoramento.indicadores.spec.ts:48:52

 Test Files  1 failed (1)
      Tests  1 failed (1)
```

## Q5 — relatório ignora o escopo da Secretaria ativa

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`whereRelatorio`, linhas 582–584)
- Alteração: removeu `resolveSecretariaScopeIds` e o `and.push` de `secretariaId`.
- Teste vermelho: `o relatório restringe pela Secretaria ativa da sessão`

Saída:

```
FAIL  src/chamados/chamado-tarefas.relatorio.spec.ts > ChamadoTarefasService — relatório P3 > o relatório restringe pela Secretaria ativa da sessão
AssertionError: expected { AND: [ { chamado: { …(1) } }, …(1) ] } to deeply equal { AND: [ …(3) ] }

-       "secretariaId": {
-         "in": [
-           "sec-ativa",
-         ],
-       },

 ❯ src/chamados/chamado-tarefas.relatorio.spec.ts:148:19

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

## Q6 — export da grade diverge os filtros

- Arquivo: `frontend/components/relatorios/relatorio-tarefas-panel.tsx` (linha 76)
- Alteração: `downloadRelatorioTarefas(formato, aplicado)` passou a mandar `{ ...aplicado, prazoFrom: aplicado.from, from: undefined }`.
- Testes vermelhos:
  - `o box do Dashboard usa from/to (data de abertura), o mesmo campo do relatório formal`
  - `o export XLSX/CSV/PDF da grade manda exatamente os mesmos filtros aplicados`

Saída:

```
AssertionError: expected '\'use client\';\n\nimport { useEffect…' not to contain 'prazoFrom'
AssertionError: expected '\'use client\';\n\nimport { useEffect…' to contain 'await downloadRelatorioTarefas(formato, aplicado);'
 ❯ frontend/lib/relatorio-tarefas-p3.spec.ts:74:22

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

## Q7 — fechar a sanfona limpa o status

- Arquivo: `frontend/components/chamados/execucao-tarefas-panel.tsx` (linha 143)
- Alteração: o clique da sanfona passou a `setFiltrosAbertos(...)` e também `setStatus('')`.
- Teste vermelho: `fechar a sanfona só alterna o aberto; não zera os filtros`

Saída:

```
FAIL  frontend/lib/filtros-sanfona-265.spec.ts > 265 — sanfona de filtros > fechar a sanfona só alterna o aberto; não zera os filtros
AssertionError: expected '\'use client\';\n\nimport { useEffect…' to contain 'onClick={() => setFiltrosAbertos((current) => !current)}'
 ❯ frontend/lib/filtros-sanfona-265.spec.ts:63:25

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

## Q8 — remove o `Status: não finalizados` do padrão (refeita)

- Arquivo: `frontend/lib/chamado-tarefa.ts` (`resumoFiltrosTarefasExecucao`)
- Alteração: apagou `else if (opts.status === '') partes.push('Status: não finalizados');`.
- Teste vermelho: `o padrão mostra Status: não finalizados; outros filtros entram junto`

Saída:

```
FAIL  frontend/lib/filtros-sanfona-265.spec.ts > 265 — sanfona de filtros > o padrão mostra Status: não finalizados; outros filtros entram junto
AssertionError: expected 'Nenhum filtro ativo' to be 'Status: não finalizados' // Object.is equality

Expected: "Status: não finalizados"
Received: "Nenhum filtro ativo"

 ❯ frontend/lib/filtros-sanfona-265.spec.ts:23:49

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

O backend (`whereExecucao`) já recorta as não finalizadas quando não há `historico` nem `status`. Sem a linha, o resumo mente.

## Q9 — muda o nome do Administrador do Sistema só no front

- Arquivo: `frontend/lib/administrador-sistema.ts` (linha 1)
- Alteração: `ADMINISTRADOR_SISTEMA_NOME` passou de `'Administrador do Sistema'` para `'Administrador'`.
- Teste vermelho: `o nome e a regra do front coincidem com o backend`

Saída:

```
FAIL  src/auth/administrador-sistema-parity.spec.ts > paridade Administrador do Sistema front × backend > o nome e a regra do front coincidem com o backend
AssertionError: expected 'Administrador' to be 'Administrador do Sistema' // Object.is equality

Expected: "Administrador do Sistema"
Received: "Administrador"

 ❯ src/auth/administrador-sistema-parity.spec.ts:9:46

 Test Files  1 failed (1)
      Tests  1 failed (1)
```

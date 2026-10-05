# Mutações 269 (não commitadas no código)

As nove mutações abaixo foram aplicadas localmente, fizeram o teste indicado ficar vermelho e foram revertidas. O código da branch permanece sem elas. M6–M9 correspondem às mutações do Tester T4, T6, T9 e T11.

## M1 — `podeVerHistorico` volta a `true` fixo

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`serialize`)
- Alteração: `podeVerHistorico: this.podeVerHistorico(user)` → `podeVerHistorico: true`.
- Teste vermelho: `não designado sem tarefas_historico.visualizar não devolve histórico nem anexos`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — permissões 269 > não designado sem tarefas_historico.visualizar não devolve histórico nem anexos
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/chamados/chamado-tarefas.service.spec.ts:803:40
    801|     const resultado = await service.getById('tarefa-1', user);
    802|
    803|     expect(resultado.podeVerHistorico).toBe(false);
```

Com o flag fixo, quem só tem `tarefas.visualizar` volta a receber `podeVerHistorico: true` (e o `detalhe` busca o histórico).

## M2 — o responsável ganha edição sem a permissão

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`update`)
- Alteração: `if (mudaCampo && !this.podeAlterar(user))` passou a ignorar o responsável (`before.responsavelId !== user.sub`).
- Teste vermelho: `responsável sem alterar dados não edita título/prazo/secretaria`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — permissões 269 > responsável sem alterar dados não edita título/prazo/secretaria
AssertionError: expected BadRequestException: Responsável inválido. { …(3) } to be an instance of ForbiddenException
 ❯ src/chamados/chamado-tarefas.service.spec.ts:709:5
    707|     await expect(
    708|       service.update('tarefa-1', { titulo: 'Novo título da tarefa' }, …
    709|     ).rejects.toBeInstanceOf(ForbiddenException);
```

O 403 some: o responsável atravessa o guard de alterar dados e cai na validação de atribuição. Sem a mutação, a recusa é `ForbiddenException`.

## M3 — cancelar deixa de aceitar a chave legada `tarefas.excluir`

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`podeCancelar`)
- Alteração: a lista de chaves de matriz ficou só com `tarefas_cancelar.executar` (removeu `tarefas.excluir`).
- Teste vermelho: `cancela com a chave legada tarefas.excluir`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — permissões 269 > cancela com a chave legada tarefas.excluir
ForbiddenException: Sem permissão para cancelar a tarefa.
 ❯ ChamadoTarefasService.update src/chamados/chamado-tarefas.service.ts:266:43
    264|     if (dto.status === ChamadoTarefaStatus.CANCELADA) {
    265|       if (encerrada) throw new BadRequestException('Tarefa concluída o…
    266|       if (!this.podeCancelar(user)) throw new ForbiddenException('Sem …
 ❯ src/chamados/chamado-tarefas.service.spec.ts:748:5
```

Quem ainda tem só `matriz.chamados.tarefas.excluir` deixa de cancelar. A compatibilidade (nova + legada) é o que o teste protege.

## M4 — o front mostra o botão sem a permissão

- Arquivo: `frontend/components/chamados/chamado-tarefa-permissoes-view.tsx` (`ChamadoTarefaBarraAcoes`)
- Alteração: `{tarefa.podeAlterarDados ? (` → `{true ? (` (o botão Alterar dados da tarefa aparece sempre).
- Teste vermelho: `sem permissão, não mostra Alterar dados, Cancelar nem a aba de histórico`

Saída:

```
FAIL  frontend/lib/chamado-tarefa-permissoes.spec.ts > render das ações de tarefa > sem permissão, não mostra Alterar dados, Cancelar nem a aba de histórico
AssertionError: expected '<div><div class="flex flex-wrap gap-2…' not to contain 'Alterar dados da tarefa'

Expected: "Alterar dados da tarefa"
Received: "<div>…<button type="button" …>Alterar dados da tarefa</button></div></div>"

 ❯ frontend/lib/chamado-tarefa-permissoes.spec.ts:56:22
     56|     expect(html).not.toContain(TAREFA_BOTAO_ALTERAR_DADOS);
```

A paridade quebra: a API pode recusar (403) e a UI ainda oferece o botão.

## M5 — esconde os anexos do designado

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`podeVerAnexos`)
- Alteração: `return this.podeVerHistorico(user) || designadoTarefa(...)` → `return this.podeVerHistorico(user)`.
- Teste vermelho: `designado sem tarefas_historico.visualizar vê anexos e não vê histórico`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — permissões 269 > designado sem tarefas_historico.visualizar vê anexos e não vê histórico
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/chamados/chamado-tarefas.service.spec.ts:830:37
    829|     expect(resultado.podeVerHistorico).toBe(false);
    830|     expect(resultado.podeVerAnexos).toBe(true);
```

Sem o `designadoTarefa` na regra de anexos, o responsável deixa de receber `podeVerAnexos` e a lista de arquivos.

## M6 — `chamados.gerenciar` libera o histórico (T4)

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`podeVerHistorico`)
- Alteração: `this.tem(user, [], [chave tarefas_historico.visualizar])` passou a aceitar também `chamados.gerenciar`.
- Teste vermelho: `chamados.gerenciar sem tarefas_historico.visualizar não devolve histórico`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — permissões 269 > chamados.gerenciar sem tarefas_historico.visualizar não devolve histórico
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/chamados/chamado-tarefas.service.spec.ts:861:40
    860|     expect(user.perfis).not.toContain('Administrador do Sistema');
    861|     expect(resultado.podeVerHistorico).toBe(false);
```

Quem tem só `chamados.gerenciar` (sem a chave de histórico e sem ser Administrador do Sistema) passa a receber `podeVerHistorico: true` e o detalhe busca o histórico.

## M7 — o front deixa de aceitar o legado `tarefas.excluir` no cancelar (T6)

- Arquivo: `frontend/lib/permissions-matrix.ts` (`canGerirTarefasChamado`)
- Alteração: a ação cancelar/excluir ficou só com `tarefas_cancelar.executar` (removeu `tarefas.excluir`).
- Teste vermelho: `quem tem só o legado tarefas.excluir continua podendo cancelar`

Saída:

```
FAIL  frontend/lib/permissions-matrix.spec.ts > permissions-matrix — rotina de tarefas (269) > quem tem só o legado tarefas.excluir continua podendo cancelar
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ frontend/lib/permissions-matrix.spec.ts:28:58
    28|     expect(canGerirTarefasChamado(soLegado, 'cancelar')).toBe(true);
```

Quem ainda tem só `matriz.chamados.tarefas.excluir` deixa de cancelar no front. A compatibilidade (nova + legada) é o que o teste protege.

## M8 — `catalogCheckboxLabel` ignora `actionLabels` (T9)

- Arquivo: `frontend/lib/permissions-matrix.ts` (`catalogCheckboxLabel`)
- Alteração: `return funcao.actionLabels?.[acao] ?? ...` virou o fallback `funcao.label · ação`.
- Teste vermelho: `aria-label e title da matriz para tarefas/alterar usam Alterar dados da tarefa`

Saída:

```
FAIL  frontend/lib/permissions-matrix.spec.ts > permissions-matrix — rotina de tarefas (269) > aria-label e title da matriz para tarefas/alterar usam Alterar dados da tarefa
AssertionError: expected 'Tarefas do chamado · Alterar' to be 'Alterar dados da tarefa' // Object.is equality

Expected: "Alterar dados da tarefa"
Received: "Tarefas do chamado · Alterar"

 ❯ frontend/lib/permissions-matrix.spec.ts:39:20
    38|     const rotulo = catalogCheckboxLabel(TAREFAS_CATALOGO, 'alterar');
    39|     expect(rotulo).toBe(TAREFA_BOTAO_ALTERAR_DADOS);
```

O `aria-label`/`title` da célula `tarefas`/`alterar` deixa de ser "Alterar dados da tarefa" e volta ao genérico "Tarefas do chamado · Alterar".

## M9 — a seção de histórico renderiza sem `podeVerHistorico` (T11)

- Arquivo: `frontend/components/chamados/chamado-tarefa-sheet.tsx` (`ChamadoTarefaHistoricoView`)
- Alteração: removeu `if (!tarefa.podeVerHistorico) return null;`.
- Teste vermelho: `com podeVerHistorico false, a seção de histórico não é renderizada`

Saída:

```
FAIL  frontend/lib/chamado-tarefa-permissoes.spec.ts > render das ações de tarefa > com podeVerHistorico false, a seção de histórico não é renderizada
AssertionError: expected '\'use client\';\n\nimport { useEffect…' to contain 'if (!tarefa.podeVerHistorico) return …'

 ❯ frontend/lib/chamado-tarefa-permissoes.spec.ts:109:22
    109|     expect(sheetSrc).toContain('if (!tarefa.podeVerHistorico) return null;');
```

Sem o early-return, a view de histórico deixa de ser recusada quando `podeVerHistorico` é falso. O `renderToStaticMarkup` do cabeçalho continua vazio, mas o guard da seção no sheet some.

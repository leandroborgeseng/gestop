# Mutações 253 (não commitadas no código)

As três mutações abaixo foram aplicadas localmente, fizeram o teste indicado ficar vermelho e foram revertidas. O código da branch permanece sem elas.

## M1 — remover a checagem de vínculo tarefa↔chamado

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`exigirAcessoChamadoViaTarefa`)
- Alteração: removeu `if (tarefa.chamadoId !== chamadoId) throw ForbiddenException(...)`.
- Teste vermelho: `tarefa de outro chamado não dá acesso (vínculo validado)`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — leitura do chamado via tarefa > tarefa de outro chamado não dá acesso (vínculo validado)
AssertionError: expected NotFoundException: Chamado não encontrado. { …(3) } to be an instance of ForbiddenException
 ❯ src/chamados/chamado-tarefas.service.spec.ts:440:5
    438|     await expect(
    439|       service.getChamadoLeituraViaTarefa('tarefa-1', 'chamado-outro', …
    440|     ).rejects.toBeInstanceOf(ForbiddenException);
```

Sem o vínculo, a leitura segue para o chamado pedido e não recusa a tarefa de outro chamado.

## M2 — liberar ação de gestão via tarefa

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`recusarGestaoChamadoViaTarefa`)
- Alteração: substituiu `throw new ForbiddenException('Via tarefa o chamado é somente leitura.')` por `return undefined as never`.
- Teste vermelho: `via tarefa, ações de gestão do chamado continuam negadas`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — leitura do chamado via tarefa > via tarefa, ações de gestão do chamado continuam negadas
AssertionError: promise resolved "undefined" instead of rejecting
 ❯ src/chamados/chamado-tarefas.service.spec.ts:449:99
    449|     await expect(service.recusarGestaoChamadoViaTarefa('tarefa-1', 'ch…
```

## M3 — unificar os eventos de responsável e equipe num só

- Arquivo: `src/chamados/chamado-tarefa.regras.ts` (`eventosAtribuicaoTarefa`)
- Alteração: as duas mudanças passaram a gerar um único evento `responsavel`.
- Teste vermelho: `trocar responsável e equipe juntos gera dois eventos distintos`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — auditoria de responsável e equipe > trocar responsável e equipe juntos gera dois eventos distintos
AssertionError: expected [ 'responsavel' ] to deeply equal [ 'responsavel', 'equipe' ]

- Expected
+ Received

  [
    "responsavel",
-   "equipe",
  ]
 ❯ src/chamados/chamado-tarefas.service.spec.ts:581:39
```

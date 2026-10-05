# Mutações 269 (não commitadas no código)

As quatro mutações abaixo foram aplicadas localmente, fizeram o teste indicado ficar vermelho e foram revertidas. O código da branch permanece sem elas.

## M1 — `podeVerHistorico` volta a `true` fixo

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`serialize`)
- Alteração: `podeVerHistorico: this.podeVerHistorico(user)` → `podeVerHistorico: true`.
- Teste vermelho: `sem tarefas_historico.visualizar não devolve histórico nem anexos`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — permissões 269 > sem tarefas_historico.visualizar não devolve histórico nem anexos
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

 ❯ frontend/lib/chamado-tarefa-permissoes.spec.ts:64:22
     64|     expect(html).not.toContain(TAREFA_BOTAO_ALTERAR_DADOS);
```

A paridade quebra: a API pode recusar (403) e a UI ainda oferece o botão.

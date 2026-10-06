# Mutações 253 (não commitadas no código)

As mutações abaixo foram aplicadas localmente, fizeram o teste indicado ficar vermelho e foram revertidas. O código da branch permanece sem elas.

## M1 — remover a checagem de vínculo tarefa↔chamado (refeita)

- Arquivo: `src/chamados/chamado-tarefas.service.ts` (`exigirAcessoChamadoViaTarefa`)
- Alteração: removeu `if (tarefa.chamadoId !== chamadoId) throw ForbiddenException(...)`.
- Mock: `chamado.findFirst` e `historicoStatus.findMany` devolvem dados do outro chamado (não `null`).
- Teste vermelho: `tarefa de outro chamado não dá acesso (vínculo validado)`

Saída:

```
FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — leitura do chamado via tarefa > tarefa de outro chamado não dá acesso (vínculo validado)
AssertionError: promise resolved "{ chamadoId: 'chamado-1', …(4) }" instead of rejecting

- Expected
+ Received

- Error {
-   "message": "rejected promise",
+ {
+   "anexosAbertura": [
+     {
+       "id": "ev-vazamento",
+       "nome": "segredo-do-outro.jpg",
+       "url": "/storage/segredo.jpg",
+       …
+     },
+   ],
+   "historico": [
+     {
+       "id": "h-vazamento",
+       "motivo": "Segredo do outro chamado",
+       "metadata": { "descricao": "não deveria vazar", "tipo": "HISTORY_UPDATE" },
+       …
+     },
+   ],
+   "somenteLeitura": true,
  }

 ❯ src/chamados/chamado-tarefas.service.spec.ts:507:5
    505|     await expect(
    506|       service.getChamadoLeituraViaTarefa('tarefa-1', 'chamado-outro', …
    507|     ).rejects.toBeInstanceOf(ForbiddenException);
```

Sem o vínculo, a leitura segue para o chamado pedido, chama `chamado.findFirst` / `historicoStatus.findMany` e devolve anexos e histórico do outro chamado. Não é mais um `NotFoundException` por mock nulo.

## M2 — abrir uma rota real de gestão do chamado para o usuário da tarefa

- Arquivo: `src/auth/secretaria-scope.ts` (`assertChamadoSecretariaAccess` e `assertChamadoExecucaoAccess`)
- Alteração: `return` imediato no check de acesso do chamado (aceita o usuário da tarefa como se tivesse acesso direto).
- Testes vermelhos da regressão real (`chamados.gestao-via-tarefa.spec.ts`):
  - `usuário da tarefa sem acesso ao chamado não registra histórico`
  - `usuário da tarefa sem acesso ao chamado não muda status`

Saída:

```
FAIL  src/chamados/chamados.gestao-via-tarefa.spec.ts > gestão real do chamado permanece fechada para o usuário da tarefa > usuário da tarefa sem acesso ao chamado não registra histórico
AssertionError: promise resolved "{ id: 'chamado-1', …(14) }" instead of rejecting
 ❯ src/chamados/chamados.gestao-via-tarefa.spec.ts:109:5
    107|     await expect(
    108|       service.registrarHistorico('chamado-1', { descricao: 'Comentário…
    109|     ).rejects.toBeInstanceOf(ForbiddenException);

FAIL  src/chamados/chamados.gestao-via-tarefa.spec.ts > gestão real do chamado permanece fechada para o usuário da tarefa > usuário da tarefa sem acesso ao chamado não muda status
AssertionError: expected TypeError: Cannot read properties of unde… to be an instance of ForbiddenException
 ❯ src/chamados/chamados.gestao-via-tarefa.spec.ts:117:5
    115|     await expect(
    116|       service.updateStatus('chamado-1', { status: ChamadoStatus.CANCEL…
    117|     ).rejects.toBeInstanceOf(ForbiddenException);
```

Liberar o check real de acesso do chamado deixa o usuário da tarefa registrar histórico (a mutação resolve em vez de recusar) e tenta mudar status. Os stubs `POST/PUT/DELETE :id/chamado/:chamadoId/{historico,status,anexos,encerrar}` não existem mais.

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
 ❯ src/chamados/chamado-tarefas.service.spec.ts:628:39
```

## M4 — vazar campo fora da whitelist

- Arquivo: `src/chamados/chamado-historico.projecao.ts` (`projetarMetadataHistoricoChamado`)
- Alteração: devolve o `metadata` bruto (`{ ...fonte }`) em vez de recortar pelos campos da ficha.
- Testes vermelhos:
  - `mantém só os campos que a ficha do chamado exibe`
  - `não devolve campo interno de metadata fora da whitelist da ficha`

Saída:

```
FAIL  src/chamados/chamado-historico.projecao.spec.ts > projetarMetadataHistoricoChamado > mantém só os campos que a ficha do chamado exibe
AssertionError: expected { tipo: 'HISTORY_UPDATE', …(4) } to not have property "tokenInterno"
+ Received:
"segredo-nao-pode-sair"
 ❯ src/chamados/chamado-historico.projecao.spec.ts:19:27

FAIL  src/chamados/chamado-tarefas.service.spec.ts > ChamadoTarefasService — leitura do chamado via tarefa > não devolve campo interno de metadata fora da whitelist da ficha
AssertionError: expected { tipo: 'HISTORY_UPDATE', …(3) } to not have property "tokenInterno"
+ Received:
"segredo-nao-pode-sair"
 ❯ src/chamados/chamado-tarefas.service.spec.ts:456:26
```

Sem a whitelist, `tokenInterno` (e `storageKeyInterna`) voltam na leitura via tarefa.

## M5 — tirar um campo lido da whitelist (`relatorio`)

- Arquivo: `src/chamados/chamado-historico.projecao.ts` (`CAMPOS_METADATA_HISTORICO_CHAMADO`)
- Alteração: removeu `'relatorio'` (campo que a ficha e o PDF leem). Equivale a R6 do script do Tester.
- Testes vermelhos:
  - `preserva todos os campos que a ficha e o PDF leem e descarta o intruso`
  - `devolve os mesmos campos da whitelist que a timeline e o PDF leem, sem o intruso`

Saída:

```
FAIL  src/chamados/chamado-historico.projecao.spec.ts > projetarMetadataHistoricoChamado > preserva todos os campos que a ficha e o PDF leem e descarta o intruso
AssertionError: campo lido pela ficha/PDF fora da whitelist: relatorio: expected [ 'tipo', 'descricao', …(19) ] to include 'relatorio'
 ❯ src/chamados/chamado-historico.projecao.spec.ts:95:9

FAIL  src/chamados/chamados.enrich-historico.spec.ts > enrichHistorico na ficha normal do chamado > devolve os mesmos campos da whitelist que a timeline e o PDF leem, sem o intruso
AssertionError: campo relatorio deveria sair igual na ficha: expected undefined to deeply equal 'Relatório de execução'
 ❯ src/chamados/chamados.enrich-historico.spec.ts:171:77

 Test Files  2 failed | 8 passed (10)
      Tests  2 failed | 47 passed (49)
```

Trocar o `entidadeId` no `where` (R11 do Tester) também fica vermelho: 2 failed | 47 passed.

## Script do Tester (`qa253-mut-v2.sh`)

Rodei o script anexado (só ajustei o `cd` para `/workspace`; as mutações perl não foram editadas). `--exclude "**/checklist-item.rules.spec.ts"`. Nenhuma mutação saiu SOBREVIVEU nem NÃO APLICOU.

```
R1_sem_vinculo_tarefa_chamado: VERMELHO ( Tests 1 failed | 48 passed (49))
R2_sem_podeVer: VERMELHO ( Tests 1 failed | 48 passed (49))
R3_via_tarefa_metadata_bruto: VERMELHO ( Tests 1 failed | 48 passed (49))
R4_ficha_normal_metadata_bruto: VERMELHO ( Tests 1 failed | 48 passed (49))
R5_whitelist_sem_alteracoes: VERMELHO ( Tests 2 failed | 47 passed (49))
R6_whitelist_sem_relatorio: VERMELHO ( Tests 2 failed | 47 passed (49))
R7_whitelist_sem_checklistComplementar: VERMELHO ( Tests 2 failed | 47 passed (49))
R8_anexos_historico_todas_evidencias: VERMELHO ( Tests 1 failed | 48 passed (49))
R9_abertura_inclui_execucao: VERMELHO ( Tests 1 failed | 48 passed (49))
R10_evento_unico: VERMELHO ( Tests 1 failed | 48 passed (49))
R11_historico_de_outro_chamado: VERMELHO ( Tests 2 failed | 47 passed (49))
R12_front_mostra_botao_gestao: VERMELHO ( Tests 1 failed | 48 passed (49))
```

# Importar camadas do Webmap

Manual de utilização · Designer UX · 20/10/2026 · conferido no código da 296 (`d087f62`, telas iguais ao `09de88a`).
Destino no repo: `docs/manual/webmap-camadas.md`.

## Para que serve
Traz para o SIGMA as camadas geográficas do Webmap (grupos, camadas, estilos e elementos), para uso nos mapas. **Não altera** próprios públicos, Secretarias, chamados, coordenadas nem endereços.

> Atenção: na mesma aba existem os botões "Aplicar tudo (Secretarias + Webmap)" e "Aplicar tudo (só Webmap)". Esses **mexem em próprios públicos**. Para trazer só as camadas, use o bloco **Camadas do Webmap** descrito aqui.

## Quem pode usar
Só quem tem a permissão de **Administração › Importação**. Sem ela, os botões não aparecem.

## Passo a passo
1. Abra **Administração** e clique na aba **Importação**.
2. Desça até o bloco **Camadas do Webmap**. A linha de cima mostra quantas camadas estão ativas e quantas foram removidas da origem.
   ![Print W01 — bloco Camadas do Webmap](PRINT-W01)
3. Clique em **Importar apenas camadas Webmap**. O botão mostra "Simulando…" e, abaixo, as fases ("Lendo a fonte do Webmap…", "Comparando com as camadas já importadas…").
4. A **simulação** não grava nada no mapa. Ao terminar, aparece "Simulação: Sucesso", "OK com avisos" ou "Parcial", com os totais: grupos, camadas, pontos, linhas, polígonos, corrigidos, irreparáveis, e camadas atualizadas, sem mudança, reativadas e removidas da origem.
   ![Print W02 — resultado da simulação](PRINT-W02)
5. Confira o prazo: "Simulação válida até HH:MM (BRT)". A simulação vale por 30 minutos e enquanto a fonte não mudar.
6. Se houver elementos irreparáveis, a lista mostra grupo › camada e o número do elemento. Clique em **Baixar CSV com todos os erros** para ver todos.
7. Clique em **Aplicar**. A aplicação roda em segundo plano (cerca de 1 minuto na base de hoje). Você pode sair da tela; ao voltar, ela mostra a fase atual ou o resultado.
   ![Print W03 — aplicação em andamento](PRINT-W03)
8. Ao terminar, aparece "Última aplicação: Sucesso / OK com avisos / Parcial (data e hora, usuário)".
   ![Print W04 — última aplicação Parcial com CSV](PRINT-W04)
9. Em **Histórico**, veja cada simulação e aplicação com data, resultado e quem fez.

## O que significa cada resultado
- **Sucesso:** tudo importado sem ajuste.
- **OK com avisos:** algumas geometrias foram corrigidas automaticamente e importadas.
- **Parcial:** alguns elementos não puderam ser corrigidos. Eles ficam guardados como geometria inválida, **não aparecem no mapa** e estão no CSV. O restante foi importado normalmente.
- **Falha:** a importação não terminou. "Nada foi alterado: a versão anterior das camadas continua ativa." Simule novamente.

## Situações comuns
- **"O prazo da simulação venceu; simule novamente."** Passaram 30 minutos ou a fonte mudou. Clique de novo em Importar apenas camadas Webmap.
- **"Importação de camadas em andamento"**, com nome e horário: outra pessoa está aplicando. Aguarde terminar e simule de novo.
  ![Print W05 — em andamento por outro usuário](PRINT-W05)
- **Camadas no mapa:** as camadas importadas entram **desligadas** nos mapas. Quem usa o CCO liga cada uma quando quiser (ver capítulo da 299/298, quando entrarem).

## Prints (Tester, app local com dados de teste, 1280 px, pt-BR, usuário de teste com permissão de Importação)
| Nº | Arquivo | Estado |
|---|---|---|
| W01 | w01-bloco-camadas-1280.png | bloco antes de simular |
| W02 | w02-simulacao-1280.png | simulação Parcial com totais, prazo e lista de erros |
| W03 | w03-aplicando-1280.png | aplicação em andamento com a fase |
| W04 | w04-ultima-parcial-1280.png | última aplicação Parcial e botão do CSV |
| W05 | w05-andamento-outro-1280.png | alerta "em andamento" visto por outro usuário de teste |
| W06 | w06-historico-1280.png | Histórico aberto |
Pasta: `/workspace/fabrica/gestop/296/manual/prints/`. Eu marco depois.

## PENDENTE
- Texto exato do erro quando a fonte do Webmap está fora do ar.

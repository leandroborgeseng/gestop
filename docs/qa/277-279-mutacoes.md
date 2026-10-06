# Mutações 277/279

Critério de pronto: as 18 mutações do Tester (`qa277-mut-v2.sh`) devem marcar **VERMELHO**. O script v2 exclui `checklist-item.rules.spec.ts` (falha herdada da `main`) e não confunde sobrevivente com vermelho.

```bash
npx vitest run src/checklists src/chamados src/documentos src/fiscalizacoes src/relatorios frontend/lib \
  --exclude "**/checklist-item.rules.spec.ts" \
  --exclude "**/node_modules/**"
```

| Mutação | Arquivo | O que quebra se sobreviver |
|---|---|---|
| P1 | `checklist-resposta-apresentacao.ts` | JSON `["Bom","Ótimo"]` permanece cru |
| P2 | `checklist-resposta-apresentacao.ts` | seção nunca aparece |
| P3 | `checklist-resposta-apresentacao.ts` | código técnico no título |
| P4 | `frontend/lib/checklist-item-opcoes.ts` | valor cru na tela |
| P5 | `frontend/lib/checklist-item-opcoes.ts` | seção nunca aparece na tela |
| P6 | `documentos-pdf.ts` | código no título do PDF de documento |
| P7 | `relatorio-execucao-pdf.ts` | código no título do PDF de execução |
| P8 | `vistoria-manual-pdf.ts` | código no título do PDF manual |
| P9 | `vistoria-realizada-pdf.ts` | código no título do PDF de vistoria |
| P10 | `vistoria-realizada-pdf.ts` | cabeçalho de seção repetido |
| P11 | `chamados-detail-pdf.ts` | valor cru no histórico do chamado |
| P12 | `fiscalizacoes.service.ts` | valor cru ao montar o PDF de vistoria |
| P13 / M4 | `documentos.service.ts` `buildRelatorioExecucaoFromDocumento` | valor cru no relatório de execução gerado pelo serviço |
| P14 / M5 | `documentos.service.ts` `formatRespostaTexto` | valor cru no PDF de documento avulso |
| P15 / M6 | `chamados.service.ts` `formatExecucaoRespostaTexto` | valor cru no PDF de execução do chamado |
| P16 / M7 | `chamados/page.tsx` | código técnico na origem NC do chamado |
| P17 / M8 | `unidade-drawer.tsx` | código técnico na NC do drawer CCO |
| P18 / M9 | `chamados-detail-pdf.ts` origem NC | código técnico no PDF do chamado com NC |

## Verde (após restaurar)

```
 Test Files  4 passed (4)
      Tests  17 passed (17)
```

(specs novos de serviço/front/PDF NC, mais os de apresentação já existentes no glob)

## M1 — `resolveRespostaTexto` devolve `valorTexto` cru (P1)

Alteração temporária (não commitada): `return resposta.valorTexto.trim()` em vez de `apresentarValorTexto(...)`.

```
 FAIL  resolveRespostaTexto … formata múltipla nova gravada como JSON array
AssertionError: expected '["Bom","Ótimo"]' to be 'Bom, Ótimo'
Received: "["Bom","Ótimo"]"
```

## M2 — agrupamento por seção desligado (P2)

Alteração temporária: `deveExibirCabecalhoSecao` sempre `false`.

```
 FAIL  título e seção (279) > exibe cabeçalho só na primeira pergunta do grupo consecutivo
AssertionError: expected false to be true
```

## M3 — código técnico de volta no título (P3)

Alteração temporária: `tituloPerguntaChecklist` retorna `` `${codigo} — ${titulo}` ``.

```
 FAIL  nunca inclui código no título visível
AssertionError: expected 'ZZ-COD-002 — Estado do piso' to be 'Estado do piso'
```

## M4 — P13 `DocumentosService.buildRelatorioExecucaoFromDocumento` usa `valorTexto` cru

Alteração temporária: `const respostaTexto = (typeof item.valorTexto === "string" && item.valorTexto.trim()) || resolveRespostaTexto({...})`.

```
 FAIL  P13 monta o relatório de execução a partir do documento com valor formatado
AssertionError: expected 'Relatório de execução DOC-1 · CH-1 …' to contain 'Bom, Ótimo'

 FAIL  não usa valorTexto cru nos formatadores do serviço (P13/P14)
AssertionError: expected … to contain 'const respostaTexto = resolveRespostaTexto({'
```

## M5 — P14 `DocumentosService.formatRespostaTexto` usa `valorTexto` cru

Alteração temporária: `return resposta.valorTexto?.trim() || resolveRespostaTexto(resposta)`.

```
 FAIL  P14 formatRespostaTexto e respostaValorTexto: JSON, única e texto livre
AssertionError: expected '["Bom","Ótimo"]' to be 'Bom, Ótimo'

 FAIL  monta o PDF de documento avulso com valor formatado
AssertionError: expected 'SIGMA · Documento DOC-AV …' to contain 'Bom, Ótimo'
```

## M6 — P15 `ChamadosService.formatExecucaoRespostaTexto` usa `valorTexto` cru

Alteração temporária: `return item.valorTexto?.trim() || resolveRespostaTexto(item)`.

```
 FAIL  P15 formatExecucaoRespostaTexto: JSON, única e texto livre
AssertionError: expected '["Bom","Ótimo"]' to be 'Bom, Ótimo'

 FAIL  monta o PDF de execução com valor formatado
AssertionError: expected 'Relatório de execução CH-1 …' to contain 'Bom, Ótimo'
```

## M7 — P16 tela de chamado prefixa código na NC

Alteração temporária em `frontend/app/(authenticated)/chamados/page.tsx`: `{resumo.naoConformidade.item.codigo} — {resumo.naoConformidade.item.titulo}`.

O spec lê o JSX e renderiza o título com `renderToStaticMarkup`.

```
 FAIL  P16 chamados/page.tsx mostra só o título da NC, sem código técnico
AssertionError: expected … not to contain '{resumo.naoConformidade.item.codigo} — {resumo.naoConformidade.item.titulo}'
```

## M8 — P17 drawer CCO prefixa código na NC

Alteração temporária em `frontend/components/cco/unidade-drawer.tsx`: `{item.item.codigo} — {item.item.titulo}`.

```
 FAIL  P17 unidade-drawer.tsx mostra só o título da NC, sem código técnico
AssertionError: expected … not to contain '{item.item.codigo} — {item.item.titulo}'
```

## M9 — P18 PDF do chamado com origem NC prefixa código

Alteração temporária: `` `${chamado.naoConformidade.item.codigo} — ${chamado.naoConformidade.item.titulo}` `` no bloco Origem (NC).

```
 FAIL  P18 origem NC no PDF usa só o título, sem código técnico
AssertionError: expected … not to contain 'ZZ-COD-NC'
```

Todas as mutações foram revertidas. O PDF ANTES (main) foi gerado com as três regressões originais juntas; o DEPOIS, com o código restaurado. Arquivos em `/opt/cursor/artifacts/`.

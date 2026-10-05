# Mutações 277/279

Testes alvo:

```bash
npx vitest run src/checklists/checklist-item-presentation.spec.ts \
  src/fiscalizacoes/vistoria-realizada-pdf.spec.ts \
  src/documentos/documentos-pdf.spec.ts
```

Os PDFs de vistoria e de documento passam por `resolveRespostaTexto`, `deveExibirCabecalhoSecao` e `tituloPerguntaChecklist` em `src/checklists/checklist-resposta-apresentacao.ts` (o `FiscalizacoesService` só reutiliza essa função ao montar o PDF).

## Verde (após restaurar)

```
 Test Files  3 passed (3)
      Tests  8 passed (8)
```

## M1 — `resolveRespostaTexto` devolve `valorTexto` cru

Alteração temporária (não commitada): `return resposta.valorTexto.trim()` em vez de `apresentarValorTexto(...)`.

```
 FAIL  resolveRespostaTexto … formata múltipla nova gravada como JSON array
AssertionError: expected '["Bom","Ótimo"]' to be 'Bom, Ótimo'
Received: "["Bom","Ótimo"]"

 FAIL  PDF de vistoria realizada
AssertionError: expected … to contain 'Bom, Ótimo'
Received: "… Resposta: ["Bom","Ótimo"] (CONFORME) … Resposta: ["Bom","Regular"] …"

 FAIL  PDF de documento
AssertionError: expected … to contain 'Bom, Ótimo'
Received: "… Resposta: ["Bom","Ótimo"] … Resposta: ["Bom","Regular"] …"

 Test Files  3 failed (3)
      Tests  3 failed | 5 passed (8)
```

## M2 — agrupamento por seção desligado

Alteração temporária: `deveExibirCabecalhoSecao` sempre `false`.

```
 FAIL  título e seção (279) > exibe cabeçalho só na primeira pergunta do grupo consecutivo
AssertionError: expected false to be true

 FAIL  PDF de documento
AssertionError: expected +0 to be 1
  contarOcorrencias(texto, 'Infraestrutura básica')

 FAIL  PDF de vistoria realizada
AssertionError: expected +0 to be 1
  contarOcorrencias(texto, 'Infraestrutura básica')

 Test Files  3 failed (3)
      Tests  3 failed | 5 passed (8)
```

## M3 — código técnico de volta no título (vistoria e documento)

Alteração temporária: `tituloPerguntaChecklist` retorna `` `${codigo} — ${titulo}` ``.

```
 FAIL  nunca inclui código no título visível
AssertionError: expected 'ZZ-COD-002 — Estado do piso' to be 'Estado do piso'

 FAIL  PDF de documento
AssertionError: expected … not to contain 'ZZ-COD-001'
Received: "… ZZ-COD-001 — Estado das paredes internas Resposta: Bom, Ótimo …"

 FAIL  PDF de vistoria realizada
AssertionError: expected … not to contain 'ZZ-COD-001'
Received: "… 1. ZZ-COD-001 — Estado das paredes internas … Resposta: Bom, Ótimo …"

 Test Files  3 failed (3)
      Tests  3 failed | 5 passed (8)
```

Todas as mutações foram revertidas. O PDF ANTES (main) foi gerado com as três regressões juntas; o DEPOIS, com o código restaurado. Arquivos em `/opt/cursor/artifacts/`.

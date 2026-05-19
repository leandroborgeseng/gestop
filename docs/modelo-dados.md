# GestOP - Modelo de Dados Base

Este documento descreve a fundacao de dados do GestOP para os modulos de cadastros, fiscalizacao georreferenciada, checklists versionados, nao conformidades, ordens de servico, auditoria, dashboards e sincronizacao offline-first.

## Stack de Persistencia

- Backend: NestJS com TypeScript.
- ORM: Prisma 7.
- Banco: PostgreSQL com PostGIS.
- Banco local/PWA futuro: IndexedDB com sincronizacao posterior via `OfflineSyncEvent`.

## Diagrama Textual

```text
Secretaria 1 ── N UnidadePublica
Secretaria 1 ── N Usuario
Secretaria 1 ── N Checklist
Secretaria 1 ── N Fiscalizacao
Secretaria 1 ── N OrdemServico

Usuario N ── N Perfil via UsuarioPerfil
Perfil N ── N Permissao via PerfilPermissao

Checklist 1 ── N ChecklistVersao
ChecklistVersao 1 ── N ChecklistItem
ChecklistVersao 1 ── N Fiscalizacao

UnidadePublica 1 ── N Fiscalizacao
Usuario(Agente) 1 ── N Fiscalizacao
Fiscalizacao 1 ── N RespostaChecklist
ChecklistItem 1 ── N RespostaChecklist

RespostaChecklist 1 ── 0..1 NaoConformidade
Fiscalizacao 1 ── N NaoConformidade
NaoConformidade 1 ── 0..1 OrdemServico

Fiscalizacao 1 ── N Evidencia
RespostaChecklist 1 ── N Evidencia
NaoConformidade 1 ── N Evidencia
OrdemServico 1 ── N Evidencia

OrdemServico, Fiscalizacao e demais entidades ── N HistoricoStatus
Usuario 1 ── N LogAuditoria
Usuario 1 ── N OfflineSyncEvent
Secretaria/UnidadePublica 1 ── N DashboardSnapshot
```

## Entidades Principais

`Secretaria` representa a estrutura administrativa municipal e isola cadastros, usuarios, fiscalizacoes, ordens de servico e indicadores.

`UnidadePublica` representa o proprio publico fiscalizado. Mantem latitude, longitude, raio de validacao em metros e metadados. A migracao adiciona coluna PostGIS gerada e indice GiST para consultas geoespaciais.

`Usuario`, `Perfil`, `Permissao`, `UsuarioPerfil` e `PerfilPermissao` formam o RBAC. Perfis podem ser de sistema e usuarios podem acumular papeis.

`Checklist`, `ChecklistVersao` e `ChecklistItem` separam o modelo logico do checklist de suas versoes publicadas. Uma fiscalizacao sempre aponta para `ChecklistVersao`, garantindo que alteracoes futuras nao modifiquem vistorias antigas.

`Fiscalizacao` registra execucao em campo com check-in/check-out, precisao GPS, distancia calculada, status e origem. O campo `clientId` permite idempotencia para criacoes offline vindas do PWA.

`RespostaChecklist` guarda respostas por item e fiscalizacao. A constraint `unique(fiscalizacaoId, itemId)` evita duplicidade de resposta para o mesmo item.

`Evidencia` centraliza fotos, videos, documentos e assinaturas, podendo se vincular a fiscalizacao, resposta, nao conformidade ou ordem de servico.

`NaoConformidade` materializa uma resposta nao conforme, com severidade, status, localizacao e flag `evidenciaObrigatoriaAtendida`.

`OrdemServico` cobre demandas manuais, originadas por nao conformidade, QR Code ou integracao. `HistoricoStatus` registra transicoes de status de forma generica.

`LogAuditoria` registra acoes relevantes com usuario, entidade, valores antigos/novos, IP, user agent e correlation id.

`OfflineSyncEvent` registra eventos enviados pelo PWA, com operacao, payload, status, tentativas, conflitos e datas de recebimento/sincronizacao.

`DashboardSnapshot` prepara armazenamento de metricas agregadas para paineis sem acoplar dashboards a queries operacionais pesadas.

## Regras Estruturais

- Raio geografico padrao: `UnidadePublica.raioValidacaoMetros` com default de 200 m.
- Precisao GPS recomendada: validacao de dominio bloqueia registros acima de 50 m.
- Latitude e longitude: constraints SQL garantem faixas validas.
- PostGIS: a migracao cria colunas `geography(Point, 4326)` geradas e indices GiST em unidades, fiscalizacoes, evidencias e nao conformidades.
- Evidencia obrigatoria: `ChecklistItem.exigeEvidencia` e `NaoConformidade.evidenciaObrigatoriaAtendida` sustentam a regra de nao conformidade com foto/comentario.
- Versionamento: `Fiscalizacao.checklistVersaoId` usa `onDelete: Restrict`, preservando a versao usada na execucao.
- Auditoria: `LogAuditoria` armazena diffs em JSON e `HistoricoStatus` armazena mudancas de status.
- Offline-first: `OfflineSyncEvent.clientEventId` e `Fiscalizacao.clientId` permitem idempotencia, rastreio de conflitos e reprocessamento.

## Seeds de Desenvolvimento

O seed cria:

- 3 secretarias: Educacao, Saude e Servicos/Meio Ambiente.
- 3 proprios publicos com coordenadas em Franca.
- Permissoes e perfis iniciais: Administrador, Gestor CCO, Agente de Campo e Operador de Manutencao.
- 4 usuarios de desenvolvimento.
- 1 checklist escolar publicado, com 3 itens.
- 1 fiscalizacao concluida com uma nao conformidade.
- 1 evidencia fotografica.
- 1 ordem de servico atribuida.
- Historico de status, evento offline sincronizado, dashboard snapshots e log de auditoria.

## Comandos

```bash
docker compose up -d postgres
npm run prisma:deploy
npm run prisma:seed
npm run build
npm test
npm run dev
```

## Decisoes de Modelagem

- O modelo usa normalizacao pragmatica: entidades operacionais ficam separadas, enquanto campos flexiveis de formulario, metadados e payloads offline usam JSON.
- O historico de status e generico para ser reaproveitado por OS, fiscalizacao, chamado futuro e outras entidades com workflow.
- A tabela de eventos offline nao substitui as tabelas de dominio; ela registra a chegada, processamento e resolucao dos eventos sincronizados.
- Dashboard foi modelado como snapshot para permitir evolucao futura para jobs, materialized views ou BI sem remodelar o dominio.
- A migracao SQL complementa o Prisma com recursos especificos do PostGIS que ainda nao sao bem expressos no schema Prisma.

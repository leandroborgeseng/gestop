Prefeitura Municipal de Franca

**PRD V2 – PLATAFORMA DE GESTÃO DE ORDENS DE SERVIÇO E FISCALIZAÇÃO GEORREFERENCIADA**

*Documento de Requisitos de Produto para Implementação e Governança Digital*

16 de maio de 2026

## **1\. Identificação do Documento**

Este documento estabelece as especificações funcionais, técnicas e operacionais para a implementação da solução de gestão de ativos e serviços da **Prefeitura Municipal de Franca**. O PRD V2 consolida os requisitos extraídos da proposta técnica **DailyDo** e as diretrizes de engenharia de software para viabilizar o desenvolvimento assistido por inteligência artificial e a execução por times multidisciplinares.

**ID do Documento:** PMF-PRD-OS-002

**Versão:** 2.0

**Status:** Final para Implementação

**Autor:** Engenharia de Produto / Consultoria de Arquitetura Digital

**Data:** 16 de maio de 2026

**Documentos de Referência:** DailyDo-PropTecnicaV2.docx; Estrutura-DOC-ANLISE-PRJ-PI.docx

**Iniciativa:** Modernização da Gestão de Próprios Públicos e Zeladoria Urbana

**Objetivo do Documento:** Servir como fonte única de verdade para o ciclo de vida de desenvolvimento, garantindo que a solução atenda aos requisitos de georreferenciamento, operação offline e autonomia administrativa da municipalidade.

## **2\. Sumário Executivo**

A **Prefeitura Municipal de Franca** enfrenta o desafio de gerir **165 próprios públicos** distribuídos em **9 secretarias**, demandando uma fiscalização rigorosa e uma resposta ágil a chamados de manutenção. A solução proposta é uma plataforma integrada composta por uma **Central de Controle Operacional (CCO) web** e um **aplicativo móvel nativo/híbrido**.

O sistema permitirá a transição do modelo analógico para uma gestão baseada em dados, onde cada vistoria é registrada com **evidências fotográficas, coordenadas GPS e carimbo de tempo (timestamp)**. Os principais benefícios esperados incluem a redução do tempo de resposta para manutenções, a transparência total na execução de serviços terceirizados ou próprios e a criação de um histórico auditável de cada ativo público do município.

## **3\. Contexto do Produto e Direcionadores**

O cenário atual é caracterizado pela fragmentação de informações entre secretarias e pela dificuldade de comprovação efetiva da presença de fiscais em campo. A motivação para este projeto reside na necessidade de otimização de recursos e na garantia de que os próprios públicos (escolas, unidades de saúde, parques) recebam a manutenção adequada conforme cronogramas parametrizados.

**Premissas Adotadas:**  
1\. A Prefeitura fornecerá a base inicial de dados dos 165 próprios públicos.  
2\. Os agentes de campo utilizarão dispositivos móveis com capacidade de GPS e câmera.  
3\. A solução deve operar em modo **offline-first** devido a zonas de sombra de conectividade em determinados ativos.

**Restrições Conhecidas:**  
1\. A solução deve respeitar integralmente a **Lei Geral de Proteção de Dados (LGPD)**.  
2\. O armazenamento de evidências (fotos) deve ser otimizado para não onerar excessivamente a infraestrutura de nuvem.

**Pontos que exigem validação adicional:**  
1\. Definição dos fluxos de integração com sistemas legados de protocolo da Prefeitura (recomendação de implementação).  
2\. Especificação das alçadas de aprovação financeira para ordens de serviço de alto valor.

## **4\. Visão do Produto**

**Proposta de Valor:** Garantir a integridade do patrimônio público de Franca através de fiscalização inteligente, georreferenciada e com autonomia total para a gestão municipal configurar suas próprias rotinas de controle.

**Objetivos do Produto:**  
1\. Digitalizar 100% das vistorias de próprios públicos.  
2\. Centralizar a gestão de chamados e ordens de serviço em uma única interface.  
3\. Prover dashboards em tempo real para tomada de decisão do gabinete e secretários.

**Atores e Perfis de Usuário:**

* **Administrador do Sistema:** Gestão de usuários, permissões e parametrização global.

* **Gestor da CCO:** Monitoramento do mapa, triagem de chamados e análise de indicadores.

* **Gestor de Secretaria:** Supervisão específica dos ativos e demandas de sua pasta.

* **Agente de Campo / Fiscal:** Execução de checklists e registro de evidências via aplicativo.

* **Operador de Manutenção:** Recebimento e execução de Ordens de Serviço (OS).

* **Solicitante Interno:** Abertura de chamados via portal ou QR Code.

## **5\. Escopo Funcional do Produto**

A solução é dividida em domínios funcionais que garantem a separação de responsabilidades e facilitam a implementação modular:

**5.1 Identidade e Acesso:** Autenticação segura via JWT, suporte a MFA (recomendação) e controle de acesso baseado em perfis (RBAC).

**5.2 Administração e Cadastros:** Gestão de Secretarias, Departamentos, Equipes e a base de 165 Próprios Públicos com metadados geográficos.

**5.3 Rotinas e Checklists:** Motor de criação de formulários dinâmicos que permite ao município criar checklists específicos para cada tipo de ativo (ex: Checklist de Escola vs. Checklist de Praça).

**5.4 Execução Mobile:** Interface simplificada para o fiscal, com suporte a captura de mídia, assinatura digital e sincronização resiliente.

**5.5 Gestão de Chamados e OS:** Ciclo de vida completo da demanda, desde a abertura (manual ou automática via fiscalização) até o encerramento com evidência de conclusão.

**5.6 Monitoramento e Auditoria:** Mapa interativo com plotagem de eventos e trilha de auditoria imutável para todas as ações críticas.

## **6\. Histórias de Usuário**

| ID | Ator | História de Usuário | Prioridade |
| ----- | ----- | ----- | ----- |
| US-001 | Administrador | Como administrador, quero parametrizar novos checklists para que o sistema se adapte a novas demandas de fiscalização sem necessidade de novo código. | Alta |
| US-002 | Agente de Campo | Como agente de campo, quero registrar uma vistoria em modo offline para que meu trabalho não seja interrompido em locais sem sinal de internet. | Crítica |
| US-003 | Gestor CCO | Como gestor da CCO, quero visualizar no mapa a localização exata de onde uma não conformidade foi registrada para otimizar o deslocamento da equipe de reparo. | Alta |
| US-004 | Gestor Secretaria | Como gestor de secretaria, quero receber alertas de chamados críticos em atraso para intervir na gestão operacional da minha pasta. | Média |
| US-005 | Solicitante | Como solicitante interno, quero abrir um chamado lendo um QR Code fixado no local para agilizar o relato de problemas sem preencher formulários extensos. | Média |

## **7\. Épicos, Features e Backlog Inicial**

**EP-01: Fundação da Plataforma**

**FT-01.01:** Módulo de Autenticação JWT e Gestão de Sessão.

**FT-01.02:** Estrutura de Multi-tenancy por Secretaria (Isolamento Lógico).

**Backlog:** Setup de ambiente, implementação de login, recuperação de senha, matriz de permissões.

**EP-02: Gestão de Ativos e Cadastros**

**FT-02.01:** Cadastro Georreferenciado de Próprios Públicos.

**FT-02.02:** Gestão de Equipes e Agentes.

**Backlog:** Importação de CSV/XLS de ativos, integração com mapas (Google/OSM), CRUD de secretarias.

**EP-03: Motor de Checklists e Fiscalização**

**FT-03.01:** Builder de Formulários Dinâmicos.

**FT-03.02:** Execução de Vistoria Mobile com Offline-first.

**Backlog:** Tipos de campos (texto, foto, múltipla escolha), lógica de sincronização, captura de coordenadas em background.

**EP-04: Ciclo de Vida de Chamados e OS**

**FT-04.01:** Abertura Automática por Não Conformidade.

**FT-04.02:** Workflow de Status (Aberto, Em Triagem, Em Execução, Concluído, Impedido).

**Backlog:** Atribuição de responsável, registro de insumos (recomendação), evidência de conclusão obrigatória.

## **8\. Módulos e Requisitos Funcionais**

**Módulo 1: Central de Controle Operacional (Web)**

* **RF-001:** O sistema deve permitir a visualização de todos os próprios públicos em um mapa interativo com clusters por secretaria.

* **RF-002:** O sistema deve permitir a criação de checklists customizados com definição de campos obrigatórios e tipos de evidência.

* **RF-003:** O sistema deve gerar automaticamente um chamado de manutenção sempre que um item de checklist for marcado como "Não Conforme" e possuir a flag de "Gerar OS".

* **RF-004:** O sistema deve disponibilizar dashboards de performance (tempo médio de atendimento, % de conformidade por secretaria).

**Módulo 2: Aplicativo de Campo (PWA Mobile)**

* **RF-005:** O PWA deve permitir a execução de tarefas baixadas previamente sem conexão ativa com a internet.

* **RF-006:** O aplicativo deve forçar a captura de coordenadas GPS no momento da abertura e do fechamento de cada item de vistoria.

* **RF-007:** O aplicativo deve permitir a anexação de múltiplas fotos por item, com marca d'água de data e hora (recomendação técnica).

## **9\. Regras de Negócio**

**RN-001 (Geolocalização):** Uma vistoria só pode ser iniciada se o agente estiver em um raio de 200 metros (configurável) das coordenadas cadastradas do próprio público.

**RN-002 (Evidência Obrigatória):** Todo item marcado como "Não Conforme" exige obrigatoriamente o upload de pelo menos uma foto e um comentário descritivo.

**RN-003 (Sincronização):** Dados coletados offline devem ser transmitidos para o servidor assim que uma conexão estável (Wi-Fi ou 4G) for detectada, priorizando dados textuais antes de mídias pesadas.

**RN-004 (Versionamento):** Alterações em modelos de checklist não afetam vistorias já iniciadas ou concluídas; o sistema deve manter o histórico da versão do formulário utilizada na época da execução.

## **10\. Requisitos Não Funcionais**

**RNF-001 (Disponibilidade):** A plataforma deve garantir disponibilidade de **99%** em regime 24x7.

**RNF-002 (Segurança):** Todos os dados em trânsito devem utilizar **TLS 1.3** e dados sensíveis em repouso devem ser criptografados com **AES-GCM**.

**RNF-003 (Desempenho):** O tempo de resposta para carregamento de listas e mapas na CCO não deve exceder 2 segundos para conexões padrão.

**RNF-004 (Escalabilidade):** A arquitetura deve suportar o crescimento para até 1.000 próprios públicos e 500 usuários simultâneos sem degradação de performance.

**RNF-005 (LGPD):** O sistema deve permitir a anonimização de dados de solicitantes externos após o encerramento do chamado, conforme política de retenção municipal.

## **11\. Critérios de Aceite**

**AC-01 (Sincronização Offline):** O sistema deve permitir completar um checklist de 20 itens com fotos sem internet e, ao conectar, todos os dados devem aparecer na CCO em menos de 60 segundos.

**AC-02 (Precisão GPS):** O sistema deve rejeitar registros de localização com margem de erro superior a 50 metros, solicitando nova captura ao usuário.

**AC-03 (Autonomia Administrativa):** Um usuário com perfil Administrador deve ser capaz de criar um novo tipo de serviço e associá-lo a uma secretaria sem intervenção do time de desenvolvimento.

## **12\. Jornadas de Usuário**

**Jornada A: Fiscalização de Rotina**

**Gatilho:** Cronograma semanal de vistorias.

**Fluxo:** Agente abre o app \- Seleciona Próprio Público \- Realiza Check-in \- Preenche Checklist \- Identifica lâmpada queimada \- Marca Não Conforme \- Tira Foto \- Finaliza Vistoria.

**Resultado:** Vistoria concluída e Chamado de Manutenção Elétrica aberto automaticamente para a Secretaria de Serviços.

**Jornada B: Atendimento de Chamado Externo**

**Gatilho:** Cidadão/Servidor lê QR Code em uma praça.

**Fluxo:** Abre formulário simplificado \- Descreve problema \- Anexa foto \- Envia.

**Resultado:** Chamado entra na triagem da CCO com coordenadas exatas do QR Code.

## **13\. Fluxos Operacionais**

**A) Fluxo de Operações do Projeto (Implementação):**

1\. **Discovery:** Validação da base de 165 ativos e definição de perfis.

2\. **Setup Técnico:** Provisionamento de infraestrutura e banco PostgreSQL.

3\. **Desenvolvimento Sprint:** Construção modular (Fundação \- Mobile \- CCO).

4\. **Homologação:** Testes de campo em 3 secretarias piloto.

5\. **Treinamento:** Capacitação de multiplicadores e agentes.

6\. **Go-live e Operação Assistida:** Acompanhamento presencial/remoto nos primeiros 30 dias.

**B) Fluxo de Operações da Solução (Negócio):**  
O fluxo inicia na **Parametrização** (criação de regras), segue para a **Distribuição** (atribuição de tarefas), passa pela **Execução** (campo), **Sincronização**, **Análise** (triagem na CCO) e encerra na **Mensuração** (KPIs e relatórios).

## **14\. Modelo de Dados Proposto (Conceitual)**

**Entidades Principais:**

* **Secretaria:** Nome, Responsável, Sigla.

* **ProprioPublico:** Nome, Tipo, Endereço, Coordenadas (Lat/Long), SecretariaID.

* **ChecklistModelo:** Título, Versão, Ativo (Booleano), JSON\_Estrutura.

* **TarefaExecucao:** AgenteID, ProprioID, ChecklistID, Status, DataInicio, DataFim.

* **Evidencia:** TarefaID, ItemID, URL\_Midia, Geolocalizacao, Timestamp.

* **Chamado:** Origem (Manual/Auto), Descricao, Prioridade, Status, Localizacao.

* **LogAuditoria:** UsuarioID, Acao, Tabela, ValorAntigo, ValorNovo, DataHora.

## **15\. Arquitetura da Solução em Alto Nível**

A solução adotará uma arquitetura de monolito modular na fase inicial, com possibilidade de evolução para microserviços conforme necessidade operacional, baseada em:

* **Backend:** NestJS com TypeScript para garantir modularidade, tipagem, testes e organização por domínios.

* **Banco de Dados:** PostgreSQL com extensão **PostGIS** para consultas espaciais eficientes.

* **ORM:** Prisma para modelagem, migrations e acesso tipado ao banco de dados.

* **Frontend Web:** Next.js com React e Tailwind CSS para a Central de Controle Operacional (CCO).

* **Mobile:** PWA responsivo construído no Next.js, com suporte a instalação, uso em campo, operação offline-first e sincronização resiliente.

* **Infraestrutura:** Containerização (Docker) e orquestração para facilitar o deploy e escalabilidade.

## **16\. Estratégia de Implementação Assistida por IA**

Para maximizar o uso de ferramentas como **OpenCode** e outros assistentes de codificação, este PRD deve ser consumido seguindo estes princípios:

**1\. Decomposição por Contexto:** Fornecer à IA um épico por vez, acompanhado das Regras de Negócio (Seção 9\) e Requisitos Não Funcionais (Seção 10\) específicos daquele domínio.

**2\. Definition of Ready (DoR):** Uma tarefa só deve ser enviada para geração de código se possuir o contrato de API definido e os critérios de aceite (Seção 11\) claros.

**3\. Validação de Regras:** Solicitar que a IA gere testes unitários que cubram explicitamente as RNs, como a validação de raio de GPS (RN-001).

**4\. Riscos de Geração:** Atenção redobrada à lógica de sincronização offline; recomenda-se que a arquitetura de persistência local do PWA (IndexedDB, cache de assets e fila de sincronização) seja revisada por um arquiteto sênior após a geração inicial.

## **17\. MVP, Releases e Plano de Desenvolvimento**

**Fase 1: MVP (Foco em Fiscalização e Cadastro)**  
\- Cadastro dos 165 próprios públicos.  
\- Gestão de usuários e perfis básicos.  
\- Builder de checklist simples.  
\- PWA mobile com operação offline, captura de fotos e sincronização resiliente.  
\- Mapa básico na CCO.

**Fase 2: Release 2 (Gestão de Demandas)**  
\- Workflow completo de Chamados e OS.  
\- Abertura automática via não conformidade.  
\- Dashboards operacionais.  
\- Alertas e notificações push.

**Fase 3: Release 3 (Inteligência e Integração)**  
\- Integração com sistemas externos da Prefeitura.  
\- Relatórios gerenciais avançados e BI.  
\- Portal do Cidadão com QR Code.

## **18\. Fora do Escopo da Etapa**

1\. Fornecimento de hardware (smartphones, tablets ou servidores físicos).  
2\. Integração com sistemas de folha de pagamento ou RH.  
3\. Gestão de frotas de veículos (foco exclusivo em próprios públicos e zeladoria).  
4\. Desenvolvimento de módulos de compras ou licitações.

## **19\. Riscos, Premissas e Itens para Validação**

**Risco de Adoção:** Resistência dos agentes de campo ao monitoramento GPS. *Mitigação:* Treinamento focado nos benefícios de segurança e comprovação do trabalho realizado.

**Risco de Conectividade:** Falha na sincronização de grandes volumes de fotos. *Mitigação:* Implementação de compressão de imagem no dispositivo antes do upload.

**Premissa de Dados:** A Prefeitura entregará a lista de ativos com coordenadas válidas. Caso contrário, a primeira tarefa dos agentes será o saneamento cadastral (coleta das coordenadas in loco).

## **20\. Conclusão Executiva**

O **PRD V2** apresenta uma solução robusta e moderna, alinhada às melhores práticas de engenharia de software e às necessidades específicas da **Prefeitura Municipal de Franca**. A estrutura modular e a clareza nas regras de negócio permitem que o desenvolvimento avance com agilidade, seja através de times tradicionais ou com suporte de IA generativa. Este documento encerra a fase de definição e serve como o guia mestre para a construção de uma ferramenta que transformará a zeladoria e a gestão do patrimônio público municipal.

Fim do Documento — PRD V2 Plataforma de Gestão de OS e Fiscalização
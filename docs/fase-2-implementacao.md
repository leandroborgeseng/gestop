# Fase 2 — Campo e operação (implementado)

## Mobile / PWA

- **GPS real** no check-in (`navigator.geolocation`) com fallback para coordenadas do próprio
- **Fila offline em IndexedDB** (migra automaticamente do localStorage antigo)
- **Sync automático** ao evento `online`
- **Tipos de checklist** no mobile: TEXTO, NUMERO, DATA, MULTIPLA_ESCOLHA, FOTO, ASSINATURA, BOOLEANO
- **`geraNaoConformidade`** respeitado no backend — só gera NC se o item permitir

## Ordens de Serviço

- Página de **detalhe** em `/ordens-servico/[id]`
- Histórico de status, origem auditável e galeria de evidências

## Segurança

- **Rate limit** global (120 req/min) via `@nestjs/throttler`
- Login limitado a **20 tentativas/min**
- **CORS** configurável via `CORS_ORIGINS` (vírgula-separado)
- **Troca de senha** em `/conta` + `POST /auth/change-password`

## Próximo (Fase 3)

- Homologação piloto e testes E2E
- LGPD (retenção/anonimização)
- Integrações reais (substituir mock)
- Recuperação de senha por e-mail
- Clustering no mapa CCO

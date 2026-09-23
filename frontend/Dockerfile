# syntax=docker/dockerfile:1
# SIGMA Web (Next.js) — imagem de produção para Coolify / Compose
FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048
# Embutida no bundle do browser no build. Sem ela, os tiles CARTO exibem “API KEY REQUIRED”.
ARG NEXT_PUBLIC_CARTO_API_KEY=
ENV NEXT_PUBLIC_CARTO_API_KEY=$NEXT_PUBLIC_CARTO_API_KEY

RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
# prepare-standalone.mjs achata server.js e embute start-standalone no standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Redundante com o bundle do prepare, mas garante npm start (Coolify) e CMD
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start-standalone.mjs ./start-standalone.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start-standalone.mjs ./scripts/start-standalone.mjs

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Preferencial: ./server.js (standalone em /app). Coolify pode sobrescrever com npm start.
CMD ["node", "start-standalone.mjs"]

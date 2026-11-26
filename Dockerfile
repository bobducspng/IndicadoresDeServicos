# Indicadores de Serviços — imagem para Google Cloud Run.
# Alvos (stages): "runtime" (o site, padrão) e "migrate" (Job que aplica as migrações do banco).

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app

# Dependências completas (build, testes e migrações)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Build do site (Vite -> dist/public) e do servidor (esbuild -> dist/index.js)
FROM deps AS build
COPY . .
RUN pnpm build

# Dependências somente de produção
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --prod

# Job de migrações: cria/atualiza as tabelas e roda antes de cada deploy
FROM deps AS migrate
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY scripts ./scripts
CMD ["sh", "-c", "node scripts/run-production-migrations.mjs && node scripts/ensure-role-enum.mjs"]

# Imagem final do site
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]

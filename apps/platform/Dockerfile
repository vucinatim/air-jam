FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY scripts ./scripts
COPY apps ./apps
COPY packages ./packages
COPY content ./content
COPY docs ./docs

RUN pnpm install --frozen-lockfile
RUN pnpm --filter platform build \
 && cp -r /app/apps/platform/.next/static /app/apps/platform/.next/standalone/apps/platform/.next/static \
 && cp -r /app/apps/platform/public /app/apps/platform/.next/standalone/apps/platform/public

WORKDIR /app/apps/platform

ENV HOSTNAME=0.0.0.0

CMD ["node", "/app/apps/platform/.next/standalone/apps/platform/server.js"]

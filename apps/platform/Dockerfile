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
RUN pnpm --filter platform build

WORKDIR /app/apps/platform

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["sh", "-lc", "cd .next/standalone && node apps/platform/server.js"]

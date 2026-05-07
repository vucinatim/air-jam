FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY scripts ./scripts
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @air-jam/server... build

CMD ["pnpm", "--filter", "@air-jam/server", "start"]

# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY packages/cli/package.json ./packages/cli/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/env/package.json ./packages/env/
COPY packages/server/package.json ./packages/server/
COPY packages/harness/package.json ./packages/harness/
COPY packages/devtools-core/package.json ./packages/devtools-core/
COPY packages/create-airjam/package.json ./packages/create-airjam/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY games/air-capture/package.json ./games/air-capture/
COPY games/code-review/package.json ./games/code-review/
COPY games/minimal/package.json ./games/minimal/
COPY games/pong/package.json ./games/pong/
COPY games/the-office/package.json ./games/the-office/
COPY games/last-band-standing/package.json ./games/last-band-standing/
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tsconfig.base.json ./
COPY scripts ./scripts
COPY packages ./packages
RUN pnpm --filter @air-jam/server... build
RUN pnpm --filter @air-jam/server deploy --prod /runtime

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /runtime ./
USER node
EXPOSE 4000
CMD ["node", "./bin/air-jam-server.mjs"]

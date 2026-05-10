FROM node:20-bookworm-slim

WORKDIR /app

# Public env vars baked into the Next.js client bundle at build time.
# Railway passes service variables as --build-arg; these ARG declarations
# expose them to `pnpm --filter platform build` so next.config.ts can
# resolve the production topology instead of falling back to localhost.
ARG NEXT_PUBLIC_AIR_JAM_SERVER_URL
ARG NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_AIR_JAM_APP_ID
ARG NEXT_PUBLIC_AUTH_GITHUB_ENABLED
ENV NEXT_PUBLIC_AIR_JAM_SERVER_URL=$NEXT_PUBLIC_AIR_JAM_SERVER_URL \
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST=$NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_AIR_JAM_APP_ID=$NEXT_PUBLIC_AIR_JAM_APP_ID \
    NEXT_PUBLIC_AUTH_GITHUB_ENABLED=$NEXT_PUBLIC_AUTH_GITHUB_ENABLED

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

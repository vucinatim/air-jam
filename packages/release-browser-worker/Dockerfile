FROM mcr.microsoft.com/playwright:v1.58.2-jammy AS browser-runtime

RUN apt-get update && apt-get install -y --no-install-recommends iproute2 socat \
    && apt-get clean
COPY --chmod=755 packages/release-browser-worker/runtime/chromium-isolated /usr/local/bin/airjam-chromium-isolated

FROM browser-runtime AS worker

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY patches ./patches
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @air-jam/release-browser-worker... build

ENV AIRJAM_BROWSER_WORKER_HOST=0.0.0.0
ENV AIRJAM_BROWSER_WORKER_PORT=8080
ENV AIRJAM_BROWSER_WORKER_HEADLESS=true
ENV AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX=true

USER pwuser

CMD ["node", "packages/release-browser-worker/dist/cli.js"]

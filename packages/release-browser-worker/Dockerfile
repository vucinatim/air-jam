FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @air-jam/release-browser-worker... build

ENV AIRJAM_BROWSER_WORKER_HOST=0.0.0.0
ENV AIRJAM_BROWSER_WORKER_PORT=8080
ENV AIRJAM_BROWSER_WORKER_HEADLESS=true
ENV AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX=false

CMD ["pnpm", "--filter", "@air-jam/release-browser-worker", "start"]

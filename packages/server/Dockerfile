# syntax=docker/dockerfile:1.7
#
# Two-stage build for the Air Jam realtime server.
#
# - `deps` installs the pnpm workspace using only package.json + lockfile
#   so the install layer stays cached across deploys unless deps change.
# - `runtime` overlays source, builds the server, and stays as the final
#   image. The workspace install is preserved so the `pnpm --filter ...
#   start` CMD keeps working unchanged.
#
# BuildKit cache mounts persist the pnpm content-addressed store across
# builds even when the install layer is invalidated, so package downloads
# don't repeat from the registry.

ARG NODE_IMAGE=node:20-bookworm-slim

# ============================================================================
# Stage 1: deps — install workspace dependencies
# ============================================================================
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

RUN corepack enable

# Workspace manifests only. Any source-only change leaves this layer cached.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

COPY apps/platform/package.json                 ./apps/platform/
COPY packages/sdk/package.json                  ./packages/sdk/
COPY packages/env/package.json                  ./packages/env/
COPY packages/server/package.json               ./packages/server/
COPY packages/harness/package.json              ./packages/harness/
COPY packages/devtools-core/package.json        ./packages/devtools-core/
COPY packages/runtime-topology/package.json     ./packages/runtime-topology/
COPY packages/create-airjam/package.json        ./packages/create-airjam/
COPY packages/mcp-server/package.json           ./packages/mcp-server/
# NOTE: packages/bot-lab is excluded from git (.git/info/exclude) so it
# isn't present in Railway's build context. pnpm install tolerates the
# missing workspace package because pnpm-workspace.yaml uses a glob.
COPY packages/release-browser-worker/package.json ./packages/release-browser-worker/
COPY games/air-capture/package.json             ./games/air-capture/
COPY games/code-review/package.json             ./games/code-review/
COPY games/minimal/package.json                 ./games/minimal/
COPY games/pong/package.json                    ./games/pong/
COPY games/the-office/package.json              ./games/the-office/
COPY games/last-band-standing/package.json      ./games/last-band-standing/

RUN --mount=type=cache,id=airjam-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================================
# Stage 2: runtime — build the server and run it
# ============================================================================
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

# Reuse the installed workspace from the deps stage. node_modules and
# pnpm's workspace symlinks (node_modules/@air-jam/sdk → packages/sdk,
# etc.) all come along.
COPY --from=deps /app /app

# Overlay source. Anything below this line invalidates the build cache
# but leaves the install layer untouched.
COPY tsconfig.base.json ./
COPY scripts   ./scripts
COPY packages  ./packages

# `--filter @air-jam/server...` (trailing ellipsis) builds the server
# together with its workspace deps — SDK in particular, which tsup keeps
# external and needs its dist/ on disk at runtime.
RUN pnpm --filter @air-jam/server... build

CMD ["pnpm", "--filter", "@air-jam/server", "start"]

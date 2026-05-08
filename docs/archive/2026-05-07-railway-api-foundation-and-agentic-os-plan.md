# Railway API Foundation And Agentic OS Plan

Last updated: 2026-05-08  
Status: completed

## Why This Plan Exists

Air Jam's on-demand preview system is architecturally sound, but the current Railway transport layer is not.

What we proved:

1. the repo-owned preview lifecycle is the correct canonical model for Air Jam today
2. Railway's native PR-environment path is too coarse for this repo
3. Railway API tokens authenticate successfully against the Railway Public API
4. the Railway CLI token flow is not trustworthy enough for the hosted automation path we need

So the problem is no longer preview design. The problem is the current Railway integration transport.

This plan defines the correct long-term fix:

1. stop treating Railway CLI as the canonical backend control plane
2. build one shared Railway API foundation that fits the wider agentic operating system
3. expose that foundation through both a CLI and an MCP surface
4. make Air Jam consume that shared layer instead of owning Railway transport details forever

## Decision

The canonical long-term shape should be:

1. a shared Railway core package
2. a thin CLI adapter for CI, scripts, and maintainers
3. a thin MCP adapter for agent workflows
4. repo-specific orchestration layers on top

This should not be plugin-first and should not be MCP-only.

## Core Recommendation

Build the Railway integration as a normal reusable package first, then add adapters.

Why:

1. GitHub Actions and other CI paths need a plain library and CLI, not a Codex plugin runtime
2. agent workflows still benefit from MCP, but MCP is an adapter, not the right base layer
3. Air Jam preview orchestration should stay repo-specific while Railway operations become reusable
4. the same shared package can later serve `create-airjam`, future repos, and internal maintainer tooling

## Goals

1. Replace Railway CLI dependence in automation-critical paths with Public API calls.
2. Keep one canonical Railway integration contract across human, CI, and agent usage.
3. Preserve Air Jam's existing preview architecture while swapping only the Railway transport layer.
4. Make the Railway layer generic enough to belong to the broader agentic operating system.
5. Keep the shared package minimal and explicit rather than turning it into a framework.

## Non-Goals

1. Do not move Air Jam preview orchestration into the shared package.
2. Do not make Codex plugins or MCP the only supported execution surface.
3. Do not build a huge generalized deployment platform abstraction.
4. Do not prematurely publish anything before there is at least one real second consumer.
5. Do not reopen the preview architecture itself unless the Railway transport replacement proves a deeper flaw.

## Architecture

### Layer 1. Shared Railway Core

This is the canonical source of truth.

Suggested home:

1. preferably in the agentic repo operating-system layer
2. temporarily inside Air Jam only if we need a short bootstrap step before extraction

Suggested package name:

1. `@agentic/railway-core`

Responsibilities:

1. authenticate against the Railway Public API
2. expose typed/minimal Railway operations
3. own GraphQL transport, retries, normalization, and Railway-specific error mapping
4. stay generic and reusable

Allowed concerns:

1. token loading from explicit env/config
2. GraphQL request execution
3. resource lookup helpers
4. pagination helpers
5. Railway domain/env/service/variable operations

Not allowed here:

1. PR naming conventions
2. Air Jam preview schema naming
3. Vercel coordination
4. GitHub comment formatting
5. app-specific environment override rules

### Layer 2. Shared CLI Adapter

Suggested package name:

1. `@agentic/railway-cli`

Responsibilities:

1. expose scriptable commands for humans and CI
2. wrap the shared core package with stable shell-facing commands
3. provide an escape hatch for non-agent automation

Why this matters:

1. GitHub Actions should not need Codex or MCP runtime support
2. maintainers need debuggable commands
3. local and CI validation are easier against a normal CLI than against an MCP transport

### Layer 3. Shared MCP Adapter

Suggested package name:

1. `@agentic/railway-mcp`

Responsibilities:

1. expose the shared Railway core as tools for agents
2. allow Codex and other MCP-capable tools to manage Railway predictably
3. reuse the exact same core logic as the CLI and repo integrations

Why this matters:

1. agent workflows should not shell out through an unreliable CLI if the API layer already exists
2. this becomes useful across all repos, not just Air Jam

### Layer 4. Repo-Specific Orchestration

Air Jam should continue to own:

1. preview lifecycle naming
2. preview env contract rendering
3. preview DB schema lifecycle
4. Vercel deploy and alias flow
5. readiness verification
6. cleanup policy

In other words:

1. shared package owns Railway operations
2. Air Jam owns preview semantics

That boundary should stay explicit.

## Concrete Package Surface

The shared core should start small.

### Minimum viable core operations

1. `getCurrentViewer`
2. `getProject(projectId)`
3. `listProjects()`
4. `listEnvironments(projectId)`
5. `createEnvironment(projectId, input)`
6. `deleteEnvironment(projectId, environmentId)`
7. `listServices(projectId)`
8. `setVariables({ projectId, environmentId, serviceId, variables })`
9. `getVariables({ projectId, environmentId, serviceId })`
10. `getServiceDomains({ projectId, environmentId, serviceId })`
11. `triggerDeployment({ projectId, environmentId, serviceId, ... })` if truly needed

### Minimum viable CLI commands

1. `railway-cli auth whoami`
2. `railway-cli project get --project <id>`
3. `railway-cli env list --project <id>`
4. `railway-cli env create --project <id> ...`
5. `railway-cli env delete --project <id> --environment <id>`
6. `railway-cli vars set --project <id> --environment <id> --service <id>`
7. `railway-cli domains list --project <id> --environment <id> --service <id>`

### Minimum viable MCP tools

1. `railway_whoami`
2. `railway_get_project`
3. `railway_list_environments`
4. `railway_create_environment`
5. `railway_delete_environment`
6. `railway_set_variables`
7. `railway_get_service_domains`

## Air Jam Integration Plan

Air Jam should not consume the CLI adapter for core orchestration. It should import the shared core package directly.

That means:

1. GitHub Actions can still use the shared CLI where convenient
2. Air Jam preview code should use library calls for deterministic behavior
3. the CLI remains a human/CI surface, not the internal dependency boundary

### What gets replaced in Air Jam

Primary target:

1. `/Users/timvucina/Desktop/MyProjects/air-jam/scripts/repo/lib/preview-railway.mjs`

The following current behaviors should move off Railway CLI:

1. environment listing
2. environment creation
3. environment deletion
4. variable injection
5. service discovery
6. public-domain resolution
7. any link-context assumptions

### What stays in Air Jam

1. preview manifest generation
2. preview override contract
3. preview lifecycle sequencing
4. preview verification
5. Vercel lifecycle
6. database schema lifecycle
7. sweep and teardown policy

## Migration Plan

### Phase 1. Define Shared Railway Core

1. create the shared package skeleton
2. implement token loading and GraphQL transport
3. implement the minimum viable project/environment/service/variable operations
4. add unit tests around request/response normalization and error mapping

Exit criteria:

1. direct API auth works with the same tokens that already passed manual `curl` validation
2. the core package can list the `air-jam` project, environments, and services

### Phase 2. Build Thin CLI Adapter

1. add a minimal CLI package on top of the shared core
2. expose the minimum viable commands needed for debugging and CI
3. keep command output structured and parseable

Exit criteria:

1. equivalent `whoami`, project lookup, environment list/create/delete, and variable operations work through the new CLI
2. no Railway CLI dependency is required for those operations

### Phase 3. Build Thin MCP Adapter

1. expose the same core operations as MCP tools
2. keep tool surface small and explicit
3. avoid repo-specific semantics in the MCP layer

Exit criteria:

1. an agent can inspect and manage Railway resources through MCP using the same underlying implementation

### Phase 4. Swap Air Jam Preview Transport

1. refactor `preview-railway.mjs` to depend on the shared core
2. remove `railway link` assumptions from workflows
3. update preview workflows to rely on the shared package/CLI path instead of Railway CLI context management
4. keep the Air Jam public operator path unchanged:
   - `preview doctor`
   - `preview up`
   - `preview down`

Exit criteria:

1. hosted GitHub preview workflow succeeds without Railway CLI link/auth dependence
2. local/provider validation still passes

### Phase 5. Validate And Clean Up

1. run end-to-end hosted preview up/down validation again
2. run orphan sweep validation again
3. remove the old Railway CLI dependency from critical preview automation paths
4. keep only non-critical diagnostic CLI usage if it still provides value

Exit criteria:

1. one GitHub-hosted preview creation succeeds
2. one GitHub-hosted teardown succeeds
3. provider state returns to a clean baseline

## Extraction Strategy

The final home should be the broader agentic operating system, not Air Jam forever.

Recommended sequence:

1. if needed, prototype the package shape quickly where it is easiest to validate
2. move the generic Railway core into the shared agentic repo as soon as the boundary is proven
3. keep Air Jam as the first real consumer
4. only publish externally after at least one more real consumer exists or we are confident in the contract

This keeps us from prematurely open-sourcing unstable assumptions while still designing the boundary correctly.

## Why Not A Plugin First

A plugin-first approach would be the wrong lowest-level architecture.

Problems with plugin-first:

1. GitHub Actions cannot treat a Codex plugin as the canonical transport layer
2. a plugin would couple infrastructure code to assistant runtime concerns too early
3. testability and reuse are better with a normal package boundary

The correct order is:

1. reusable package
2. CLI
3. MCP
4. optional plugin integration on top

## Risk Areas

1. Railway GraphQL mutations and resource semantics may still be underdocumented in places, so we should expect some dashboard-network-tab verification while implementing the core.
2. Deployment triggering may be the least stable API surface; only implement it once the simpler environment/variable/domain paths are working.
3. We should avoid letting the shared package absorb Vercel or database concerns, because that would recreate the same muddiness we are trying to remove.

## Canonical Happy Path After This Refactor

For Air Jam maintainers, the public preview workflow should still feel like:

1. `pnpm run repo -- preview doctor`
2. `pnpm run repo -- preview up --pr <n> --apply`
3. `pnpm run repo -- preview down --pr <n> --apply`

What changes is only the underlying Railway transport.

For the broader agentic operating system, the new reusable layers become:

1. Railway core package
2. Railway CLI package
3. Railway MCP package

That is the clean minimal structure.

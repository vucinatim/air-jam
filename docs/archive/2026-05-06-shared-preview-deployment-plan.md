# On-Demand Full-Stack PR Preview Plan

Last updated: 2026-05-08  
Status: completed operational baseline  
Owner: platform / infra / auth

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Deployment Topology](../strategy/deployment-topology.md)
3. [V1 Release Launch Plan](./v1-release-launch-plan.md)
4. [Platform README](../../apps/platform/README.md)

## Feasibility Spike Findings

The first repo/provider feasibility pass already established a few concrete
facts.

### Confirmed Existing Provider State

1. the repo is already linked to the Vercel project `air-jam`
2. the repo is already linked to the Railway project `air-jam`
3. Railway production already contains:
   1. `air-jam-server`
   2. `air-jam-release-browser-worker`
   3. `Postgres`
4. Vercel production already serves the main platform on `airjam.io`

### Repo Gaps Closed During The Spike

1. platform deployment/public-origin resolution is now centralized behind one typed boundary
2. the release browser worker now uses explicit bearer-token auth instead of an implicit public websocket proxy
3. the realtime server now has Railway config-as-code at `/packages/server/railway.json`
4. the repo maintainer CLI now has a canonical preview-manifest generator:
   `pnpm run repo -- preview manifest --pr <number>`
5. the repo now has a maintainer-triggered GitHub workflow entrypoint at:
   `.github/workflows/preview-full-stack.yml`
6. the repo maintainer CLI now also has:
   1. a redacted preview-plan generator:
      `pnpm run repo -- preview plan --pr <number>`
   2. a readiness doctor:
      `pnpm run repo -- preview doctor`
7. Vercel preview runtime env should now be treated as a dynamic deploy-time injection contract, not as a pre-populated global Vercel preview-env surface
8. Railway preview isolation is environment-scoped, while service identity is project-global; preview environments should reuse the canonical service names instead of trying to clone per-environment duplicate services
9. the current repo-owned Railway preview path is:
   1. duplicate `production` into `preview-pr-<number>`
   2. apply the explicit preview override set
   3. deploy the preview services into that duplicated environment
10. the current repo-owned Railway preview lifecycle remains the preferred operational path until Railway exposes a cleaner selected-service sync model that does not duplicate database services or inherit unsealed production variables by default
11. the repo maintainer CLI now has canonical high-level preview lifecycle commands:
   1. `pnpm run repo -- preview up --pr <number>`
   2. `pnpm run repo -- preview down --pr <number>`
12. the repo now also has repo-owned preview primitives under the hood for:
   1. preview database schema create/drop
   2. Vercel preview deploy/alias cleanup
   3. PR-close preview teardown workflow wiring
13. `preview.airjam.io` DNS and `*.preview.airjam.io` DNS now exist in Namecheap and are attached in Vercel
14. Railway production now points at the repo-owned config-as-code paths for both the realtime server and the browser worker
15. a real disposable fake-PR proof already validated:
   1. Railway environment duplication from `production`
   2. preview Postgres schema creation
   3. realtime server deploy into `preview-pr-424242`
   4. browser worker deploy into `preview-pr-424242`
   5. Railway public domain resolution for both services
   6. Vercel preview-tagged platform deployments and alias creation
   7. a public full-stack preview alias at `full-pr-424242.preview.airjam.io` returning `200`
16. the disposable proof environment and preview schema were torn back down after validation, so provider state is back to a clean `production`-only baseline

### Provider Truths Now Locked In

These are now confirmed provider-side facts, not open rollout questions:

1. the realtime server service uses `/packages/server/railway.json`
2. the browser worker service uses `/packages/release-browser-worker/railway.json`
3. Vercel preview hosts must remain publicly accessible, which means Deployment Protection has to stay disabled for this project unless the preview lane is redesigned around authenticated review access

## Railway-Native PR Environment Validation Findings

A live provider validation pass was run against PR `#4` after enabling Railway PR
environments with `production` as the base environment.

What worked:

1. Railway created an ephemeral environment automatically on PR reopen
2. Railway named it predictably as `air-jam-pr-4`
3. Railway automatically provisioned per-environment Railway public domains for services that already had base-environment Railway domains
4. the browser worker eventually built and passed as a native PR-environment deployment
5. Railway deleted the ephemeral environment cleanly once the PR-environment run was torn back down

What did not fit the intended preview contract:

1. Railway duplicated every service in the project into the PR environment, including both database services and their volumes
2. unsealed production variables were copied into the PR environment before repo-owned preview overrides could be applied
3. the realtime server deployment was skipped initially because Railway gated the service deploy on the PR check suite state
4. Railway's native deployment status surfaced an awkward mismatch during validation: GitHub checks reported a successful server deploy while the Railway CLI still showed no active server deployment and the service domain returned Railway fallback `404` responses
5. Vercel's native preview deploy remained orthogonal to the Railway PR environment; it still did not know about the preview-safe backend/storage contract without repo-owned orchestration
6. direct API experimentation against an empty Railway environment showed that `serviceDuplicate` creates new global `(... Copy)` services instead of syncing the canonical `air-jam-server` and `air-jam-release-browser-worker` services into the target environment
7. deleting the bad proof environment cleaned those duplicate copy-services back out automatically, which is good operationally, but it still confirms that `serviceDuplicate` is the wrong primitive for this repo

Conclusion from the validation:

1. Railway-native PR environments are useful as a provider primitive, but they are not clean enough to become the canonical preview lane by themselves
2. the repo still needs an explicit preview reconciliation layer even if Railway-native PR environments are ever reintroduced
3. the biggest structural problem is database duplication; as long as the production project contains live database services, any provider-native environment duplication path will over-provision preview infrastructure and fight the desired shared-preview-DB-plus-per-PR-schema model
4. the empty-environment path remains interesting in theory because Railway documents selected-service sync, but it is not yet proven through a stable public automation primitive for this repo
5. because of that, the repo-owned ephemeral preview lane remains the canonical implementation until a better supported Railway sync path is proven end to end

## Current Implementation State

The preview lane is now materially implemented.

### 2026-05-07 Validation Closeout

A fresh end-to-end provider proof was rerun after the latest hardening fixes and
then torn back down again. The canonical repo-owned path is now validated
through:

1. preview Railway environment creation from `production`
2. preview schema creation on the shared preview Postgres lane
3. preview override application for server and browser worker
4. detached Railway service deploys for server and worker
5. Vercel preview deploy plus exact PR-host alias creation
6. verification across:
   1. server health
   2. worker health
   3. platform HTTP readiness
   4. exact PR alias presence
7. teardown across:
   1. PR alias removal
   2. PR-tagged Vercel deployment removal
   3. preview schema drop
   4. Railway environment deletion

The hardening points that proved necessary in practice are now part of the
canonical implementation:

1. do not treat a `200` on a wildcard preview host as sufficient success; the exact full-stack alias such as `full-pr-<n>.preview.airjam.io` must be part of readiness
2. remove Vercel preview deployments by deployment reference, because the CLI list payload does not reliably expose deployment IDs
3. use JSON-mode Railway variable writes, because plain-text `railway variable set` can stall in automation even when the write itself is valid
4. allow a longer Railway environment-name release window after deletion, because fixed `preview-pr-<n>` names can remain unavailable briefly after successful teardown

Repo-owned pieces now exist for:

1. preview manifest generation
2. preview override planning
3. provider readiness auditing
4. preview DB schema lifecycle
5. transitional Railway `production` duplication and teardown
6. Railway preview service deploy orchestration
7. Vercel preview deploy, metadata tagging, and alias cleanup
8. maintainer-triggered preview create and preview destroy GitHub workflows
9. a scheduled preview sweep workflow that reconciles open PRs against provider state and destroys orphaned preview resources

The remaining work is mostly operational hardening, not architecture invention.

The biggest remaining architectural decision is no longer theoretical. After live
validation, pure Railway-native PR environments are not yet clean enough to be
the canonical lane because they duplicate database services, inherit unsealed
production variables, and can race with repo-owned preview overrides.

The current repo-owned orchestration therefore remains the operational and
architectural baseline until we prove a cleaner replacement through a supported
Railway primitive, not just by inference from partial GraphQL behavior.

Current known edges:

1. the preview control plane must keep Vercel Deployment Protection disabled for this project, otherwise preview aliases will quietly resolve to `401` even when the deploy/alias flow itself is correct
2. the repo now has a readiness check for that Vercel protection state, so future regressions should fail in `preview doctor` before they waste a preview run
3. Railway deploy staging now uses crash-safe backup/restore state under `.airjam/`, so interrupted preview deploys should no longer strand generated root `railway.json`, `.railwayignore`, or package deploy-stamp files in the repo

## Canonical Operator Path

For maintainers, the preview system should now be understood as exactly:

1. `pnpm run repo -- preview doctor`
2. `pnpm run repo -- preview up --pr <number> --apply`
3. review the resulting preview
4. let auto-destroy run on PR close/merge, or run `pnpm run repo -- preview down --pr <number> --apply` if you want it gone sooner

Lower-level Railway, Vercel, and database preview seams still exist in code as
implementation internals, but they are no longer part of the intended operator
surface or the happy path.

## Cleanup Guarantees

The intended cleanup policy is:

1. PR close/merge triggers automatic preview teardown through `.github/workflows/preview-full-stack-destroy.yml`
2. maintainers can run `preview down` early when a review is finished
3. teardown is idempotent, so retries are safe
4. a fully cleaned preview means:
   1. Railway is back to `production` only
   2. the PR-specific preview alias is gone
   3. the PR-tagged Vercel deployment set is gone
   4. the PR-specific preview schema is gone
5. the scheduled orphan sweeper is the cleanup backstop if the PR-close destroy path ever misses a resource; it is not a second preview paradigm

That sweeper now exists as `.github/workflows/preview-full-stack-sweep.yml` and
uses one hidden reconciliation command internally instead of introducing another
maintainer-facing preview mode.

## Why This Exists

Air Jam needs previews that are:

1. accurate
2. easy to explain
3. safe for an open-source repo
4. cheap enough to operate intentionally

The repo already has explicit production boundaries:

1. [apps/platform](../../apps/platform) is the public Next.js platform app
2. [packages/server](../../packages/server) is the separate realtime/API service
3. [packages/release-browser-worker](../../packages/release-browser-worker) is the separate browser worker service
4. Postgres and R2 are real infrastructure dependencies, not implementation details

That means “preview” cannot honestly mean “just deploy the frontend” for many
important PRs.

At the same time, a many-lane preview model becomes harder to reason about than
the product itself.

This plan defines the simpler rule:

1. no staging branch
2. no always-on shared preview lane as part of the main system
3. no cheap automatic partial preview lane as part of the main system
4. one preview type only
5. that preview type is full-stack, isolated, on-demand, and per-PR

For Railway specifically, “isolated” should currently mean repo-owned
ephemeral environments with strict override-and-teardown discipline rather than
either provider-native PR environments or long-lived shared backend state.

## Goal

The goal is that a maintainer can explain the preview story in one sentence:

1. if a PR needs preview verification, trigger a full-stack PR preview environment

That preview should be:

1. coherent
2. isolated from production
3. close enough to production topology to be meaningful
4. automatically cleaned up when the PR is done

If the preview system requires contributors to learn multiple preview classes,
shared-vs-isolated distinctions, or hidden backend heuristics, it is too
complicated.

## Decisions Already Made

These decisions are now considered settled for this plan:

1. do not introduce a long-lived `staging` branch
2. keep `main` as the only production branch
3. use one preview type only
4. that preview type is a maintainer-triggered isolated full-stack PR preview
5. never let any preview touch production DB or production storage
6. use dedicated preview infrastructure boundaries
7. keep preview auth simple and explicit
8. keep package publishing separate from preview deployment
9. treat fork PRs as untrusted by default
10. decide and document whether provider-default app-only previews remain enabled but non-canonical, or are disabled entirely

## Prerequisite Refactors Before Preview Rollout

Before serious preview automation begins, a few bounded refactors are worth
doing first.

These are not “nice later” cleanup items. They directly reduce preview
complexity and ambiguity.

### 1. Canonicalize Deploy Identity Resolution

Today deployment identity is still derived across multiple helpers and env
surfaces.

Examples:

1. public host resolution
2. auth base URL resolution
3. trusted-origin resolution
4. backend origin wiring
5. hosted release public-base resolution

Why this matters:

1. preview automation needs one explicit source of truth for app/server/worker/public origins
2. scattered fallback logic makes provider-specific behavior leak into product code
3. preview env debugging gets much harder if identity is derived differently in different modules

Required direction:

1. introduce one typed deployment/preview identity boundary
2. make platform, auth, runtime topology, and hosted-release URL code consume that boundary
3. reduce ad hoc fallback chains where practical

### 2. Separate Local-Only Platform Conveniences From Deployable Contract

Today the platform still carries local-only concerns close to deploy-time
config surfaces.

Examples:

1. local Arcade reference-game env
2. local dev proxy rewrites
3. local build route behavior

Why this matters:

1. preview env matrices should describe deployable product behavior, not local machine conveniences
2. local-only env near deployment identity increases the chance of preview misconfiguration

Required direction:

1. make local-only platform env clearly local-only
2. keep preview/prod deploy contracts narrower and more explicit

### 3. Decide The Browser Worker Protection Model

The browser worker proxies the Playwright websocket endpoint, so preview cannot
leave access control implicit.

Why this matters:

1. preview rollout should not normalize a publicly reachable browser-control endpoint without an intentional protection model
2. the same issue matters for production hardening, not only preview

Chosen v1 direction:

1. use worker-side bearer-token auth for all proxied HTTP/WebSocket access
2. leave only `GET /` and `GET /health` unauthenticated for discovery and health probes
3. require the platform to provide a matching preview-safe token when it connects to the worker websocket

Why this is the right first contract:

1. it keeps the security boundary explicit in code instead of assuming provider-private networking forever
2. it works for preview and production topology equally
3. it is small enough to ship before preview automation instead of turning worker security into a separate project

### 4. Audit The Public Session/App Identity Surface

There are still env-driven public session values that are not fully
canonicalized.

Examples:

1. `NEXT_PUBLIC_AIR_JAM_APP_ID`

Why this matters:

1. preview should not inherit ambiguous app/bootstrap identity rules
2. the platform env contract should distinguish durable public product identity from incidental runtime glue

Required direction:

1. decide which of these are real durable deploy-contract envs
2. remove or re-derive any that are accidental or overly implicit

These prerequisite refactors should stay bounded.

The goal is not a broad infrastructure rewrite.

The goal is to reduce ambiguity before we automate it.

## The Canonical Preview Model

There is exactly one preview lane.

### One Lane. On-Demand Full-Stack PR Preview

This is the only preview type that matters in the core operating model.

Behavior:

1. a maintainer explicitly requests preview for a PR
2. the system provisions a coherent isolated preview environment for that PR
3. the environment is temporary
4. it is destroyed automatically when the PR closes or merges

The canonical backend lifecycle should be:

1. the repo creates an ephemeral Railway environment per preview from the production topology
2. the repo immediately applies a fixed preview override contract so duplicated production resources are never used as-is
3. the repo deploys the preview app services into that environment
4. Vercel owns the platform app deployment artifact itself
5. the repo owns cross-provider orchestration, verification, aliasing, and cleanup guarantees

This lane exists because the repo contains multiple real deployable surfaces.

A valid preview for this repo must be able to represent:

1. platform app behavior
2. server/runtime behavior
3. browser-worker behavior when relevant
4. preview-safe database state
5. preview-safe storage state
6. preview-safe auth behavior

Anything less may be useful for screenshots, but it is not the canonical
preview model this repo should optimize around.

## Why Only One Lane

This plan intentionally rejects:

1. a staging branch
2. an always-on shared preview as the main workflow
3. a separate cheap automatic app-only preview lane

Why:

1. multiple lanes create more mental overhead
2. partial previews create false confidence for integrated changes
3. shared preview environments blur branch ownership and verification intent
4. the product is already multi-surface enough; preview rules should become simpler, not richer

The cost tradeoff is handled by making the one real preview lane explicit and
on demand.

So the rule is:

1. if a PR does not need preview, do not create one
2. if it does need preview, create the real full-stack one

## Preview Topology

Each preview environment should mirror the production split closely enough to
be meaningful.

A PR preview should include:

1. a PR-specific platform app deployment
2. a PR-specific realtime/API server deployment
3. a PR-specific browser worker deployment when the PR needs that surface
4. a PR-specific DB isolation surface
5. a PR-specific storage namespace

This means preview remains honest about the real product topology instead of
pretending one app deploy is the whole system.

## Preferred Provider Ownership

The system should prefer provider-native lifecycle when the provider offers the
right primitive.

### Railway

Preferred role:

1. own PR environment lifecycle
2. auto-create temporary backend environments for trusted PRs
3. auto-delete those backend environments when PRs close or merge

The repo should not try to out-own Railway here unless the native model proves
insufficient.

### Vercel

Preferred role:

1. own app deployment lifecycle
2. continue allowing normal PR/preview deployments
3. let the repo attach the canonical review alias such as `pr-<number>.preview.airjam.io`

### Repo-owned orchestration

The repo should keep owning:

1. trusted-PR gating
2. preview env contract rendering
3. preview DB schema lifecycle
4. Vercel alias binding
5. verification
6. PR comments/status
7. stale-resource cleanup

## Provider-Default Preview Policy

The plan must be explicit about provider behavior.

Vercel may still be capable of creating automatic app-only previews by default.

That creates an architectural question:

1. disable provider-default app-only previews entirely
2. or allow them to exist but declare them non-canonical and unsupported for real preview verification

This decision must be made intentionally before rollout.

Recommended default:

1. if disabling automatic app-only previews is operationally reasonable, disable them
2. if not, allow them to exist but document clearly that they are incidental provider behavior and not the official preview system

The important rule is:

1. only the on-demand full-stack PR preview counts as a real preview under this plan

## Infrastructure Boundaries

### Platform App

Provider target:

1. Vercel

Preview requirement:

1. PR-specific deployment configured only for preview-safe infra

### Realtime/API Server

Provider target:

1. Railway

Preview requirement:

1. Railway PR environment for the trusted PR
2. no production data access

### Browser Worker

Provider target:

1. Railway or equivalent long-lived process host

Preview requirement:

1. Railway PR environment worker surface when release screenshot/moderation behavior is in scope
2. no production-only coupling

### Database

Preview requirement:

1. PR-specific isolated database surface
2. never production DB

Preferred v1 shape:

1. one dedicated non-production preview database
2. per-PR schema isolation inside that preview database
3. the same migrations/contracts as production

Optional later upgrade:

1. per-PR database branches if the provider path becomes clean and worth the extra complexity

Explicit non-goal:

1. do not live-sync production data into PR previews
2. do not allow preview to fall back to production DB under any circumstance

If realistic data becomes necessary later, the only acceptable direction is:

1. occasional sanitized preview-baseline refresh
2. never unsanitized live production data access from preview

### Storage

Preview requirement:

1. dedicated preview R2 bucket
2. PR-specific key prefix such as `pr/<number>/...`
3. no production object reuse

This should follow the same data policy as the database:

1. isolated preview storage only
2. no production storage fallback
3. no hidden reuse of production write paths

## Auth Strategy

Auth should stay boring in preview.

The repo already supports:

1. email/password auth
2. optional GitHub social auth

### Production Auth

Keep the production direction:

1. GitHub social login enabled
2. email/password fallback available

### Preview Auth

Use simple preview auth first.

Initial preview rule:

1. preview uses email/password auth
2. preview does not depend on GitHub social login
3. preview uses preview-only accounts on preview-only data

Why:

1. GitHub OAuth callback rules are awkward across arbitrary preview hosts
2. social auth is not required for most preview verification
3. email/password is much easier to keep deterministic

Future optional upgrade:

1. if social login in preview becomes important, add it deliberately as a preview-specific auth capability with separate preview credentials

### Auth Refactor Requirement

The current auth setup in [auth.ts](../../apps/platform/src/lib/auth.ts)
still leans on one resolved `baseURL`.

Before this plan is complete, auth handling should be refactored so preview
host/origin behavior is explicit and not dependent on brittle static
assumptions.

Target behavior:

1. preview origin handling is explicit
2. preview auth is isolated from production auth assumptions
3. arbitrary provider-generated preview URLs are not accidentally treated as trusted production-like auth identities

## Trigger Model

The preview lane should be explicit, not heuristic.

Preferred trigger options:

1. maintainer adds a label such as `preview:full-stack`
2. or maintainer comments a slash command such as `/preview full`

The exact mechanism can vary, but the workflow must remain:

1. requested intentionally
2. visibly provisioning
3. visibly ready
4. visibly cleaned up

## Preview Ready Contract

A preview must not be marked ready just because one deploy finished.

Canonical ready checks should include:

1. platform deployment reachable
2. realtime/API server reachable
3. preview DB isolation created successfully
4. migrations applied successfully
5. preview seed step completed successfully
6. preview auth sign-in path working
7. preview storage namespace prepared
8. browser worker reachable when that surface is required

The workflow should report “ready” only after this contract passes.

## Performance And Latency Expectation

Provisioning speed is part of the developer experience.

This preview system is intentionally more accurate than a cheap app-only
preview, but it must still be operationally tolerable.

The rollout should explicitly measure:

1. cold create time
2. update time after new commits
3. destroy time

If preview creation is consistently too slow, maintainers will stop using it
and the system will fail socially even if it works technically.

That does not change the one-lane model, but it does mean latency must be
treated as a first-class quality metric.

## Provisioning Expectations

When preview is triggered for a trusted PR, the system should provision or wire:

1. app deploy for that PR
2. server deploy for that PR
3. browser-worker deploy when required
4. DB isolation for that PR
5. storage prefix for that PR
6. preview auth/env config for that PR
7. a PR comment or check output with the resulting URLs and status

The result should feel like:

1. “this PR now has a real environment”

not:

1. “this PR has some partial deploys and a maintainer needs to remember how to connect them”

## Cleanup Expectations

When the PR closes or merges:

1. PR app preview lifecycle should end normally with the provider
2. Railway PR environment should be deleted by Railway
3. PR DB schema or equivalent isolation surface should be removed
4. PR-specific Vercel alias should be removed
5. PR storage namespace should be cleaned up when appropriate
6. PR preview comment/status should be updated or removed as designed

Cleanup should be automatic once preview was provisioned.

The repo should also have a stale-sweep story for failures:

1. detect orphan preview DB schemas with no matching open PR
2. detect orphan preview aliases with no matching open PR
3. detect orphan preview comments if they are used as canonical status surfaces

## Fork PR Policy

Because the repo is open source, trust must stay explicit.

### Trusted/Internal PRs

Allowed:

1. full on-demand preview lane

### External Fork PRs

Default restrictions:

1. no automatic privileged full-stack preview
2. no automatic backend secrets
3. no assumption that arbitrary fork code should receive the same infra access as maintainer-owned branches

Possible later exception:

1. a maintainer can explicitly promote or reproduce a fork PR preview if ever needed

The default posture must remain conservative.

## Package Implications

Not every package needs a separate deployment concept, but the preview system
must still exercise the right boundaries.

### Packages Exercised Through Previewed App/Server Behavior

These are validated indirectly by the preview environment:

1. [packages/sdk](../../packages/sdk)
2. [packages/runtime-topology](../../packages/runtime-topology)
3. [packages/env](../../packages/env)
4. [packages/server](../../packages/server)
5. [packages/release-browser-worker](../../packages/release-browser-worker)

### Packages Outside The Preview Deployment Story

These remain CI/release-lane concerns rather than preview-deployed products:

1. [packages/create-airjam](../../packages/create-airjam)
2. [packages/mcp-server](../../packages/mcp-server)
3. other publishable libraries

Preview exists to validate integrated product behavior, not to invent deploy
stories for every package.

## Maintainer Workflow

The intended maintainer story should be teachable in under a minute.

Workflow:

1. open PR
2. decide whether the PR actually needs preview verification
3. if no, do not create preview
4. if yes, trigger full-stack preview
5. wait for the environment to come up
6. test the real PR stack
7. let automation clean it up on close/merge

That is the whole model.

## Transitional Note

The current implementation already proves the full-stack preview lane using
repo-owned Railway environment duplication.

After validating Railway-native PR environments and the wrong
`serviceDuplicate` API path, that repo-owned lane is no longer just a fallback.
It is the current canonical implementation because it is the only one we have
proven to be:

1. full-stack
2. preview-safe
3. deterministic enough to automate
4. cleanly tear-downable

The intended direction is now:

1. keep the current duplication path as the canonical operational lane
2. keep watching Railway for a real selected-service sync primitive that can replace it cleanly
3. only switch away once that replacement is proven end to end, including DB, storage, auth, and cleanup safety

## Execution Workstreams

The rollout should be executed as explicit workstreams.

Do not start by wiring automation first.

The correct order is:

1. run a feasibility spike
2. freeze the operating model
3. land the bounded prerequisite refactors that reduce preview ambiguity
4. stand up preview-safe infra
5. make env ownership explicit
6. make auth deterministic
7. automate provisioning and cleanup
8. harden safety, observability, and documentation

### Workstream -1. Feasibility Spike

Goal:

1. prove that the hardest provider and identity assumptions are actually viable before deep implementation starts

Tasks:

1. verify Vercel preview creation/update control through the intended automation path
2. verify Railway environment creation/update/destruction through the intended automation path
3. verify the chosen DB isolation strategy can be created and cleaned up reliably
4. verify preview auth works on provider-generated preview hosts with the intended email/password model
5. verify preview storage isolation with PR-specific prefixes
6. explicitly decide the provider-default preview policy for Vercel

Acceptance:

1. the provider model is validated enough to justify implementation
2. the highest-risk assumptions are proven or consciously revised early

### Workstream 0. Contract Freeze

Goal:

1. make the one-lane preview model the explicit repo direction before infra work starts

Tasks:

1. keep this plan as the single active preview architecture plan
2. align any deployment/ops docs that still imply staging or shared preview as the main workflow
3. explicitly document that preview is maintainer-triggered and not automatic for every PR
4. define the minimum PR metadata needed by the preview system:
   1. PR number
   2. branch name
   3. repo owner / trust status
   4. preview lifecycle status
5. define the canonical preview environment naming scheme across providers

Recommended naming:

1. app env: `pr-<number>`
2. server env: `pr-<number>`
3. worker env: `pr-<number>`
4. DB branch/schema: `pr_<number>`
5. storage prefix: `pr/<number>/`

Acceptance:

1. there is no ambiguity about the preview model
2. provider naming is consistent before automation begins

### Workstream 0.5. Pre-Preview Canonicalization Pass

Goal:

1. remove the highest-value sources of deploy/preview ambiguity before provisioning work begins

Tasks:

1. introduce one explicit deployment identity/config boundary for preview/prod URL/origin resolution
2. migrate platform host/auth/backend/release URL consumers toward that boundary
3. separate local-only platform env and behavior from the deployable platform contract where it materially affects preview clarity
4. decide the browser-worker protection model
5. audit `NEXT_PUBLIC_AIR_JAM_APP_ID` and `NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT` as real deploy-contract envs versus removable glue

Acceptance:

1. preview automation no longer depends on scattered identity fallback logic
2. local-only platform conveniences no longer muddy the preview env contract materially
3. the worker access model is explicit enough to proceed safely

### Workstream 1. Provider And Domain Foundations

Goal:

1. prepare all provider-side prerequisites for isolated preview environments

Tasks:

1. confirm Vercel project ownership and API access model for preview automation
2. confirm Railway project ownership and API access model for server and worker preview environments
3. decide whether PR preview URLs will remain provider-generated or whether custom per-PR aliases are worth adding later
4. create the dedicated preview R2 bucket
5. choose the preview database isolation strategy:
   1. preferred: branch-per-PR
   2. fallback: another truly isolated per-PR DB surface
6. decide where preview browser-worker screenshots and transient assets should live
7. define preview retention and cleanup policy for:
   1. DB branches/schemas
   2. storage prefixes
   3. Railway environments
   4. provider-side preview aliases if ever added later

Acceptance:

1. all providers needed for preview can be automated
2. preview infra has a dedicated non-production storage boundary
3. preview DB strategy is chosen before app env wiring begins

### Workstream 2. Environment Contract And Secret Ownership

Goal:

1. make preview env ownership explicit across platform, server, and worker

Tasks:

1. write the preview env matrix by service
2. classify every env as one of:
   1. production-only
   2. preview-safe shared secret
   3. per-PR generated value
3. audit platform env from [apps/platform/.env.example](../../apps/platform/.env.example)
4. audit server env from [server-env.ts](../../packages/server/src/env/server-env.ts)
5. audit release/media env from [release-env.ts](../../apps/platform/src/server/releases/release-env.ts)
6. define the minimum preview env set for the platform app
7. define the minimum preview env set for the realtime server
8. define the minimum preview env set for the browser worker
9. explicitly remove any production-only env from preview provisioning
10. define which values are injected once globally versus computed per PR
11. fold in the results of the pre-preview canonicalization pass so the env matrix reflects the narrowed deploy contract rather than the pre-cleanup state

Preview env matrix should cover at least:

1. `DATABASE_URL`
2. `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
3. `NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST`
4. `BETTER_AUTH_URL`
5. `BETTER_AUTH_SECRET`
6. `AIR_JAM_MASTER_KEY`
7. `AIR_JAM_ALLOWED_ORIGINS`
8. `AIRJAM_RELEASES_R2_*`
9. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`
10. `AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN`

Acceptance:

1. preview env ownership is explicit service by service
2. no preview lane requires production secrets by accident
3. per-PR computed values are clearly identified
4. platform-only bootstrap glue that is not a first-party deploy contract has been removed from the preview env surface

### Draft Preview Env Matrix

This is the current repo-grounded draft matrix from the codebase.

It is not the final deployed matrix yet, but it is the correct starting point
for implementation.

#### Platform App

Required for preview:

1. `DATABASE_URL`
   Role: per-PR generated value
   Why: platform DB access and Better Auth adapter both use it

2. `AIR_JAM_MASTER_KEY`
   Role: preview-safe shared secret unless preview architecture removes the need
   Why: platform env surface currently expects it and hosted lanes use app/server authority flows

3. `BETTER_AUTH_SECRET`
   Role: preview-safe shared secret
   Why: required for preview auth session signing

4. `BETTER_AUTH_URL`
   Role: per-PR computed value
   Why: current auth base URL resolution prefers it explicitly

5. `NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST`
   Role: per-PR computed value
   Why: current public URL resolution uses it before `NEXT_PUBLIC_APP_URL` and `VERCEL_URL`

6. `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
   Role: per-PR computed value
   Why: platform topology and hosted-release runtime wiring depend on it

7. `NEXT_PUBLIC_AIR_JAM_APP_ID`
   Role: preview-safe shared config or per-PR computed app identity, depending the final preview auth/bootstrap model
   Why: platform host/controller session config reads it directly

8. `AIRJAM_RELEASES_R2_BUCKET`
   Role: preview-safe shared config
   Why: release/media storage bucket name

9. `AIRJAM_RELEASES_R2_ACCOUNT_ID` or `AIRJAM_RELEASES_R2_ENDPOINT`
   Role: preview-safe shared config
   Why: release/media storage endpoint resolution

10. `AIRJAM_RELEASES_R2_ACCESS_KEY_ID`
    Role: preview-safe shared secret
    Why: release/media storage writes

11. `AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY`
    Role: preview-safe shared secret
    Why: release/media storage writes

12. `AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN`
    Role: preview-safe shared secret or per-PR generated secret if we tighten preview isolation further
    Why: release inspection/moderation access checks depend on it

13. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`
    Role: per-PR computed value
    Why: platform moderation config points to the worker websocket endpoint

14. `AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN`
    Role: preview-safe shared secret or per-PR generated secret
    Why: platform must authenticate to the browser worker websocket when a remote worker is used

15. `AIRJAM_RELEASES_IMAGE_MODERATION_MODE`
    Role: preview-safe shared config
    Why: moderation behavior mode

16. `OPENAI_API_KEY`
    Role: preview-safe shared secret only if preview keeps OpenAI moderation enabled
    Why: required when moderation mode is `openai`

17. `AIRJAM_RELEASES_BROWSER_NAVIGATION_TIMEOUT_MS`
18. `AIRJAM_RELEASES_BROWSER_WAIT_AFTER_LOAD_MS`
19. `AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH`
20. `AIRJAM_RELEASES_BROWSER_VIEWPORT_HEIGHT`
21. `AIRJAM_RELEASES_OPENAI_MODERATION_MODEL`
22. `AIRJAM_RELEASES_OPENAI_BASE_URL`
23. `AIRJAM_RELEASES_OPENAI_TIMEOUT_MS`
    Role: preview-safe shared config
    Why: release moderation runtime behavior

Optional for preview:

1. `NEXT_PUBLIC_RELEASES_BASE_URL`
2. `AIRJAM_RELEASES_BASE_URL`
   Use only if preview hosted-release playback needs a dedicated public origin

3. `NEXT_PUBLIC_SENTRY_DSN`
4. `SENTRY_AUTH_TOKEN`
   Recommended preview default: disabled unless preview observability requires them

5. `NEXT_PUBLIC_WEBSITE_ANALYTICS_PROVIDER`
6. `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
7. `NEXT_PUBLIC_UMAMI_SCRIPT_URL`
   Recommended preview default: disabled

Recommended preview defaults:

1. `GITHUB_CLIENT_ID` unset
2. `GITHUB_CLIENT_SECRET` unset
3. `NEXT_PUBLIC_AUTH_GITHUB_ENABLED=false`
   Why: preview auth should stay email/password-only first

4. `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_*` unset
   Why: local Arcade reference catalog env should not leak into preview deploys

5. `AIR_JAM_DEV_PROXY_BACKEND_URL` unset
   Why: this is local proxy/development-only behavior

Resolved bootstrap identity audit:

1. `NEXT_PUBLIC_AIR_JAM_APP_ID` remains part of the platform deploy contract because the platform shell still needs a durable first-party bootstrap identity
2. `NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT` is not part of the first-party platform deploy contract and should remain an explicit SDK/app-level override instead of a platform deployment env

Canonicalization target:

1. this draft matrix should shrink where possible after Workstream 0.5 rather than being treated as the final desirable env surface

#### Realtime/API Server

Required for preview:

1. `DATABASE_URL`
   Role: per-PR generated value
   Why: server auth/bootstrap/runtime data access

2. `AIR_JAM_AUTH_MODE=required`
   Role: preview-safe shared config
   Why: preview should behave like a real protected environment, not dev-disabled auth

3. `AIR_JAM_ALLOWED_ORIGINS`
   Role: per-PR computed value
   Why: server origin allowlist must include the PR app host

4. `AIR_JAM_MASTER_KEY` or `AIR_JAM_HOST_GRANT_SECRET`
   Role: preview-safe shared secret
   Why: required auth backend when auth mode is enforced

5. `AIR_JAM_ALLOW_REMOTE_DATABASE=enabled`
   Role: preview-safe shared config if preview DB is remote-hosted and the server process is not running with production `NODE_ENV`
   Why: current server DB policy blocks non-local DB URLs outside production unless explicitly enabled

Recommended preview defaults:

1. `AIR_JAM_TRUST_PROXY_HEADERS=auto`
2. `AIR_JAM_MAINTENANCE_MODE=disabled`
3. `AIR_JAM_DEV_LOG_COLLECTOR=disabled`
4. `AIR_JAM_LOG_LEVEL=info`

Usually provider-injected:

1. `PORT`

Optional tuning values:

1. `AIR_JAM_RATE_LIMIT_WINDOW_MS`
2. `AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX`
3. `AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX`
4. `AIR_JAM_STATIC_APP_RATE_LIMIT_MAX`

#### Browser Worker

Required for preview:

1. `PORT`
   Role: provider-injected

2. `AIRJAM_BROWSER_WORKER_HEADLESS`
   Role: preview-safe shared config
   Recommended preview default: `true`

3. `AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX`
   Role: preview-safe shared config
   Recommended preview default: provider-dependent, currently `false` in package defaults

4. `AIRJAM_BROWSER_WORKER_ACCESS_TOKEN`
   Role: preview-safe shared secret or per-PR generated secret
   Why: worker-side bearer-token gate for proxied Playwright HTTP/WebSocket access

Optional:

1. `AIRJAM_BROWSER_WORKER_HOST`
2. `AIRJAM_BROWSER_WORKER_PORT`
3. `AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH`

Current contract:

1. worker-side bearer-token auth is the explicit v1 protection model
2. the platform-side `AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN` must match the worker-side `AIRJAM_BROWSER_WORKER_ACCESS_TOKEN`
3. private networking can still be added later, but it is now a hardening layer on top of an explicit in-process contract rather than the only protection

### Workstream 3. Auth Refactor And Preview Identity

Goal:

1. make preview auth deterministic and independent from production assumptions

Tasks:

1. refactor [auth.ts](../../apps/platform/src/lib/auth.ts) so preview auth host handling is explicit
2. refactor [auth-origin-config.ts](../../apps/platform/src/lib/auth-origin-config.ts) if needed so preview trusted origins are intentional rather than incidental
3. document and enforce the preview auth rule:
   1. email/password only at first
   2. no GitHub social login in preview
4. create preview-only seed accounts
5. define preview account roles needed for testing:
   1. maintainer user
   2. optional preview-admin user
   3. optional normal non-admin user
6. define how seeded preview users are created and rotated safely
7. verify that preview auth works on provider-generated preview hosts without production callback assumptions
8. ensure auth cookies/session behavior are valid in isolated PR previews

Acceptance:

1. preview login works deterministically
2. preview auth does not rely on production GitHub OAuth wiring
3. preview user seeding is operationally documented

### Workstream 4. Database Isolation

Goal:

1. ensure every preview environment gets a true non-production DB surface

Tasks:

1. choose and implement the exact DB isolation mechanism
2. define how migrations run for a newly created preview DB surface
3. define how seed data is applied
4. define how preview DB identifiers map back to PR number
5. define failure behavior if DB branch/schema creation fails
6. define cleanup behavior on merge/close
7. define TTL handling for orphaned DB surfaces if cleanup jobs fail
8. define safeguards so preview provisioning refuses to continue if DB isolation cannot be created

Acceptance:

1. every preview PR environment gets isolated DB state
2. preview teardown removes or expires that DB state predictably
3. production DB can never be used as fallback

### Workstream 5. Storage And Artifact Isolation

Goal:

1. make preview storage safe and easy to clean up

Tasks:

1. create the dedicated preview R2 bucket
2. define the canonical PR storage prefix scheme
3. route preview media and hosted-release paths to preview storage env only
4. verify signed upload/finalize/public URL behavior in preview
5. decide whether preview asset public URLs should be provider-generated or routed through platform-only preview URLs
6. define cleanup rules for:
   1. uploaded media
   2. hosted release artifacts
   3. moderation screenshots
7. define retention policy for artifacts after PR close

Acceptance:

1. preview uploads never pollute production storage
2. preview artifacts can be cleaned up by PR number

### Workstream 6. Platform Preview Wiring

Goal:

1. make the platform deployment aware of per-PR preview infra cleanly

Tasks:

1. define the platform deploy entrypoint for preview automation
2. inject PR-specific public host values where required
3. inject PR-specific backend origin values where required
4. verify that platform runtime topology and public-host logic remain correct in preview
5. verify that platform routes relying on release/media/public URL resolution behave correctly in preview
6. verify that no production redirects or canonical-host assumptions break PR previews
7. verify that preview auth base URL and trusted origins align with deployed preview URLs

Acceptance:

1. the platform app can run as an isolated PR environment without production-coupled assumptions

### Workstream 7. Server Preview Wiring

Goal:

1. make the realtime/API server provisionable per PR without hidden manual steps

Tasks:

1. define the server build/start contract for preview provisioning
2. define the PR-specific origin allowlist model
3. verify that app-preview hostnames are allowed correctly
4. verify that auth mode, master-key behavior, and DB bootstrap work against preview-only data
5. verify that preview teardown destroys the server environment cleanly
6. ensure preview logs and health can be inspected easily

Acceptance:

1. the server can be created, validated, and destroyed as part of preview automation

### Workstream 8. Browser Worker Preview Wiring

Goal:

1. make the release browser worker part of the same PR environment when needed

Tasks:

1. define when worker provisioning is always required versus optional
2. define the worker build/start contract for preview
3. route platform preview env to the PR worker endpoint
4. decide how worker endpoint access is protected:
   1. provider-private networking
   2. worker-side auth/gating
   3. another explicit access control layer
5. verify screenshot capture/finalize behavior in preview
6. verify moderation-time secrets and browser endpoint handling in preview-safe form
7. ensure the worker can be torn down cleanly with the rest of the PR environment

Acceptance:

1. PRs that need release/browser-worker behavior can preview the actual stack, not a degraded approximation
2. worker websocket access is not publicly exposed without an intentional protection model

V1 scope rule:

1. if the browser-worker path is the longest operational blocker, the team may land the preview system first for app + server + DB + storage PR validation
2. that cut is only acceptable if it is documented explicitly as a temporary phase cut
3. worker-backed PR preview remains required before the plan is considered fully complete

### Workstream 9. Trigger, Workflow, And GitHub Automation

Goal:

1. make preview provisioning explicit, self-service for maintainers, and observable from the PR

Tasks:

1. choose the canonical trigger:
   1. label
   2. slash command
   3. both
2. implement the GitHub Actions workflow that handles preview requests
3. validate trust before provisioning
4. compute PR environment names and resource identifiers deterministically
5. create PR comments and/or checks for:
   1. provisioning started
   2. provisioning succeeded
   3. provisioning failed
   4. cleanup started
   5. cleanup succeeded
6. ensure rerunning preview for the same PR updates the same environment rather than leaking duplicate environments unless a reset is explicitly requested
7. decide whether preview refresh happens automatically on new commits after initial provisioning or requires explicit rerun

Recommended default:

1. explicit trigger creates the environment
2. subsequent commits auto-refresh that PR environment until the PR closes or the preview is explicitly destroyed

Acceptance:

1. maintainers can request preview without dashboard archaeology
2. PRs show clear status and URLs
3. the workflow is idempotent enough for repeated use

### Workstream 10. Cleanup And Lifecycle Management

Goal:

1. guarantee that preview environments do not leak indefinitely

Tasks:

1. implement cleanup on PR close
2. implement cleanup on PR merge
3. add scheduled orphan cleanup for failed teardown cases
4. add timeout/TTL logic for stale environments
5. define behavior for “destroy preview now” manual action
6. define behavior for “recreate preview from scratch” manual action

Acceptance:

1. preview environments do not accumulate silently
2. maintainers can recover from stuck environments without manual provider surgery

### Workstream 11. Observability And Failure Handling

Goal:

1. make preview failures diagnosable without digging across multiple dashboards blindly

Tasks:

1. define the canonical preview status surface in GitHub
2. capture provider errors in the workflow output clearly
3. define how maintainers inspect:
   1. app deploy failure
   2. server deploy failure
   3. worker deploy failure
   4. DB creation failure
   5. storage setup failure
4. define how preview environment URLs, env names, and resource IDs are exposed back to maintainers
5. define minimal health checks for a “preview is ready” verdict

Recommended ready checks:

1. platform preview reachable
2. server health/connectivity reachable
3. DB migration/seed completed
4. worker reachable when required
5. preview auth path verified
6. storage namespace prepared

Acceptance:

1. maintainers can tell why preview failed without guessing
2. preview readiness has a real technical definition

### Workstream 12. Cost Guardrails

Goal:

1. keep the one-lane preview system affordable

Tasks:

1. define concurrency limits for active preview environments
2. define TTL for inactive previews
3. define preview retention after the last commit or last access
4. define whether worker provisioning can be skipped for PRs that do not need it
5. define whether heavy seed data or media copying should be avoided by default
6. define provider quota alarms or manual review thresholds

Acceptance:

1. preview remains on-demand by policy and by cost behavior
2. expensive resources do not stay alive unnecessarily
3. preview latency is measured and reviewed as an operational quality metric

### Workstream 13. Security And Trust Hardening

Goal:

1. make the preview system safe for an open-source repo

Tasks:

1. define the exact trusted/internal PR detection rule
2. ensure untrusted forks cannot trigger privileged preview provisioning automatically
3. ensure provider tokens/secrets used for preview automation stay restricted
4. verify that preview env comments do not leak secrets
5. verify that worker endpoint exposure is not granting untrusted browser-control access
6. verify that preview auth accounts are low-risk and preview-only
7. verify that preview origins are isolated from production auth/session assumptions

Acceptance:

1. open-source preview trust boundaries are explicit and enforced

### Workstream 14. Verification Matrix

Goal:

1. prove that the preview system is actually useful before it becomes relied on

Tasks:

1. define a canonical preview smoke matrix
2. validate at least these PR shapes:
   1. landing/platform-only change
   2. server + Arcade contract change
   3. release worker / finalize flow change
   4. auth-related platform change
3. verify preview teardown after close/merge
4. verify rerun/update behavior after new commits
5. verify failure-mode behavior when one provider step fails mid-provisioning

Acceptance:

1. the preview system is proven against representative repo change types

### Workstream 15. Maintainer Documentation And Runbooks

Goal:

1. ensure the system remains operable without tribal knowledge

Tasks:

1. document the maintainer trigger workflow
2. document how to interpret preview status comments/checks
3. document how to force cleanup
4. document how to force rebuild
5. document known preview limitations
6. document fork PR policy
7. document cost expectations and why preview is on-demand rather than automatic

Acceptance:

1. a maintainer unfamiliar with the rollout details can still operate the system confidently

## Rollout Phases

### Phase 1. Freeze The Model

Deliverables:

1. this plan
2. explicit one-lane preview model
3. explicit fork PR trust policy
4. execution workstreams and ownership
5. explicit provider-default preview policy
6. explicit prerequisite refactors before automation

Acceptance:

1. no staging branch is part of the plan
2. the preview story is one sentence long
3. Vercel automatic-preview behavior is no longer ambiguous in the docs

### Phase 1.5. Canonicalize The Deploy Contract

Deliverables:

1. deployment identity/config boundary introduced
2. local-only platform convenience env separated materially from preview/prod deploy contract
3. browser-worker protection model chosen
4. public session/app identity env audit completed

Acceptance:

1. the preview env matrix reflects a cleaned-up deploy contract instead of the current raw state
2. worker-backed preview is not proceeding on an implicit security model

### Phase 2. Stand Up Preview Infrastructure

Deliverables:

1. provider and domain foundations
2. preview-safe Vercel setup
3. preview-safe Railway setup for server
4. preview-safe Railway setup for browser worker
5. dedicated preview DB strategy
6. dedicated preview R2 bucket

Acceptance:

1. a preview can be created entirely against non-production infrastructure

### Phase 3. Wire Preview Auth And Env Cleanly

Deliverables:

1. preview env split across services
2. preview email/password auth flow
3. auth refactor so preview host/origin handling is explicit
4. platform/server/worker preview wiring completed

Acceptance:

1. preview sign-in works cleanly
2. preview auth no longer depends on accidental production assumptions

### Phase 4. Add Trigger And Lifecycle Automation

Deliverables:

1. maintainer trigger mechanism
2. provisioning flow
3. cleanup flow
4. PR comment/check output with resulting URLs and status
5. observability and failure reporting

Acceptance:

1. a trusted PR can get a coherent isolated preview on demand
2. teardown is automatic

### Phase 5. Harden Cost And Safety

Deliverables:

1. fork PR restrictions
2. cost guardrails
3. cleanup verification
4. maintainer documentation for operation
5. verification matrix results

Acceptance:

1. the preview system is safe for open-source operation
2. preview cost is bounded because environments exist only when explicitly requested

## Success Criteria

This plan is successful when:

1. no staging branch is needed
2. there is exactly one canonical preview type
3. that preview type is full-stack and isolated
4. maintainers can trigger it on demand
5. backend-heavy PRs no longer rely on fake or partial previews
6. preview auth is simple and explicit
7. preview DB and storage never point at production
8. fork PR trust remains conservative by default
9. the preview system is easier to explain than the product deployment topology

## Non-Goals

This plan does not require:

1. automatic preview for every PR
2. multiple preview lanes
3. a long-lived staging branch
4. preview parity with every production integration on day one
5. coupling package publishing to preview deployment

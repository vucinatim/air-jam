# Air Jam 1.0 Release Roadmap

Last updated: 2026-08-31
Status: active governing release plan

Related docs:

1. [Current State](../current-state.md)
2. [Vision](../vision.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Capability Inventory](../capability-inventory.md)
5. [Working Agreements](../working-agreements.md)
6. [Production Observability Baseline](../strategy/production-observability-baseline.md)
7. [Product Telemetry Architecture](../architecture/product-telemetry-architecture.md)
8. [Agent Tooling Architecture](../architecture/agent-tooling-architecture.md)
9. [Agent Session Contract](../contracts/agent-session-contract.md)
10. [Discoverability And Launch Promotion Plan](./discoverability-and-launch-promotion-plan.md)
11. [Framework Launch Article Draft](../content/framework-launch-article-draft.md)
12. [Organic Discovery Retrospective](../archive/2026-08-26-organic-discovery-retrospective.md)
13. [Previous V1 Plan Snapshot](../archive/2026-08-26-v1-release-plan-pre-roadmap.md)
14. [Deployment And Monetization Strategy](../strategy/deployment-and-monetization-strategy.md)
15. [1.0 Release Execution Plan](./v1-release-execution-plan.md)
16. [Gate 1 Codebase Assessment](../audits/v1-canonicalization/codebase-assessment.md)
17. [Gate 1 Canonicalization Execution Set](../audits/v1-canonicalization/canonicalization-execution-set.md)

## Purpose

This is the single governing execution plan for the Air Jam 1.0 release.

It replaces the older assumption that the remaining work is only a final game
proof, hosted-release check, and launch-content pass. Those proofs still matter,
but six months of agent and tooling progress changed the architectural context
around them.

The 1.0 track now owns:

1. the final public product and compatibility promise
2. the agent-development-harness architecture re-baseline
3. repo canonicalization and deliberate removal of obsolete paths
4. the external-agent golden-path proof
5. launch-scale reliability, recovery, security, and cost controls
6. operational events, alerting, incident automation, and bounded remediation
7. public package, documentation, article, and distribution readiness
8. the final production rehearsal and go/no-go decision

If work materially affects confidence in the 1.0 promise, it belongs here.
Subordinate implementation plans may exist only when a roadmap gate needs a
bounded multi-step track. They must link back here and must not redefine the
release contract.

## Executive Conclusion

Air Jam should not build a worse general-purpose coding agent inside a hosted
editor.

The stronger and now-proven direction is:

1. Air Jam owns the game framework and complete development/evaluation harness
2. Codex, Claude Desktop, T3 Code, terminal agents, and future clients connect
   through public CLI, MCP, and typed machine contracts
3. agents use the same runtime, input, state, logs, evaluation, asset, release,
   and publishing models as humans
4. the hosted product is an optional control room and public distribution plane,
   not the only place where authoring or operation can happen
5. local and hosted execution converge on one coherent operating model
6. Air Jam becomes more capable as general-purpose agents improve instead of
   competing with their editor, model, or orchestration layers

The development harness therefore names the complete creation and evaluation
capability, not a mandatory browser IDE. The ratified G0-01 decision below
retires `Studio` as the primary 1.0 name. If a future hosted Studio UI
coordinates or visualizes the harness, it must remain one client of the same
public contracts.

## The 1.0 Promise

The ratified public contract is:

> From a clean machine, an agent in any supported CLI/MCP-capable environment
> can discover Air Jam, create or modify a multiplayer game, run it, control
> players, inspect authoritative state and visuals, diagnose and fix failures,
> evaluate the result, and publish a hosted release without private knowledge
> or mandatory Air Jam UI interactions.

The supporting human promise remains:

> Air Jam is an open-source framework for shared-screen multiplayer games where
> every phone can become a controller, with one coherent development and runtime
> model shared by humans and agents.

1.0 means these contracts are stable, documented, publicly installable, and
proven end to end. It does not mean the long-term autonomous-product vision is
finished.

## Non-Negotiable Principles

1. **Agent-first parity**: an operator or creator capability is incomplete when
   it exists only in a human UI.
2. **One canonical path**: CLI, MCP, UI, tests, and automation share domain
   services rather than implementing parallel behavior.
3. **Machine-readable authority**: agents inspect explicit state, events, logs,
   and outcomes instead of inferring correctness only from pixels or prose.
4. **No compatibility sediment**: obsolete models are removed rather than kept
   beside the new architecture without a real public compatibility obligation.
5. **Safe autonomy**: automated actions are bounded by permissions, budgets,
   idempotency, cooldowns, audit records, and verification.
6. **Honest evidence**: approximate product telemetry never masquerades as
   authoritative lifecycle, billing, runtime, or incident state.
7. **Boring failure**: overload and dependency failure degrade predictably,
   preserve data, bound cost, and expose a recovery path.
8. **Evidence closes gates**: a checklist item is not complete merely because
   code exists; it needs a reproducible proof artifact.

## Current Baseline

The roadmap starts from substantial implemented reality:

1. the framework, platform, realtime server, release browser worker, Postgres,
   hosted-release, managed-media, and public Arcade planes exist
2. the canonical deployment topology is running on Railway with native PR
   environments
3. CLI and MCP already cover semantic game sessions and hosted releases
4. first-party product telemetry now has a closed contract, deterministic
   projections, retention, health inspection, and full CLI operation
5. public agent resources and AI-pack surfaces exist
6. the repository has strong typecheck, lint, test, build, scaffold, release,
   canonical-contract, and performance gates
7. five intended launch games already provide a meaningful product proof set:
   `pong`, `air-capture`, `code-review`, `last-band-standing`, and `the-office`
8. Air Jam has been publicly reachable long enough to produce the first organic
   report of an LLM recommending it to someone who independently wanted an
   open-source Jackbox-like system

The remaining problem is not inventing the entire product. It is deciding which
contracts deserve 1.0, deleting or consolidating what no longer fits, proving
the public loop from outside the repo, and making launch failure safe.

## Release Gates

| Gate                     | Question                                                                                       | Required evidence                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0. Re-baseline           | Are we committing to the right 1.0 product and architecture?                                   | Accepted contract, explicit cuts, supported-client matrix, capacity and autonomy policy                        |
| 1. Canonicalize          | Is there one clean implementation model without obsolete competing paths?                      | Architecture audit, removals/refactors, package/config/docs alignment, green canonical checks                  |
| 2. Golden path           | Can an external agent complete the full lifecycle from a clean environment?                    | Recorded clean-room run with machine-readable artifacts and no private intervention                            |
| 3. Launch safety         | Can production absorb and safely reject launch traffic without uncontrolled cost or data loss? | Capacity envelope, burst/soak results, rollback/restore proof, overload and dependency-failure drills          |
| 4. Autonomous operations | Can the system detect, correlate, explain, and safely act on failures?                         | SLOs, synthetics, incident pipeline, deduplicated issue flow, CLI runbooks, bounded remediation drills         |
| 5. Security and trust    | Are public creation, runtime, release, and agent surfaces safe enough for wider use?           | Threat review, abuse controls, auth/secret proof, quota policy, dependency and artifact checks                 |
| 6. Public release        | Are packages, docs, examples, claims, and launch content aligned with shipped reality?         | Clean install proof, package/release candidate, public docs crawl, article/demo assets, distribution checklist |
| 7. Rehearsal and launch  | Can we release, observe, recover, and communicate from one exact candidate?                    | Production rehearsal, go/no-go record, terminal deploy health, live smoke, rollback readiness, launch sequence |

## Gate 0: Product And Architecture Re-Baseline

### Objective

Freeze the meaning of 1.0 before freezing APIs or doing another cleanup pass.

### Ratification Record

Gate 0 was approved by Tim Vučina on `2026-08-28` through the canonical
maintainer checkpoint `G0-03`.

The approval covers the complete G0-01 and G0-02 packets:

1. `Air Jam` is the one public product name
2. `Air Jam Studio` is retired as a primary 1.0 product name; the shipped
   capability is the agent-operable development harness
3. terminal and MCP profiles are the portable compatibility boundary, with
   Codex as the full-lifecycle proof client and Claude Desktop as the
   independent desktop MCP proof
4. intentionally documented public package and machine contracts receive 1.x
   semantic-version stability after Gate 1 freezes the exact inventory
5. the framework, harness, self-hosting, ordinary play, and generous bounded
   hobby cloud are free for 1.0; payments and checkout are not release blockers
6. variable infrastructure is bounded at `$100` in an ordinary month and
   `$150` for the billing cycle containing the 1.0/HN launch
7. the capacity proof targets `100` sustained rooms and a three-times launch
   burst, with gameplay degraded last
8. bounded verified stateless/provider recovery may be automatic, but
   production code promotion and budget increases require approval

This decision is the product authority for later gates. Reopening it requires a
new explicit maintainer decision rather than terminology or implementation
drift.

### Ratified Economic Policy

The product boundary is settled even though exact quotas and prices are not:

1. the framework and complete creation/evaluation harness remain free
2. creators normally bring their own external agent, model account, local
   compute, or cloud account
3. self-hosting and bring-your-own-cloud remain first-class escape hatches
4. official free-cloud capacity is useful for ordinary hobby use but bounded by
   one explicit monthly learning budget
5. monetization begins from measured activation, retention, cost, and requested
   value rather than an arbitrary signup count
6. payments may wait, but metering, quotas, spend alerts, bounded queues, safe
   degradation, and kill switches may not
7. active social sessions are never interrupted by a surprise paywall
8. creator rewards create no maintainer-funded liability and may use only an
   existing capped pool funded by realized revenue or sponsors
9. consumer premium-game or Arcade subscriptions are post-1.0 options that
   require proven catalog demand and repeat play

### G0-01 Product, Naming, Client, And Compatibility Decision Packet

Status: ratified through `G0-03` on `2026-08-28`.

#### Evidence Basis

The proposal follows what Air Jam already ships rather than inventing a new
product for the release:

1. `@air-jam/sdk`, `@air-jam/server`, `create-airjam`, and
   `@air-jam/mcp-server` are public packages today
2. the CLI and MCP server expose semantic game sessions, authoritative state,
   controller actions, logs, visuals, evaluation, and hosted-release workflows
3. public agent resources and the AI pack make the contracts discoverable
   outside the repository
4. [`@air-jam/harness`](../../packages/harness/package.json) is an internal
   composition package, not a separately published creator product
5. Air Jam does not ship a hosted browser IDE, proprietary model, or mandatory
   in-app agent; the current architecture deliberately lets creators bring
   their own agent and compute

The supporting contracts are documented in the
[Framework Paradigm](../framework-paradigm.md),
[Agent Tooling Architecture](../architecture/agent-tooling-architecture.md),
[Agent Session Contract](../contracts/agent-session-contract.md), and
[Capability Inventory](../capability-inventory.md).

#### Ratified 1.0 Product Contract

Use `Air Jam` as the one public product name and describe it as:

> The open-source framework and agent-operable development harness for
> shared-screen multiplayer games controlled by phones.

The launch-level promise should be:

> Use the coding agent you already have to create, run, control, inspect,
> evaluate, and publish an Air Jam game through documented CLI and MCP
> contracts. No private repository knowledge or mandatory Air Jam authoring UI
> is required.

This is intentionally narrower than claiming that Air Jam is a general-purpose
AI game engine, a no-code editor, or a fully autonomous game studio. The Gate 2
clean-room proof must pass before this language becomes a 1.0 claim.

#### Ratified Naming Decision

`Air Jam Studio` is retired as a primary public 1.0 product name.

For 1.0, `development harness` or `agent harness` names the capability formed
by the framework, runtime, CLI, MCP server, semantic sessions, evaluation, and
release tooling. `Studio` may remain in archived historical material, but it
must not imply a separately shipped browser editor or a second architecture in
the live 1.0 product surface.

A future visual control room may use the Studio name only if it is one client
of the same public contracts and provides enough distinct product value to
justify the name. It is not part of the 1.0 compatibility boundary.

This choice keeps the public model honest: creators use Air Jam from Codex,
Claude, a terminal, or another compatible client instead of entering a
proprietary Air Jam editor.

#### Responsibility And Authority Split

| Surface                       | 1.0 responsibility                                                                                                       | Authority                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Local workspace and runtime   | Source, assets, build, local game processes, and deterministic development loop                                          | Local files and runtime state                                            |
| Air Jam CLI                   | Canonical discoverable lifecycle for setup, run, inspection, sessions, evaluation, diagnostics, release, and maintenance | Shared domain services and documented structured output                  |
| Air Jam MCP                   | Typed adapter over the same lifecycle for MCP-capable clients                                                            | The same domain services as the CLI; no duplicate business logic         |
| External agents               | Plan, edit, invoke tools, inspect evidence, and iterate                                                                  | No independent product authority; they operate through Air Jam contracts |
| Hosted dashboard/control room | Optional human inspection and operation                                                                                  | The same hosted APIs and services used by machine clients                |
| Hosted release and Arcade     | Artifact ingestion, release state, publishing, public discovery, and managed runtime policy                              | Server-side release records, deployment state, and runtime policy        |

The browser remains useful for visible UI proof and human operation. It is not
the canonical automation lane and is never required to complete the agent
lifecycle.

#### Supported Client Matrix

`Supported` means Air Jam owns a documented contract and a reproducible test,
not that it owns or guarantees a proprietary client's user interface.

| Client/profile                                     | 1.0 status                                         | Required release evidence                                                               |
| -------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Terminal-capable coding agents                     | Supported baseline                                 | Clean machine can complete the full lifecycle using documented commands and stable JSON |
| MCP clients with local stdio tool/resource support | Supported protocol profile                         | Public install, discovery, tool-schema, session bootstrap, and failure-path proof       |
| Codex                                              | Launch-certified coding-agent client               | Full Gate 2 clean-room golden path                                                      |
| Claude Desktop                                     | Launch-certified desktop MCP client                | Independent install, discovery, and semantic-session bootstrap                          |
| Claude Code, T3 Code, and other conforming clients | Compatible by contract, not individually certified | No branded support claim until the same recorded proof passes                           |
| Air Jam browser surfaces                           | Optional supported human client                    | Human smoke tests; not required for agent authoring or operation                        |

Vendor-specific setup guides may exist, but the portable terminal and MCP
profiles remain the actual compatibility contract. A vendor regression can
therefore be diagnosed without redefining Air Jam's architecture.

This matrix matches the vendors' current documented capabilities: OpenAI
documents local STDIO MCP servers across Codex clients in its
[Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
and Anthropic documents local MCP servers for Claude Desktop in its
[desktop extension guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

#### Ratified 1.0 Compatibility Contract

Before 1.0, Gate 1 may freely remove accidental and obsolete surfaces. At the
1.0 release, the following deliberately documented surfaces become stable:

1. documented public exports from `@air-jam/sdk`
2. documented commands, flags, exit behavior, and JSON schemas from
   `@air-jam/server` and `create-airjam`
3. documented MCP tool names, resource identities, inputs, outputs, and error
   semantics from `@air-jam/mcp-server`
4. the documented runtime, controller-input, replicated-state, signal,
   semantic-session, evaluation, and release contracts those packages expose
5. the public discovery and AI-pack resources needed to find those contracts

Compatibility rules:

1. public packages follow semantic versioning after `1.0.0`
2. documented 1.x machine contracts change additively; a breaking contract
   change requires a new major version
3. human-readable terminal prose is not stable, but documented JSON field
   meanings and exit behavior are
4. MCP compatibility covers the published protocol contract, not undocumented
   quirks or installation flows of every third-party host
5. generated projects pin a mutually compatible package set; upgrading is an
   explicit coordinated dependency change, not an indefinite legacy-runtime
   promise
6. private packages, internal modules, undocumented exports, prerelease
   behavior, and archived Studio experiments receive no compatibility promise
7. implementation internals retain zero compatibility sediment: public
   contracts may be preserved or intentionally major-versioned, but obsolete
   internal paths are removed rather than maintained in parallel

Gate 1 must publish the exact export and machine-schema inventory before the
release candidate. Merely being technically exported before 1.0 does not make
a symbol part of this promise.

#### Explicit Product Cuts From This Decision

In addition to the roadmap-wide cuts below, this packet excludes from 1.0:

1. a separately shipped or mandatory Air Jam Studio IDE
2. Air Jam-provided model inference or bundled agent subscriptions
3. a built-in general-purpose multi-agent orchestration UI
4. individual support guarantees for every terminal agent or MCP host
5. arbitrary application frameworks, native apps, or managed server-code
   execution outside the documented Air Jam game/release contract
6. a mobile-native authoring environment
7. autonomous production code changes or unbounded self-healing
8. claims that visual browser automation is the primary test or control path

#### Decisions Ratified In G0-03

The maintainer approved these four decisions as one batch:

1. one umbrella product name: `Air Jam`
2. retire Studio as the primary 1.0 name and describe the shipped capability as
   the agent-operable development harness
3. certify the portable terminal and MCP profiles, with Codex as the full-loop
   client and Claude Desktop as the second-client proof
4. apply semantic-version stability only to the intentionally documented
   package and machine contracts frozen after Gate 1

### G0-02 Capacity, Free-Cloud, Budget, Quota, And Autonomy Decision Packet

Status: ratified through `G0-03` on `2026-08-28`. The policy is intentionally
generous during discovery: Air Jam should spend a known acquisition and
learning budget before it rejects legitimate early users.

#### Measured Cost Baseline

The proposal is anchored in the live production project rather than a generic
cloud estimate:

1. the current Railway topology is three application services plus Postgres
2. Air Jam used `$7.99` in the previous complete Railway billing cycle
3. Air Jam has used `$6.57` in the current cycle as of `2026-08-28`
4. approximately `$5.95` of the current `$6.57` is always-on application memory;
   CPU, database storage, and traffic are currently minor cost lanes
5. all four production services were healthy when the snapshot was taken
6. the Railway project currently shares a workspace with unrelated projects
   and no workspace usage limit is configured, so a workspace-wide hard stop
   cannot safely represent an Air Jam-only budget

Railway currently charges usage-based rates for memory, CPU, egress, and volume
storage, with the base subscription counting toward usage. The current rates
and plan behavior are retained in Railway's
[pricing documentation](https://docs.railway.com/pricing) and
[plan reference](https://docs.railway.com/pricing/plans). Gate 3 must refresh
these rates before the release rehearsal rather than treating this snapshot as
permanent.

#### Budget Decision

Use two explicit Air Jam variable-infrastructure budgets, denominated in USD
because that is the provider billing currency:

| Period                                     | Normal operating target | Warning threshold | Protection threshold | Hard ceiling |
| ------------------------------------------ | ----------------------: | ----------------: | -------------------: | -----------: |
| Ordinary prerelease and post-launch month  |                   `$25` |             `$50` |                `$75` |       `$100` |
| Billing cycle containing the 1.0/HN launch |                   `$50` |             `$75` |               `$100` |       `$150` |

Rules:

1. the ceiling covers variable production infrastructure attributable to Air
   Jam across Railway and any additional managed runtime, storage, bandwidth,
   validation, moderation, or notification provider
2. annual domain registration and already-approved fixed developer tooling are
   tracked separately because they cannot be controlled by runtime backpressure
3. the ordinary `$100` ceiling is roughly twelve times the last complete Air
   Jam billing cycle; the `$150` launch ceiling is a one-cycle acquisition
   experiment, not a new permanent baseline
4. money below the ceiling is allowed to be spent preserving activation and
   learning; the target is not a reason to reject healthy legitimate use
5. increasing either ceiling requires a maintainer decision backed by measured
   activation, retention, revenue, or a deliberate new experiment
6. no automated action may silently raise a provider spending limit
7. before launch, Air Jam needs either a dedicated billing workspace or a
   project-scoped budget controller plus a workspace ceiling that accounts for
   unrelated projects; the current shared workspace must not let an Air Jam
   limit stop other products

#### Budget Response Ladder

Budget state is determined from authoritative provider usage plus internally
metered expensive work, never from approximate product telemetry.

| Air Jam monthly spend   | Automatic behavior                                                                                                  | Human notification                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Below normal target     | Operate normally; quotas stay in shadow mode except abuse and safety limits                                         | Monthly digest only                              |
| At warning threshold    | Open or update one cost incident, identify the growing lane, and forecast the ceiling date                          | Non-urgent notification                          |
| At protection threshold | Enforce expensive-lane quotas, stop nonessential preview/PR capacity, and prevent queue growth                      | Urgent same-day notification                     |
| At 90% of hard ceiling  | Pause new browser-validation and optional processing jobs; continue cached reads, published games, and active rooms | Immediate notification                           |
| At hard ceiling         | Reject new cost-creating hosted work with a clear retry/BYOC path; let active rooms finish when technically safe    | Immediate incident; no automatic budget increase |

Core gameplay is the last lane degraded. Public docs, cached public releases,
login, usage inspection, export, and self-host/BYOC instructions remain
available whenever their dependencies are healthy. An optional publishing or
validation queue reaching its boundary must not take down active social play.

#### Free-Cloud Policy

The 1.0 free cloud is a complete hobby product, not a crippled trial:

1. no signup fee, card requirement, playtime paywall, or expiring evaluation
2. no monthly player quota for normal public play while the system remains
   below the protection threshold
3. controllers never pay and an active room is never interrupted to sell an
   upgrade
4. public games remain playable and the currently published release is retained
   while the creator account remains in good standing
5. quotas are enforced first against new expensive work, abuse, and resource
   accumulation—not against ordinary visits, code creation, or a game already
   in progress
6. every enforced boundary returns a machine-readable reason, current usage,
   reset or retry time, and self-host/BYOC alternative

#### Initial Per-Creator And Per-Game Allowances

These are internal 1.0 safety ceilings. They should be visible in usage
inspection, but they are not marketing copy and remain in shadow mode below the
budget warning threshold unless abuse is detected.

| Resource                    |                                      Initial free allowance | Boundary behavior                                                                     |
| --------------------------- | ----------------------------------------------------------: | ------------------------------------------------------------------------------------- |
| Games                       |                                      `50` games per creator | Block only creation of game 51; existing games remain editable and playable           |
| Publicly listed games       |                                            `20` per creator | Additional games may remain unlisted or self-hosted                                   |
| Managed artifacts and media |                    `2 GB` per creator and `500 MB` per game | Reject new uploads; never corrupt or partially accept an artifact                     |
| One release archive         |   `100 MB` compressed, `250 MB` extracted, `25 MB` per file | Keep the existing validated archive-safety limits                                     |
| Hosted release submissions  | `200` per creator per rolling 30 days, maximum `50` per day | Queue first, then reject new submissions with reset time                              |
| Browser validation jobs     | `100` per creator per rolling 30 days, maximum `20` per day | Queue or allow local validation; publishing may wait without affecting play           |
| Concurrent release jobs     |                                             `2` per creator | Queue additional jobs                                                                 |
| Room-hours                  |   `1,000` hosted room-hours per creator per rolling 30 days | Shadow-meter normally; at protection state, stop new rooms after current rooms finish |
| Concurrent hosted rooms     |                          `50` per creator and `50` per game | Reject only new rooms above the ceiling; existing rooms continue                      |
| Controllers per room        |                            Game-declared maximum up to `16` | Existing framework contract                                                           |

Additional retention rules:

1. the currently published release is not deleted automatically
2. failed uploads and temporary extraction data expire within `24` hours
3. superseded unpublished artifacts may be reclaimed after `180` days of
   inactivity with at least seven days of creator-visible warning
4. creators can export before reclamation
5. account, IP, game, and global controls are combined so one abusive identity
   cannot evade a bound while legitimate groups behind one NAT are not treated
   as one user

These allowances are intentionally much larger than expected early hobby use.
Their first purpose is bounding abuse and pathological automation. Gate 3 must
replace any number that load, storage, or unit-cost evidence proves unsafe;
reducing a legitimate-user allowance requires recording the evidence and user
consequence.

#### Ratified Launch Capacity Target

The following is the design and test target, not a claim about the currently
deployed single-instance system. Gate 3 must measure it from production-like
infrastructure before it becomes the published support envelope.

| Lane                              |             Sustained target |        Short burst target | Overload behavior                                                    |
| --------------------------------- | ---------------------------: | ------------------------: | -------------------------------------------------------------------- |
| Active rooms                      |                        `100` |      `300` for 15 minutes | Stop new rooms; preserve existing rooms                              |
| Realtime controllers              |                      `1,600` |    `4,800` for 15 minutes | Reject new joins above room/global capacity with retry guidance      |
| Dynamic platform/API traffic      |                    `100 RPS` |   `300 RPS` for 5 minutes | Rate-limit expensive mutations before reads                          |
| Cached public pages/releases/docs |                    `500 RPS` | `1,500 RPS` for 5 minutes | Serve stale-safe cached content or explicit retry responses          |
| Browser validation                |          `2` concurrent jobs |         Queue depth `100` | Queue with position/timeout; pause intake before overload            |
| Artifact ingestion                |       `4` concurrent uploads |          Queue depth `50` | Reject before upload when no bounded slot exists                     |
| Database connections              | `40` application connections |   `80%` warning threshold | Backpressure at the application boundary; never open unbounded pools |

The expected launch peak for planning is `100` rooms, not the burst target.
Gate 3 must prove at least the sustained envelope and run a deliberate burst at
three times that expected peak, consistent with this roadmap's release gate.
If the current architecture cannot meet it cleanly, the honest choices are to
lower and publish the measured envelope or fix the bottleneck before launch;
the number must not survive as fiction.

#### Queue And Fairness Policy

1. active gameplay has priority over release validation, media processing,
   previews, and background analytics work
2. one creator cannot occupy every expensive-worker slot
3. queued work has an explicit position or status, deadline, cancellation path,
   and idempotency key
4. retryable failure does not consume another user allowance until a new
   expensive attempt actually starts
5. failed or canceled work releases its reservation promptly
6. overload uses `429` or `503`-class machine-readable outcomes with retry
   timing rather than hanging, partial success, or silent loss

#### Bring-Your-Own-Cloud 1.0 Support Bar

Free-cloud limits are acceptable only because creators have a real escape
hatch. For 1.0:

1. self-hosting from public packages and the generated project is fully
   documented and release-tested
2. one creator-owned Railway path is launch-certified through the repo/agentic
   CLI surface, including deploy, inspect, logs, variables, health, and rollback
3. the same container, environment schema, static release artifact, and runtime
   contracts remain usable on other providers without an Air Jam account
4. non-Railway providers are portable-by-contract, not individually supported
   until a provider-specific golden path is tested
5. provider credentials stay in the creator's account and Air Jam does not
   become the hidden payer

#### 1.0 Autonomy Ceiling

The system may automatically perform the following after Gate 4 proves the
runbook and verification path:

1. collect health, cost, queue, lifecycle, and provider evidence
2. correlate and deduplicate incidents and create/update one GitHub issue per
   confirmed fingerprint
3. retry an idempotent failed job within its fixed attempt and cost budget
4. restart one unhealthy stateless service at most twice in 30 minutes
5. roll back a just-deployed stateless service to the exact previous known-good
   deployment when canary failure is unambiguous, once per deployment
6. pause and resume expensive job intake using explicit budget/health
   thresholds
7. expire temporary uploads, dead rooms, and leases under documented lifecycle
   rules
8. verify every action and revert or escalate when verification fails

The following always require maintainer approval:

1. increasing a budget, quota, replica ceiling, region count, or provider plan
2. production database restore, destructive migration, or data deletion outside
   an already-ratified retention rule
3. rotating credentials in response to a suspected compromise
4. enabling maintenance mode for core play
5. promoting a release, publishing npm packages, or deploying a code change
6. changing public compatibility, pricing, privacy, or retention policy

Agents may reproduce defects, write regression tests, prepare code, and open a
PR automatically. They may not merge or promote a code-changing repair to
production in 1.0. Security, data-integrity, authorization, and billing
incidents diagnose and contain through allowlisted controls, then escalate.

Every autonomous mutation requires an audit record, idempotency key, maximum
attempts, cooldown, cost bound, blast-radius bound, before/after evidence, and
an operator CLI/MCP inspection and stop action.

#### Notification Policy

1. wake the maintainer only for active user-visible core failure, suspected
   security/data loss, or imminent hard-ceiling exhaustion
2. queued publishing, optional moderation, analytics delay, and warning-level
   cost drift create/update an incident and wait for normal waking hours
3. repeated symptoms update one incident rather than sending repeated pages
4. a recovery action that verifies successfully produces a digest entry; a
   failed verification escalates once with the complete evidence bundle

#### Monetization And Budget-Review Triggers

Signups alone trigger nothing. Review the free policy or run the first paid
experiment when any two of the following are true in a rolling 30-day period:

1. at least `10` creators publish a game
2. at least `5` creators return and publish an update or another game
3. at least `3` games each receive `20` completed rooms not attributable to the
   creator's own testing
4. at least `10` legitimate creators reach one free boundary
5. at least `3` users independently ask to pay for event capacity, privacy,
   teams, branding, domains, analytics, or support
6. Air Jam exceeds `$75` variable infrastructure spend for two consecutive
   months

Crossing a trigger starts a pricing/value experiment; it does not retroactively
restrict users or automatically create a subscription. Any paid offer must
preserve the open framework, active-room completion, and the self-host/BYOC
escape hatch.

#### Consequences Of The Recommendation

1. early legitimate users are unlikely to encounter a product limit
2. the maintainer knowingly risks up to `$100` in an ordinary month and `$150`
   in the launch billing cycle, but not an unbounded invoice
3. the launch architecture must implement metering, queueing, feature-level
   pause controls, and budget isolation before HN
4. the current shared Railway workspace is an operational gap because its
   provider ceiling cannot isolate Air Jam
5. the current realtime rate limits and artifact-size guards are useful safety
   primitives, but global capacity, per-creator accounting, expensive-job
   queueing, and tested autonomous runbooks remain Gate 3 and Gate 4 work

#### Decisions Ratified In G0-03

The maintainer approved these decisions as one batch:

1. `$100` ordinary and `$150` launch-cycle variable-infrastructure ceilings
2. the generous shadow-first free allowances and gameplay-last degradation
   order
3. the `100`-room sustained launch target and three-times burst proof
4. Railway as the one launch-certified BYOC provider while other providers
   remain portable by contract
5. bounded Level 4 recovery for proven stateless/provider runbooks, with no
   autonomous production code promotion

### Work

1. ratify the 1.0 promise in this document or replace it with an equally
   concrete contract
2. define the agent development harness and retire `Studio` from the primary
   1.0 public product vocabulary
3. define the responsibility split among:
   1. local workspace and runtime
   2. Air Jam CLI
   3. Air Jam MCP
   4. external coding/desktop agents
   5. hosted dashboard/control room
   6. hosted Arcade and release infrastructure
4. publish the supported 1.0 client matrix:
   1. terminal/CLI baseline
   2. at least one coding-agent integration
   3. at least one desktop MCP client
   4. browser UI as an optional human surface
5. define which public APIs and packages receive 1.0 stability guarantees
6. define the exact official free-cloud envelope and the 1.0
   bring-your-own-cloud support bar within the ratified economic policy
7. choose and document the launch capacity envelope and monthly/burst cost
   budget before load work begins
8. choose the v1 autonomy ceiling:
   1. what may happen automatically
   2. what requires approval
   3. what may only diagnose and recommend
9. identify explicit 1.0 cuts and post-1.0 horizons

### Done When

1. the contract is understandable without repo history
2. every public surface has a clear owner and authority
3. the supported client, compatibility, capacity, cost, and autonomy policies
   are written
4. no later gate depends on an unresolved product-definition decision

## Gate 1: Codebase And Contract Canonicalization

### Objective

Make the repository as clean and unsurprising as the public promise.

### Audit Scope

1. package and dependency graph
2. composition roots for platform, server, worker, CLI, MCP, and game runtime
3. runtime, transport, controller, semantic-session, release, telemetry, and
   deployment authority boundaries
4. duplicate UI/domain/CLI/MCP orchestration
5. obsolete Studio, preview, analytics, deployment, compatibility, and legacy
   game paths
6. environment and deployment identity resolution
7. generated artifacts and source-of-truth ownership
8. public package exports and accidental API surface
9. dead code, orphan endpoints, unused feature flags, stale scripts, and stale
   docs
10. cross-game folder, naming, lifecycle, and agent-contract consistency
11. test realism, mock-heavy blind spots, and missing failure-path coverage

### Rules

1. centralize shared contracts before parallel cleanup begins
2. prefer deletion or end-state refactoring over adapters that preserve obsolete
   internal models
3. keep domain logic independent from UI, transport, provider, and process IO
4. every human operator workflow must resolve to the same service used by its
   machine surface
5. record only durable non-blocking follow-ups in `docs/suggestions.md`; release
   blockers stay in this roadmap
6. freeze user-facing feature expansion until Gate 1 closes
7. implement the accepted work as coherent deletion-first bundles, not isolated
   patches that preserve duplicate owners
8. cut an exact committed baseline before canonicalization implementation and
   report source, test, documentation/guidance, and generated-artifact Git
   deltas separately

### Done When

1. a written audit identifies canonical paths and approved removals
2. no known UI-only release-critical capability remains
3. no known duplicate runtime, release, telemetry, or deploy control plane
   remains
4. public exports and compatibility guarantees are intentional
5. canonical guard, typecheck, lint, tests, build, scaffold, release doctor, and
   generated-artifact checks pass from a clean checkout
6. every affected capability has one named canonical owner and the replaced
   routes, commands, exports, files, or packages are demonstrably gone
7. the final Gate 1 evidence records exact base and head commit SHAs plus
   additions, deletions, and net change for source, tests, and docs/guidance

## Gate 2: External-Agent Golden Path

### Objective

Prove the 1.0 promise from outside the repository's accumulated context.

### Required Scenario

From a clean environment, a supported external agent must:

1. discover the authoritative Air Jam entrypoint
2. install the public packages and agent integration without unpublished local
   dependencies
3. create a new game or make a substantial change to a canonical scaffold
4. start the complete local development loop through the documented front door
5. open a semantic game session
6. start or ready play from controllers
7. invoke real controller/game actions
8. inspect authoritative runtime state, signals, logs, and visual output
9. identify at least one seeded or naturally discovered defect
10. implement a fix
11. replay the scenario and prove the regression is closed
12. run evaluation and release gates
13. submit, inspect, and publish a hosted release through CLI or MCP
14. verify the live hosted result

### Proof Requirements

1. no undocumented command or private maintainer knowledge
2. no mandatory dashboard interaction
3. no source-code inference where a documented runtime contract should exist
4. exact command, event, state, evaluation, and release artifacts retained
5. elapsed time and confusion points recorded
6. at least one second supported agent client repeats the discovery and session
   bootstrap portions
7. every discovered friction point is classified as:
   1. release blocker
   2. explicit 1.0 cut
   3. post-1.0 improvement

### Done When

The run can be replayed by another agent without Tim acting as hidden control
plane.

## Gate 3: Launch-Scale Reliability And Recovery

### Objective

Make an HN-scale traffic spike a capacity event, not a personal emergency.

### Capacity And Backpressure

1. define the supported envelope for:
   1. HTTP requests per second
   2. concurrent rooms
   3. concurrent controllers and realtime connections
   4. release submissions and browser-worker jobs
   5. database connections and transaction throughput
   6. artifact/media storage and bandwidth
2. verify connection pooling and per-service connection ceilings
3. verify autoscaling behavior and regional constraints
4. put bounded queues and concurrency controls in front of expensive work
5. verify rate limits, payload limits, room/session limits, and release quotas
6. cache static releases, public docs, and agent resources appropriately
7. enforce automatic lifecycle cleanup for rooms, jobs, uploads, and temporary
   artifacts
8. add spend caps, kill switches, and feature-level circuit breakers
9. ensure overload produces explicit retry/rejection behavior rather than
   partial corruption or unbounded work

### Recovery

1. automate backups at a documented frequency
2. perform and time a real restore into an isolated environment
3. prove deployment rollback to the previous known-good image/commit
4. prove queue pause/resume and failed-job replay
5. prove optional subsystem failure does not take down core play
6. define degraded modes for publishing, moderation, media, telemetry, and agent
   resources
7. run a sustained soak and a burst above the published support envelope

### Done When

1. the supported envelope is published internally and tested at no less than
   three times its expected launch peak
2. traffic above the safe envelope is rejected or degraded deliberately
3. backup restore and deployment rollback have measured recovery times
4. no tested dependency failure creates silent data loss or uncontrolled spend
5. one operator command can disable or pause each expensive/risky lane

## Gate 4: Operational Events And Autonomous Operations

### Objective

Build the event-driven operational foundation that can grow into autonomous
product lifecycle management and self-healing.

### Authority Separation

Keep three planes explicit:

1. **product telemetry**: approximate visits, discovery, intent, and agent reach
2. **lifecycle/runtime events**: authoritative rooms, sessions, releases, jobs,
   deploys, and failures
3. **operational incidents**: deduplicated symptoms, severity, ownership,
   investigation, remediation, and outcome

Product telemetry must never trigger correctness-critical remediation by itself.

### Canonical Incident Flow

`signal -> fingerprint -> correlate -> incident -> diagnose -> remediate -> verify -> close or escalate`

### Foundation Work

1. define a versioned operational-event envelope
2. propagate correlation across deployment, request, user-safe session, room,
   runtime, release, worker job, and provider operation where applicable
3. add a durable outbox and job-delivery contract behind a replaceable transport
4. define service-level objectives and alert thresholds around user-visible
   symptoms
5. add synthetic checks for:
   1. landing and docs
   2. Arcade discovery and hosted release rendering
   3. platform and realtime health
   4. room creation and controller connection
   5. a small semantic gameplay loop
   6. release submission/publish dependencies
6. establish structured error reporting across platform, server, worker, and
   hosted game/runtime stories
7. fingerprint and deduplicate incidents before creating external work items
8. build a GitHub issue bridge that creates or updates one issue per confirmed
   incident fingerprint with:
   1. affected version and environment
   2. severity and first/last occurrence
   3. correlated evidence
   4. reproduction status
   5. current runbook and remediation state
9. encode runbooks as canonical CLI/MCP actions with JSON results
10. record every automated or agent-proposed action in an audit trail

### Autonomy Ladder

1. **Level 0 - observe**: humans inspect logs and dashboards
2. **Level 1 - alert**: synthetics/SLOs notify on actionable symptoms
3. **Level 2 - triage**: agents correlate evidence, deduplicate, and maintain an
   incident or GitHub issue
4. **Level 3 - recommend**: agents select and preview a runbook for approval
5. **Level 4 - bounded heal**: allowlisted reversible runbooks execute
   automatically, then verify or roll back
6. **Level 5 - repair delivery**: agents reproduce defects, create regression
   tests and code changes, open a PR, pass gates, canary, and promote or revert

### 1.0 Autonomy Bar

1. Level 1 and Level 2 work end to end for launch-critical services
2. deterministic provider/platform recovery actions may reach Level 4 only when
   they are reversible, bounded, idempotent, and proven by failure drills
3. code-changing self-healing remains post-1.0 unless the earlier gates make a
   narrow case undeniably safe
4. every autonomous action has:
   1. explicit authority
   2. maximum attempts and cooldown
   3. cost and blast-radius limits
   4. before/after evidence
   5. escalation on failed verification

### Done When

1. a synthetic failure becomes one deduplicated incident with correlated
   evidence
2. the incident reaches the correct notification and GitHub issue policy
3. an agent can diagnose it using only machine surfaces
4. at least one reversible recovery runbook is drilled end to end
5. failed remediation escalates instead of looping
6. alert noise and false-positive behavior have been reviewed during a soak

## Gate 5: Security, Abuse, Privacy, And Supply-Chain Trust

### Objective

Make wider public creation and hosting safe enough to operate unattended.

### Work

1. threat-model public HTTP, realtime, CLI auth, MCP, hosted release, artifact,
   media, moderation, browser-worker, and provider-control surfaces
2. close any public browser-control or privileged worker endpoint that relies
   only on topology luck
3. verify authorization at every hosted release and media ownership boundary
4. verify secrets cannot cross preview, production, logs, artifacts, or agent
   responses
5. verify request, upload, artifact, decompression, execution, storage, and
   concurrency limits
6. define abuse and suspension controls that are available through the operator
   CLI
7. verify moderation failure modes fail safely and do not block unrelated core
   runtime operation
8. run dependency, container, package-provenance, and public-export checks
9. document telemetry privacy behavior and retention in user-facing terms
10. define vulnerability reporting and emergency release procedures
11. enforce fast staged local checks, one pre-push canonicality pass for
    substantial batches, one GitHub-native review for a green merge candidate,
    and exact production deployment evidence

### Done When

1. no unresolved critical/high launch threat remains
2. expensive and privileged surfaces have authentication, authorization,
   throttling, and an operator kill switch
3. preview/production isolation and secret non-disclosure are proven
4. public packages and release artifacts have traceable provenance
5. privacy claims match actual stored data and retention behavior
6. baseline branch-protection proof confirms protected CI applies to
   administrators, the final review lives on the pull request, and deployment
   evidence is machine-auditable

## Gate 6: Public Packages, Documentation, Demo, And Story

### Objective

Make the public experience as coherent as the implementation.

### Package And Installation Proof

1. decide the exact package versions that become 1.0
2. verify public package graphs contain no unpublished workspace dependency
3. define the compatibility and upgrade policy
4. prove install/scaffold on supported operating systems and Node versions
5. prove CLI and MCP installation through only public instructions
6. ensure every machine surface has useful `--help`, stable JSON, actionable
   errors, and version reporting
7. ensure the self-hosted lane works without the hosted Air Jam product where
   the public promise says it does

### Documentation Proof

1. run a built-route crawl with JavaScript-disabled inspection where relevant
2. verify agent discovery through `llms.txt`, docs manifests, search indexes,
   AI-pack manifests, package metadata, and MCP definitions
3. make one quickstart authoritative for humans and agents
4. publish the supported integration matrix and troubleshooting path
5. clearly separate:
   1. framework versus hosted product
   2. self-hosting versus Arcade publishing
   3. approximate product telemetry versus authoritative runtime facts
   4. current 1.0 behavior versus post-1.0 autonomous direction

### Demo And Article

The launch demonstration should show the contract, not only a polished result:

1. external agent starts with a high-level request
2. Air Jam exposes its capabilities through public machine surfaces
3. the agent creates or changes a real multiplayer game
4. the agent controls players and inspects runtime/visual evidence
5. it catches and fixes a defect
6. it publishes and verifies the hosted result

The HN article should explain the architectural lesson:

> Do not trap the model inside another narrow editor. Make the entire framework
> operable by whichever general-purpose agent the developer already uses.

The organic Claude recommendation and first-party agent-discovery telemetry are
supporting evidence, not claims of product-market fit.

### Done When

1. a clean public install succeeds without local substitutions
2. the release candidate and package graph pass the release doctor
3. docs and agent resources are complete and crawlable
4. the demo is reproducible rather than selectively edited proof
5. every article/product claim links to shipped behavior
6. the discoverability plan has one concrete launch sequence with final assets

## Gate 7: Release Rehearsal, Go/No-Go, And Launch

### Objective

Prove one exact candidate can be released, observed, and recovered before public
traffic arrives.

### Rehearsal

1. cut an immutable release candidate from one exact commit
2. run all clean-checkout quality and release gates
3. run the five-game manual launch-set proof
4. run the complete external-agent golden path
5. publish the candidate packages to the prerelease channel
6. deploy the candidate through the production topology
7. run live platform, realtime, Arcade, hosted-release, semantic-session,
   telemetry, and agent-resource smoke tests
8. exercise rollback, queue pause, and at least one dependency-degradation path
9. verify dashboards, synthetics, alerts, incident correlation, and operator CLI
10. freeze article/demo screenshots, commands, versions, and links against that
    candidate

### Go/No-Go

Release only when:

1. Gates 0 through 6 have recorded evidence
2. no unresolved correctness, data-loss, security, install, or public-contract
   blocker remains
3. production is healthy on the exact release commit
4. rollback and restore paths have been exercised recently
5. traffic/cost controls are enabled
6. launch monitoring and escalation ownership are explicit
7. article, repository, docs, packages, demo, and hosted product describe the
   same reality

### Launch Sequence

1. publish final packages and immutable release notes
2. deploy and verify production
3. publish the launch article and demonstration
4. submit to HN and execute the subordinate distribution checklist
5. monitor product, runtime, incident, cost, and provider health separately
6. record launch outcomes without interpreting approximate visits as durable
   user identity
7. open post-1.0 work only after the launch system has stabilized

## Explicit 1.0 Cuts

These do not block 1.0 unless an earlier gate produces evidence that one is
required for correctness or truthful positioning:

1. a mandatory hosted AI editor
2. complete Level 5 code-changing self-healing
3. integrations with every coding agent and MCP host
4. million-user or multi-region active-active scale
5. speculative distributed-screen and remote-room expansion
6. broad game-specific polish beyond launch trust and correctness
7. generalized abstractions without two or more proven consumers
8. major post-v1 service extraction that does not reduce a measured launch risk
9. a consumer premium-game or Arcade subscription before catalog demand is
   proven
10. creator reward pools before realized revenue, sponsor funding, abuse
    controls, and unit economics exist

## Remaining Launch Decisions

Gate 0 product and operating policy is ratified. The remaining choices belong
to later evidence gates and cannot redefine that contract implicitly:

1. primary golden-path game/demo scenario
2. final HN title and launch timing

## Execution Order

The subordinate
[1.0 release execution plan](./v1-release-execution-plan.md) and canonical
`readiness` CLI translate this order into dependency-aware work packages. They
may track ownership, blockers, estimates, and evidence, but they may not
redefine these gates or the 1.0 promise.

1. keep the ratified Gate 0 contract frozen unless an explicit maintainer
   decision reopens it
2. perform the Gate 1 audit and central canonicalization work
3. once boundaries are stable, parallelize independent cleanup, golden-path,
   reliability, security, and documentation slices
4. integrate through one central validation pass
5. close Gates 2 through 6 with retained evidence
6. run Gate 7 from one immutable candidate
7. archive this plan only after the launch outcome and immediate stabilization
   are recorded in `docs/current-state.md` and `docs/work-ledger.md`

The exact Gate 2 scenario and evidence boundary are canonicalized in the
[external-agent golden-path contract](../contracts/external-agent-golden-path-contract.md)
and its repo-validated machine manifest. The roadmap owns the release promise;
that contract owns how the external-agent claim is tested.

## Immediate Next Actions

1. close public-only install and bootstrap blockers against the canonical
   external-agent golden path
2. run and retain the Codex full-lifecycle proof, then independently certify
   Claude Desktop discovery/session bootstrap
3. inventory the current production observability, alerting, recovery, and
   security controls against Gates 3 through 5
4. convert only the discovered release gaps into implementation work

## Completion Rule

Air Jam 1.0 is complete only when the public promise is proven from a clean
environment, the production system has a tested safe-failure envelope, and the
launch story describes the exact system that shipped.

Finishing a feature list, publishing packages, or posting the article without
those proofs does not close this roadmap.

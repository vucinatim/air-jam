# Air Jam Codebase Assessment After The 1.0 Audit

Last updated: 2026-08-28
Status: durable audit assessment
Readiness context: `G1-01` and `G1-03`

Related evidence:

1. [Canonicalization audit](./v1-canonicalization-audit.md)
2. [Implemented system map](./system-map.md)
3. [Decision register](./decision-register.md)
4. [Canonicalization execution set](./canonicalization-execution-set.md)

## Overall Judgment

Air Jam is not a fundamentally confused codebase and should not be rewritten.

It is an ambitious system that discovered several strong product and
architecture ideas, then accumulated adjacent implementations and incomplete
adapters while those ideas crystallized. The core product theory is stronger
than the current integration boundaries.

The dominant weakness is not low-quality code everywhere. It is unclear or
duplicated ownership at subsystem boundaries:

1. project CLI versus scaffolder versus server
2. SDK stable root versus internal/experimental leaves
3. UI, HTTP, CLI, and MCP application workflows
4. synchronous requests or MCP process memory versus durable platform jobs
5. canonical agent guidance versus repeated docs, skills, and client notes
6. platform migrations and operator UI versus machine-operable production paths

Inside many subsystems, the design is thoughtful. Between subsystems, the same
fact or lifecycle sometimes has multiple owners.

## Strongest Points

### Runtime model

The host-authoritative model and separation between high-frequency input,
replicated state, and signals are coherent. These are real architectural
boundaries rather than naming alone.

`createAirJamApp`, `createAirJamStore`, shared protocol schemas, explicit
runtime topology, and game-owned semantic contracts form a credible framework
foundation.

### Agent-first foundation

Semantic game sessions, machine-readable runtime inspection, unified logs,
typed actions, and browser-as-visual-proof are the right primitives. They
support external Codex, Claude, terminal, and future clients without requiring
a hosted IDE to own the development model.

The theory that the development harness can live in the framework and external
agent environment is supported by the implemented architecture.

### Test and evidence culture

The repository has substantive protocol, integration, security, scaffold,
generated-content, packaging, and readiness tests. The machine execution
manifest and typed completion evidence are unusually strong foundations for
future autonomous operation.

### Deterministic product sources

First-party game workspaces are the editable scaffold authority, and generated
archives have parity checks. Platform telemetry also has explicit ledger,
projection, privacy, repair, and retention ownership that should be preserved
rather than simplified away.

## Weakest Points

### Consumer-facing last mile

Internal agent tooling is ahead of the clean external experience. Fresh
scaffolds document an `airjam` command they do not install, terminal output is
not consistently machine-stable, client MCP installation is ambiguous, and
real games do not yet prove their semantic contracts through conformance tests.

The next tooling work should close this path before adding more agent controls.

### Production lifecycle ownership

Expensive release work, static delivery, cleanup, migrations, abuse operations,
and recovery are not yet consistently represented as durable, inspectable,
bounded machine operations. This is the largest difference between a
sophisticated project and a product that can safely absorb launch traffic while
the maintainer sleeps.

### Duplicate and obsolete seams

Runtime topology, project-runtime orchestration, environment validation,
visual-harness control, SDK composition, platform workflows, and schema
declarations all contain some form of duplicate or accidental authority.

These should be purged rather than wrapped in compatibility layers.

### Agent guidance volume and ownership

The generated agent pack is valuable but over-distributed. Repeated rules across
`AGENTS.md`, client notes, guides, generated docs, and skills increase context
cost and drift risk. Managed updates also overlap natural user-customization
surfaces.

The right target is not “no skills.” It is:

1. a short stable project router
2. one canonical normal development loop
3. versioned managed references
4. user-owned project instructions and custom skills
5. specialized skills only where conditional loading adds real value

## Architectural Opinion

The project should keep the following direction:

```text
one domain/application capability
              |
              v
      shared typed service
       /      |      |      \
     CLI     MCP    API      UI
```

Agent-first does not require a bespoke agent layer for each feature. Private
operator automation also does not need to expand the public creator MCP server.

The repository should not build distributed room infrastructure merely because
horizontal scaling is theoretically attractive. An enforced, measured,
alerted, and safely drained single realtime replica is a valid 1.0 architecture.
Distributed room authority should be introduced only when measured capacity
requires it.

The project should also avoid a universal command bus, mega-schema, generic
orchestrator, or hosted Studio implementation that duplicates what external
agents already provide.

## Reduction Before Expansion

Gate 1 is a reduction and crystallization phase. It should not contain new
user-facing product capabilities.

Permitted additions during canonicalization are limited to:

1. the smallest replacement seam required to delete duplicate owners
2. tests and contract checks that prove the retained path
3. documentation changes that name the one remaining path
4. machine evidence needed to operate and validate the refactor

After Gate 1 closes from a clean checkout, the program may begin security,
reliability, operational, golden-path, and public-experience improvements on top
of the stable architecture.

This sequencing makes the codebase easier to evaluate: first reduce and
canonicalize, then harden, then add or polish product capability.

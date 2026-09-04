# Agent Operating Ecosystem Strategy

Last updated: 2026-09-04
Status: guiding operating strategy

Related sources:

1. [Air Jam Vision](../vision.md)
2. [Working Agreements](../working-agreements.md)
3. [Agent And Tooling Architecture](../architecture/agent-tooling-architecture.md)
4. [Operational Reliability Contract](../contracts/operational-reliability-contract.md)
5. [Production Control Contract](../contracts/production-control-contract.md)
6. [Air Jam 1.0 Release Roadmap](../plans/v1-release-roadmap-plan.md)
7. [Air Jam 1.0 Release Execution Plan](../plans/v1-release-execution-plan.md)

## Purpose

Air Jam should become a product that capable agents can continuously understand,
operate, improve, and eventually heal across the local repository, GitHub, and
Railway.

The goal is not to build a rigid autonomous-operations product inside Air Jam.
The goal is to make the real product legible and operable enough that smart
general-purpose agents can use their own judgment safely.

This document defines that ecosystem, the minimum 1.0 substrate, the intended
long-term loops, and the tests for deciding when another mechanism is actually
needed. It does not replace the 1.0 readiness manifest or create a second work
tracker.

## Core Position

The agent is the reasoning engine. Air Jam supplies:

1. trustworthy senses
2. durable shared memory
3. focused machine-operable actions
4. explicit effect authority
5. independent proof of outcomes

The architecture should increase an agent's context and agency without encoding
its full reasoning process in workflows, state machines, or prompt-shaped domain
objects.

The intended long-term system is therefore:

```text
native signals + Air Jam truth
              |
              v
     one or more smart agents
       /        |         \
  local repo  GitHub    Railway
       \        |         /
        reviewed, bounded effects
              |
              v
    independent verification
```

The loop may begin from a periodic `/loop`, a GitHub event, a Railway event, an
Air Jam alert, or a maintainer prompt. Entry mechanism does not change the
authority of the action an agent may eventually take.

## Design Principles

### Preserve intelligence

Agents must be free to:

1. choose which evidence is relevant
2. form and revise hypotheses
3. select tools in the order the situation needs
4. collaborate or split work when the problem is genuinely separable
5. decide whether the right response is observation, rollback, configuration,
   documentation, code, or escalation

Contracts define truth and effects. They do not prescribe a universal diagnosis
script.

### Constrain effects, not thought

Read access should be broad, fast, structured, and redacted. Production effects
become more explicit as blast radius grows:

| Effect class                 | Examples                                                                                             | Required boundary                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Observe                      | health, logs, alerts, deploys, costs, tests                                                          | authenticated read plus redaction where needed                                                 |
| Build and prove              | branch edits, tests, isolated staging, pull request                                                  | normal branch and review boundary                                                              |
| Reversible production action | pause a queue, retry one job, restart or roll back one exact deployment                              | exact target, bounded scope, idempotency where applicable, verification, stop or rollback path |
| Material authority           | publish packages, promote production code, delete data, change secrets or auth policy, raise budgets | explicit maintainer approval and durable evidence                                              |

An urgent incident may shorten waiting time. It does not weaken artifact,
review, identity, or verification requirements.

### Keep native authorities native

1. Air Jam owns application, runtime, release, alert, and operational state.
2. Railway owns deployment, service, environment, metrics, and provider state.
3. GitHub owns source history, checks, reviews, pull requests, and shared issue
   discussion.
4. The readiness manifest owns 1.0 dependencies, claims, blockers, and evidence.
5. The local checkout owns current implementation and reproducible validation.

Do not copy every provider fact into an Air Jam database. Normalize the small
identity spine needed to move between authorities, and retain links to the
authoritative source.

### Prefer a tool shelf over a workflow language

The ecosystem should expose focused commands for real nouns and effects:

1. inspect an alert or synthetic run
2. inspect an exact deployment and its logs
3. pause or inspect an expensive lane
4. replay one exact job
5. verify or roll back one exact deployment
6. inspect readiness and claim dependency-ready work
7. build, review, and deliver a pull request

A generic remediation DSL, arbitrary command executor, centralized runbook
engine, or dedicated swarm scheduler is not a prerequisite. Add one only after
multiple observed workflows need the same missing invariant.

## The Six Layers

### 1. Sensors

Agents need both user-visible symptoms and authoritative internal state.

The sensor layer includes:

1. public health and readiness
2. launch-critical synthetics and SLOs
3. durable structured errors and operational events
4. queues, jobs, quotas, admission, and lifecycle state
5. product telemetry kept separate from correctness authority
6. exact Railway deployments, logs, metrics, variables, and domains
7. GitHub checks, reviews, merge state, and deployment statuses
8. local unified logs, tests, browser visuals, and semantic game-session state
9. provider and Air Jam cost evidence

A sensor is complete when an agent can discover it, query it without UI
scraping, understand freshness and authority, and correlate it to the relevant
environment, release, deployment, room, job, or commit.

### 2. Orientation

A cold-start agent should be able to answer these questions quickly:

1. Which environment and revision am I looking at?
2. What is unhealthy, degraded, stale, or unknown?
3. Which source owns that conclusion?
4. What changed immediately before the symptom?
5. Is another agent or pull request already handling it?
6. Which safe inspection and recovery actions exist?
7. Which action requires maintainer authority?

For 1.0, existing repo CLI commands, GitHub issues, and provider reads may answer
those questions independently. If repeated investigations show that discovery
cost is still high, add one thin `operator briefing` read model that links those
sources. It must not become a second monitoring database or manufacture a
single health verdict from incomparable evidence.

### 3. Durable shared memory

Use the smallest existing durable surface for each kind of memory:

1. GitHub issue: an actionable operational alert and cross-agent discussion
2. pull request: a proposed code change, validation, and review history
3. readiness manifest: release-program claim, dependency, blocker, and proof
4. Air Jam database: application-owned events, jobs, alerts, and action audits
5. immutable evidence artifact: exact command, digest, deployment, restore,
   release, or load-test proof
6. docs: stable contracts, strategy, architecture, and historical conclusions

Chat transcripts and local agent context are useful working memory but are not
the only retained authority for a material decision or completed proof.

### 4. Hands

An operational capability should expose a complete, focused machine lifecycle:

1. discover through `--help`, a schema, or an MCP contract
2. inspect status and exact target identity
3. preview only when preview materially reduces risk
4. apply through the same domain service used by other clients
5. wait for a terminal result when work is asynchronous
6. verify independently from the mutation acknowledgement
7. stop, roll back, or emit an escalation bundle when verification fails

Stable JSON belongs on reads. Destructive or costly writes stay explicit but
automatable. UI adapters remain optional thin clients of the same services.

### 5. Agents and collaboration

Agent roles are useful prompts and ownership boundaries, not permanent services.
A loop may use one agent for a small incident or several for disjoint work:

1. watcher notices a meaningful state change
2. investigator correlates current evidence and attempts reproduction
3. recovery operator considers an existing bounded production action
4. builder implements a durable code or configuration correction
5. verifier independently tests the claimed outcome
6. release operator moves a reviewed exact artifact through staging and
   production authority

One agent may perform several roles. Separate agents are valuable when work can
proceed independently or verification benefits from fresh context. They should
claim visible ownership before acting and use idempotency or revision fences
where effects could collide.

Do not require a fixed number of agents, a fixed role graph, or a central planner
for every event.

### 6. Effect governance

Every production-capable tool should make the following available when relevant:

1. authority and actor
2. exact environment and resource target
3. proposed effect and maximum blast radius
4. idempotency or concurrency identity
5. cost or quota consequence
6. terminal result
7. independent verification
8. rollback, stop, or escalation path

This information belongs in domain contracts and audit evidence, not only in an
agent prompt. The agent remains free to decide whether the action is correct.

## Canonical Operating Loops

### Runtime or product failure

```text
synthetic/runtime signal
  -> durable alert
  -> one maintained GitHub issue when actionable
  -> agent inspects Air Jam + Railway + recent code
  -> agent reproduces or classifies
  -> bounded recovery, code PR, or escalation
  -> independent live verification
  -> alert recovery and issue closure
```

The issue is coordination memory, not health authority. Recovery closes from
fresh Air Jam and provider evidence.

### Failed deployment

```text
provider terminal failure or readiness mismatch
  -> exact deployment evidence
  -> agent compares previous known-good and current revision
  -> fix-forward PR or exact rollback decision
  -> terminal provider success
  -> public liveness/readiness/revision verification
```

A queued deployment or an older still-serving deployment is not success.

### Cost or capacity pressure

```text
provider usage + Air Jam meter
  -> budget/admission decision
  -> agent identifies growing lane
  -> optional work is bounded before active gameplay
  -> forecast and current effect are recorded
  -> maintainer approves any budget increase
```

Product telemetry may help explain demand, but it cannot authorize spending or
correctness-critical degradation.

### Code regression

```text
CI, review, or reproducible production evidence
  -> issue or active PR context
  -> focused local edit
  -> fast changed checks
  -> substantial-batch Canonicalizer when justified
  -> green hosted checks
  -> one GitHub-native Opus review at merge readiness
  -> normal merge and deployment verification
```

The automated code-review system owns code confidence. The maintainer reviews
direction, product behavior, paradigm, polish, and material risk.

### Product improvement

```text
telemetry, feedback, issue, or agent observation
  -> evidence-backed opportunity
  -> roadmap/readiness claim only if it belongs to active 1.0 scope
  -> implementation and evaluation loop
  -> reviewed PR
  -> measured user outcome
```

Do not automatically convert every metric movement or user comment into an
issue. An agent should first decide whether the evidence is actionable.

### Release lifecycle

```text
readiness dependency closes
  -> exact candidate built once
  -> identical bytes validated
  -> prerelease/staging rehearsal
  -> review and explicit publication authority
  -> identical artifact promotion
  -> production and public verification
  -> stabilization observation
```

Emergency release follows the same identity, review, artifact, and verification
contracts. It skips unrelated scheduling and ceremony, not safety.

## The 1.0 Boundary

Air Jam 1.0 needs the substrate for smart operations, not complete autonomous
product management.

### Required for 1.0

1. launch-critical structured events, synthetics, SLOs, and durable alerts
2. one deduplicated GitHub issue projection for actionable alerts
3. agent-readable Air Jam, GitHub, Railway, cost, readiness, and local evidence
4. focused CLI/MCP operations for existing supported lifecycles
5. safe exact rollback, restore, replay, pause, and maintenance paths where the
   current product owns them
6. activation, retention, capacity, degradation, security, privacy, and
   supply-chain proof from the canonical 1.0 roadmap
7. reviewed exact-artifact delivery and terminal production verification
8. one cold-start proof that an agent can diagnose from durable evidence without
   private maintainer knowledge

### Explicitly not required for 1.0

1. an always-running general-purpose coding agent hosted by Air Jam
2. autonomous production code promotion
3. a generic incident-management product
4. a generic runbook or remediation language
5. a central multi-agent scheduler or swarm database
6. universal ingestion of Railway and GitHub data into Air Jam
7. automatic issues for every warning, log, or product metric
8. a control-room UI duplicating the machine surfaces

## Evolution After 1.0

Grow autonomy from observed operational evidence:

### Stage A: assisted observation

Periodic or event-triggered agents read current signals, maintain actionable
issues, diagnose, and recommend. Humans still authorize material effects.

### Stage B: bounded recovery

Allow automatic execution only for individually proven reversible actions such
as a narrowly targeted retry, pause, restart, or rollback. Each action verifies
itself and stops or escalates on uncertainty.

### Stage C: autonomous repair delivery

Agents reproduce recurring defects, add regression tests, produce reviewed pull
requests, and validate previews. Production promotion remains independently
governed until repeated evidence justifies a narrower automatic lane.

### Stage D: earned orchestration

Add coordination infrastructure only if real concurrent agents repeatedly need
something GitHub, readiness claims, database leases, and provider identities
cannot express. Candidate needs include event wakeups, work leasing, dependency
scheduling, or verification assignment. Implement the smallest missing
primitive, not an all-purpose agent platform.

## Tests For New Complexity

Before adding another queue, state machine, daemon, scheduler, adapter, schema,
or provider mirror, answer:

1. Which concrete failure or repeated workflow does it solve?
2. Which authority or invariant cannot remain in an existing system?
3. Are there already two real consumers?
4. Can a focused CLI action or evidence link solve it more simply?
5. What old path disappears when the new path lands?
6. How will an agent inspect and verify it?
7. How does it fail without constraining healthy product UX?

If those answers are weak, retain the idea as strategy or a durable suggestion.
Do not implement it yet.

## Success Test

This strategy is working when:

1. a capable agent can enter with no private context and orient quickly
2. the agent can distinguish symptoms, authority, stale evidence, and unknowns
3. it can use local, GitHub, Railway, and Air Jam surfaces without UI-only gaps
4. multiple agents can collaborate without duplicating a production effect
5. common failures become faster and more boring to diagnose and recover
6. stronger future models improve outcomes without requiring a control-plane
   rewrite
7. Air Jam stays small enough that one maintainer is not maintaining an
   autonomous-operations platform beside the actual product

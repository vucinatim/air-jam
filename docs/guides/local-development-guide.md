# Local Development Guide

Last updated: 2026-05-08  
Status: current guide

Related docs:

1. [../framework-paradigm.md](../framework-paradigm.md)
2. [../contracts/runtime-topology-contract.md](../contracts/runtime-topology-contract.md)
3. [../architecture/agent-tooling-architecture.md](../architecture/agent-tooling-architecture.md)
4. [../working-agreements.md](../working-agreements.md)

## Purpose

This guide explains the intended local development and validation loop for Air
Jam projects and maintainers.

## Canonical Front Door

For normal local Air Jam work, use:

```bash
pnpm run dev
```

This is the standard front door.

Do not treat preview-only flows or raw lower-level commands as the normal
starting point unless the task explicitly needs them.

## What The Normal Loop Looks Like

1. run `pnpm run dev`
2. open the host preview
3. use visible preview controllers for UI smoke proof
4. use semantic session tooling for reliable gameplay proof
5. inspect logs or topology when behavior is unclear
6. reset local state when the runtime gets weird

## First Commands To Reach For

```bash
pnpm run dev
pnpm run status
pnpm run reset:local
pnpm exec air-jam-server logs --view=signal
```

## Preferred Proof Split

### Browser Proof

Use the browser for:

1. visible controller and host UI checks
2. click-through validation
3. layout and rendering proof

### Semantic Proof

Use semantic session tooling for:

1. gameplay assertions
2. repeated match flow validation
3. reliable state checks
4. deterministic action invocation

## When To Inspect Topology

Use topology inspection when:

1. a host or controller URL looks wrong
2. a local mode is resolving the wrong backend
3. Arcade and standalone assumptions diverge
4. preview or hosted behavior feels mixed with local behavior

## Debugging Rule

When behavior is unclear, inspect the unified log stream before adding random
temporary logging.

The preferred first read is:

```bash
pnpm exec air-jam-server logs --view=signal
```

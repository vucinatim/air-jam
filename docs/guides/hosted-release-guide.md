# Hosted Release Guide

Last updated: 2026-05-08  
Status: current guide

Related docs:

1. [../architecture/hosted-release-pipeline-architecture.md](../architecture/hosted-release-pipeline-architecture.md)
2. [../architecture/platform-control-plane-architecture.md](../architecture/platform-control-plane-architecture.md)
3. [../capability-inventory.md](../capability-inventory.md)

## Purpose

This guide explains the intended happy path for producing and publishing a
hosted release.

## Happy Path

1. run local release doctor checks
2. validate the hosted release contract
3. bundle the release artifact
4. authenticate the machine workflow
5. submit the release draft
6. inspect status until checks complete
7. publish when the release is ready

## Canonical Local Commands

```bash
pnpm exec airjam release doctor
pnpm exec airjam release validate
pnpm exec airjam release bundle
```

## Canonical Hosted Operations

The machine release flow should support:

1. submit
2. inspect
3. publish
4. list

Those operations exist across CLI and MCP because the release pipeline is a
control-plane workflow, not just a local script.

## Failure Rule

Do not treat "artifact uploaded somewhere" as success.

A hosted release is only valid when:

1. the platform has a release record
2. the artifact is finalized
3. trusted checks have completed
4. the release state is explicitly publishable

## Design Rule

If a workflow bypasses release state, trusted checks, or hosted authority, it
is outside the intended Air Jam hosted release model.

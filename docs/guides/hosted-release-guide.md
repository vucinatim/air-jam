# Hosted Release Guide

Last updated: 2026-08-30
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
2. upload an exact immutable generation
3. finalize an exact immutable generation
4. inspect
5. publish
6. list

Those operations exist across CLI and MCP because the release pipeline is a
control-plane workflow, not just a local script.

## Failure Rule

Do not treat "artifact uploaded somewhere" as success.

A hosted release is only valid when:

1. the platform has a release record
2. the returned immutable generation is finalized
3. that exact generation remains the release candidate through validation
4. trusted checks for that generation have completed
5. the generation is explicitly promoted and the release is publishable

## Design Rule

If a workflow bypasses release state, trusted checks, or hosted authority, it
is outside the intended Air Jam hosted release model.

Retrying a submission creates a new generation. Tools must preserve the
generation ID returned with the upload target and must never reconstruct,
guess, or substitute another generation when finalizing. The CLI and MCP
submission workflows own this automatically.

If an all-in-one submission is interrupted after the draft exists, resume it
through the explicit machine boundary:

```bash
pnpm exec airjam release upload --release <release-id> --bundle <bundle.zip>
pnpm exec airjam release finalize --release <release-id> --generation <generation-id>
pnpm exec airjam release inspect --release <release-id>
```

The upload result prints the exact finalize command. MCP clients use the same
contract through `airjam.release_upload`, `airjam.release_finalize`, and
`airjam.release_inspect`.

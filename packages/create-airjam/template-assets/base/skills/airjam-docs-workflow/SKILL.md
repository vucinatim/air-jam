---
name: airjam-docs-workflow
description: Use when an Air Jam task needs canonical guidance and you need to know which local docs to read, when hosted docs are appropriate, and how to avoid reading the whole docs tree unnecessarily.
---

# Air Jam Docs Workflow

Use this skill when a task touches framework contracts, architecture, canonical patterns, or repo workflow rules.

## Read First

1. `docs/docs-index.md`
2. the smallest local docs page that matches the task

## Default Rule

Use local docs first.

Use hosted Air Jam docs only when:

1. the local docs pack does not cover the topic
2. you need broader framework detail
3. you need newer canonical public guidance
4. the task is explicitly about syncing or updating docs

## Local Docs Triggers

Read local docs when:

1. creating a new gameplay system
2. changing state ownership
3. building controller UI
4. changing rendering patterns
5. updating tests or debug structure
6. deciding where code should live

## Anti-Patterns

1. reading the entire docs tree for a small task
2. skipping local docs and jumping straight to remote sources
3. treating hosted docs as the only source of truth for a scaffolded project

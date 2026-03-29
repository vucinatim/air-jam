# Air Jam Release-Facing Polish Plan

Last updated: 2026-03-29  
Status: active

Related docs:

1. [V1 Closeout Plan](./v1-closeout-plan.md)
2. [Release Prep Plan](./release-prep-plan.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Monorepo Operating System](../monorepo-operating-system.md)
5. [Docs Index](../docs-index.md)

## Purpose

This plan captures the remaining release-facing polish work that still matters, without keeping separate broad plans for landing-page direction, docs hardening, and reference-app surface cleanup.

The goal is not to reopen architecture.

The goal is:

1. improve first-contact credibility
2. tighten the public product surfaces
3. keep reference experiences polished enough for release
4. avoid scattering “last 10%” work across too many active files

## Scope

This plan is for:

1. landing page clarity and presentation
2. public docs polish that improves release readiness
3. reference-app and template polish that improves perceived quality

This plan is not for:

1. release workflow and CI hardening
2. legacy game migration execution
3. major architecture refactors
4. another docs-system restructure

## Current Baseline

Already true:

1. the framework story is much clearer than it was
2. the docs system is canonical and stable
3. the Pong template is materially stronger in structure, testing, and controller/host UX
4. the landing page already has a clear visual identity

The remaining work is mostly surface polish and clarity, not foundational architecture.

## Workstreams

## 1. Landing Page Tightening

Goal:

1. make the homepage feel like one intentional product surface instead of a strong hero plus generic sections

Remaining:

1. simplify the story around the actual creation-to-play loop
2. keep the builder path stronger than the “toy/demo” read
3. use real proof surfaces rather than generic feature-card language
4. tighten route/component boundaries if the current implementation still mixes concerns awkwardly

Done when:

1. the page feels cohesive below the hero
2. the primary CTA hierarchy is builder-first
3. the product feels credible without overexplaining

## 2. Public Docs Release Polish

Goal:

1. make the public docs set feel release-ready without reopening the docs architecture

Remaining:

1. keep rendered-docs validation lightweight but reliable
2. tighten metadata consistency where it materially helps release trust
3. keep contributor-facing docs guidance aligned with the canonical content model
4. do only retrieval/index polish that clearly improves usefulness

Done when:

1. the docs system feels stable rather than transitional
2. metadata and search quality are good enough for public use
3. no contributor-facing docs imply an older docs structure

## 3. Reference Experience Polish

Goal:

1. make the shipped examples feel intentional enough to represent Air Jam well in a v1 release

Remaining:

1. continue small Pong quality passes only where they improve release credibility
2. keep host/controller surfaces game-like rather than dashboard-like
3. make sure `air-capture` and `pong` still feel like real proof, not just technical demos
4. avoid reopening clean architecture boundaries just to chase cosmetic churn

Done when:

1. `pong` and `air-capture` both feel good enough to show publicly
2. no obvious UX rough edge undercuts the framework’s first impression
3. remaining nits can safely move to `docs/suggestions.md`

## Working Rule

This plan should stay small and practical.

If a polish item becomes:

1. release-critical infrastructure work, move it into [Release Prep Plan](./release-prep-plan.md)
2. migration proof work, move it into [V1 Closeout Plan](./v1-closeout-plan.md)
3. a future nice-to-have, move it into `docs/suggestions.md`

## Closeout Rule

When the remaining polish is either done or clearly non-blocking:

1. move residual nice-to-haves to `docs/suggestions.md`
2. archive this plan

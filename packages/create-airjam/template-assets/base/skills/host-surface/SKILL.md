---
name: host-surface
description: Use when building or reviewing the Air Jam host shell so the active game surface stays full-frame, overlays stay modular, and host UI does not interfere with gameplay layout.
---

# Host Surface

Use this skill for host presentation, overlays, room chrome, and game viewport composition.

## Read First

1. `docs/generated/host-system.md`
2. `docs/generated/project-structure.md`
3. `docs/generated/controller-ui.md` only if the host and controller should mirror a shared visual language

## Surface Rules

1. the active game surface should fill an absolute `inset-0` root
2. avoid wrappers that constrain, crop, or offset the play surface accidentally
3. keep host chrome outside the gameplay coordinate space where possible
4. keep overlays layered above the game surface, not embedded into gameplay components

## Composition Rules

1. separate room bootstrap, shell, gameplay viewport, and overlays into distinct modules
2. keep host-only orchestration in `src/host/`
3. keep gameplay state and rendering concerns in `src/game/`
4. prefer reusable overlay modules over inline one-off markup

## Layout Rules

1. avoid overflow bugs on the main host surface
2. prefer fluid sizing over fixed panel widths and heights
3. keep QR, room, pause, and status UI visually secondary to the active game
4. keep readable safe margins for overlays without shrinking the gameplay surface unnecessarily

## Anti-Patterns

1. gameplay rendered inside a card, panel, or centered content column
2. host shell state mixed directly into gameplay components
3. overlay UI positioned by guesswork inside the game scene
4. host layout choices that make the game viewport smaller than necessary

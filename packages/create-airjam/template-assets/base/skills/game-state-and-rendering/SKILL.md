---
name: game-state-and-rendering
description: Use when changing stores, per-frame gameplay logic, React state, refs, or rendering integration in an Air Jam project so state ownership stays clear and rerenders stay controlled.
---

# Game State And Rendering

Use this skill when a task touches state ownership, per-frame updates, or rendering hot paths.

## Read First

1. `docs/generated/state-and-rendering.md`
2. `docs/generated/input-system.md`
3. `docs/generated/networked-state.md`

## Core Rules

1. keep input in the input lane
2. keep authoritative shared truth in replicated state
3. keep coarse UX/system events in signals
4. keep per-frame mutable values out of React state when React rendering is not needed
5. use narrow Zustand selectors

## Decision Guide

Use:

1. replicated state for replayable shared truth
2. local UI state for local view concerns
3. refs for hot mutable runtime values
4. pure domain modules for rules and calculations

## R3F / Three Guidance

1. avoid per-frame React rerenders
2. mutate refs in frame handlers when appropriate
3. keep scene integration separate from domain decisions

## Anti-Patterns

1. using store actions for high-frequency input
2. using React state as the simulation engine
3. selecting whole stores throughout the tree
4. mixing debug state into hot loops

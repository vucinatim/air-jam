# Game UI Scaling Plan

Last updated: 2026-04-15  
Status: archived

Archive reason: the chosen full-bleed fluid scaling model is implemented. `SurfaceViewport` uses full-bleed surface semantics and publishes `--airjam-ui-scale` into Tailwind's theme variables, and the launch set plus scaffold sources consume that shared model. Any residual styling fallout belongs inside [Final Prerelease Hardening And Cleanup Plan](../plans/final-prerelease-hardening-and-cleanup-plan.md).

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Stage 3 Polish Plan (Archived)](./stage-3-polish-plan-2026-04-15.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Platform Controller Presentation](../systems/platform-controller-presentation.md)
5. [Controller Preview Workspace Plan (Archived)](./controller-preview-workspace-plan-2026-04-14.md)

## Purpose

Add a shared SDK-owned surface-scaling primitive so host and controller UIs feel like game UIs while still filling the screen like modern web apps.

The important clarification is:

1. the target is **not** a centered fixed stage with black bars
2. the target **is** a full-bleed surface with fluid layout and proportional UI scaling

This plan exists because the current surface model is wrong in two different ways:

1. most host and controller screens still behave like ordinary responsive websites
2. the first attempted fix over-corrected into strict contained stage scaling with visible letterboxing

Neither of those is the desired product behavior.

## Product Definition

The correct behavior is:

1. the game surface should still fill the available screen
2. the UI should scale proportionally as the screen gets smaller or larger
3. the composition should stay visually similar across sizes
4. layouts should still remain fluid enough to use the whole surface
5. the default path should work with normal Tailwind authoring

This means:

1. smaller screens should get smaller buttons, spacing, and type
2. larger screens should get larger buttons, spacing, and type
3. we should reduce overlap and wrapping pressure without introducing black bars

## Rejected Model

The previously attempted model is explicitly rejected:

1. fixed authored rectangle
2. one transform `scale(...)`
3. centered `contain` fit
4. letterboxing as the normal outcome

Why it is wrong for Air Jam:

1. it produces black bars on many real viewport shapes
2. it makes the UI feel boxed in instead of native to the full screen
3. it behaves more like a slideshow or emulator stage than a polished game UI shell
4. it creates unnecessary positioning friction for overlays and host chrome

This should be purged rather than patched.

## Chosen Model

The new model is:

1. full-bleed surface ownership
2. fluid layout
3. one shared UI scale factor
4. scale applied through scoped surface CSS variables
5. normal Tailwind usage as the default authoring path

This means the SDK should:

1. measure the available safe viewport in CSS pixels
2. derive a scale factor from a reference surface size
3. expose that scale to the surface through CSS variables
4. publish that scale into Tailwind's own sizing/theme variables inside the surface scope
5. let the surface still fill the screen instead of centering a contained stage

This is the closest fit to:

1. full-screen UI
2. game-like proportional scaling
3. minimal author burden
4. strong LLM compatibility because authors can keep writing standard Tailwind

## CSS Pixels vs DPR

Main layout scaling must be based on CSS pixels, not raw hardware pixels.

Reason:

1. browser layout already happens in CSS pixels
2. using raw device pixels would distort the actual perceived layout size across devices
3. DPR is a rendering sharpness concern, not the primary layout-scaling input

So:

1. `SurfaceViewport` should use CSS viewport measurements
2. DPR remains relevant for canvas/backbuffer sharpness and any visual fine-tuning
3. presets should be based on effective viewport behavior on real devices, not panel spec-sheet resolutions

## Core Principles

### 1. Keep It In The Framework

This should remain an SDK-owned primitive.

Reason:

1. scaling is a cross-game concern
2. templates must inherit it by default
3. game authors should not invent viewport math per project

### 2. Do Not Require A Custom Design System

Game authors should not need to learn Air Jam-specific sizing classes.

Reason:

1. that would be poor DX
2. it would make LLM-generated code worse, not better
3. standard Tailwind usage should remain the normal path

The framework should work well when authors use:

1. ordinary Tailwind spacing utilities
2. ordinary text size utilities
3. ordinary radius and gap utilities

### 3. Do Not Depend On A Full Repo-Wide Unit Rewrite

We should not block on converting the whole repo to `rem`.

Reason:

1. Tailwind already gives us a lot of rem-based behavior by default
2. a giant unit migration would create noise before the actual surface contract is correct
3. the immediate value is in the shared wrapper semantics, not in a total styling rewrite

### 4. Purge The Wrong Implementation Cleanly

We should not keep the current fixed-stage semantics behind compatibility flags.

Reason:

1. prerelease is the right time to replace it fully
2. mixed semantics would make the API confusing
3. this needs one clean meaning, not two competing ones

## Architecture

### Public API

Keep one public wrapper:

1. `SurfaceViewport`

It should own:

1. safe-area awareness
2. orientation handling
3. surface-scale computation
4. root/page-level scale application
5. a small override surface for advanced games

It should **not** own:

1. centered fixed-stage containment
2. default letterboxing
3. transform-scaling of the entire authored rectangle as the primary behavior

### Internal Model

Internally, keep the concerns separated:

1. safe-area/orientation ownership
2. scale computation
3. scoped Tailwind/theme variable application

So the public API stays simple, but the internal seams remain honest.

## API Direction

The default API should stay minimal:

```tsx
<SurfaceViewport preset="controller-phone" orientation="portrait">
  <ControllerScreen />
</SurfaceViewport>
```

Host example:

```tsx
<SurfaceViewport preset="host-standard">
  <HostScreen />
</SurfaceViewport>
```

Advanced override example:

```tsx
<SurfaceViewport
  designWidth={412}
  designHeight={915}
  orientation="portrait"
  uiScaleMultiplier={0.95}
  minScale={0.9}
  maxScale={1.15}
>
  <ControllerScreen />
</SurfaceViewport>
```

But the semantics are now:

1. fill the surface
2. compute `--airjam-ui-scale`
3. apply scaled Tailwind/theme variables inside the surface
4. let layout still use the full available width and height

## Preset Strategy

Presets should still exist, but they now represent reference surfaces for scale calculation rather than fixed contained stage dimensions.

Initial presets:

1. `controller-phone`
2. `host-standard`

Preset rule:

1. names should describe intent, not raw resolutions
2. orientation should stay a separate prop
3. explicit width and height should remain available for advanced cases

## Performance Constraints

This must stay cheap.

Allowed work:

1. measure on mount
2. update on resize, orientation change, and `visualViewport` resize
3. compute one scale value
4. update CSS variables and/or root font size on the surface wrapper

Avoid:

1. polling
2. per-frame layout work
3. large prop-tree propagation
4. per-component JS resize math

## Tailwind Compatibility Rule

The target is:

1. normal Tailwind should mostly work by default

That means:

1. standard spacing, text, gap, padding, and radius utilities should scale well
2. authors should not need custom Air Jam classes just to get surface scaling

What will still need cleanup:

1. arbitrary hardcoded pixel values
2. raw `100vh` / `100vw` hacks
3. fixed canvas clamps tied directly to viewport units
4. layouts that need real breakpoint changes rather than only proportional scaling

So the guidance should be:

1. use normal Tailwind
2. prefer normal scale utilities over arbitrary pixel values when possible
3. use breakpoints for actual layout changes, not for basic proportional scaling

## Implementation Order

### Phase 1. Correct The Surface Contract

1. replace the current contained fixed-stage semantics in `SurfaceViewport`
2. keep safe-area and orientation ownership
3. switch to full-bleed surface semantics with a shared UI scale variable
4. remove all remaining public traces of the rejected stage model

### Phase 2. Migrate Shared Consumers

1. update controller surfaces
2. update host surfaces
3. update scaffold sources
4. regenerate platform/generated docs surfaces as needed

### Phase 3. Clean Up Styling Fallout

1. remove viewport hacks that now fight the new model
2. replace obvious arbitrary pixel traps where they break scaling
3. tune presets and a few critical shells after live testing

## Acceptance Criteria

This track is complete when:

1. no launch-set host or controller relies on the rejected contained-stage behavior
2. no public SDK docs describe `SurfaceViewport` as a letterboxing or fixed-stage wrapper
3. the five launch games and scaffold sources use one shared full-bleed scaling model
4. ordinary Tailwind-heavy UI scales proportionally without black bars
5. orientation and safe areas still work correctly
6. preview controllers still render correctly inside the new model

## Validation

Required validation:

1. SDK tests for scale computation and orientation helpers
2. `pnpm --filter @air-jam/sdk typecheck`
3. affected game typechecks
4. platform generated-prep/typecheck
5. scaffold build/generation
6. live smoke checks on:
   1. controller portrait
   2. host desktop
   3. narrower browser host width
   4. preview controller embedding

## Summary Decision

The right long-term model for Air Jam is:

1. one shared SDK surface wrapper
2. full-screen fluid layout
3. one computed UI scale
4. normal Tailwind authoring as the default
5. no black-bar stage containment as the standard behavior

That is the model this plan now drives.

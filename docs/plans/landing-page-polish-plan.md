# Air Jam Landing Page Polish Plan

Last updated: 2026-03-27
Status: active

Related docs:

1. [Docs Index](../docs-index.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Implementation Plan](../implementation-plan.md)

## Purpose

This plan defines what needs to change for the Air Jam landing page to feel like a professional product surface instead of a promising prototype.

The goal is not to make the page more "marketed."

The goal is to make it:

1. clearer
2. more intentional
3. more credible
4. more visually cohesive
5. more aligned with the actual product

The page should feel modern, sleek, cool, and friendly without becoming generic startup fluff.

## Current Baseline

The current homepage has one strong quality:

1. it already has identity

The retro-futuristic hero scene is memorable and gives Air Jam a distinct mood. That matters. A full redesign should preserve that strength.

The current homepage also has several quality problems:

1. the hero and the rest of the page feel like two different products
2. the page becomes visually generic immediately after the hero
3. the messaging is thin and does not prove the product well
4. the main CTA pushes the arcade/demo angle harder than the builder/platform angle
5. the route mixes marketing, auth entry, and landing concerns in one client component
6. polish is coming from effects and glow rather than from composition, hierarchy, and restraint
7. the page underweights the real product loop: make, join, play, repeat

## Scope

This plan is for:

1. landing page structure
2. messaging hierarchy
3. visual polish and brand consistency
4. hero redesign direction
5. section content strategy
6. landing-page implementation architecture
7. motion, responsiveness, accessibility, and performance expectations

This plan is not for:

1. a full site-wide redesign
2. a docs-system redesign
3. a brand rename or identity reset
4. heavy CMS or content management complexity

## Root Problems To Fix

## 1. Product Story Is Too Thin

The current page states what Air Jam is, but it does not build conviction.

Problems:

1. the current structure relies on generic feature rows
2. the copy describes benefits, but does not show the product in action
3. the page does not yet use the strongest available proof points, especially real games

Impact:

1. the page feels more like a themed placeholder than a mature product surface
2. visitors get mood, but not enough evidence

Required change:

1. restructure the page around proof, not just claims

## 1A. The Page Is Selling Mechanisms More Than The Actual Loop

The current page leans toward describing Air Jam as:

1. multiplayer games with phones as controllers
2. a developer-friendly SDK
3. a no-download join flow

Those are real strengths, but they are not the deepest hook.

The deeper hook is:

1. you can make a game quickly
2. your friends can join instantly
3. the fun payoff happens right away
4. you want to make or try another one

That loop is the product.

Impact:

1. if the page focuses too much on the technical mechanism, Air Jam feels narrower than it really is
2. if the page focuses too much on SDK language, it undersells the emotional payoff and future direction

Required change:

1. make the creation-to-play loop the homepage's main narrative

## 2. Visual Language Breaks After The Hero

The hero scene is custom and atmospheric. The sections below it use repeated icon cards that feel much more standard.

Problems:

1. the page starts with a bold world, then falls back to common SaaS layout patterns
2. the repeated icon blocks do not feel specific to Air Jam
3. the lower sections do not inherit enough of the hero's drama, rhythm, or visual system

Impact:

1. the page feels stitched together instead of designed as one surface
2. the hero loses authority because nothing below supports it

Required change:

1. build a full-page visual system, not just a hero treatment

## 3. The CTA Hierarchy Is Pointing At The Wrong First Action

`Enter Arcade` is a good CTA, but it should not be the only dominant action if the landing page is also meant to sell the platform and SDK.

Problems:

1. the page currently centers the arcade/demo experience more than the builder journey
2. the hero does not clearly tell users where to go if they want to build with Air Jam

Impact:

1. Air Jam can read as a toy, demo, or game portal before it reads as a serious developer platform

Required change:

1. establish a primary builder CTA and a secondary proof/demo CTA

## 4. The Landing Route Has Too Many Jobs

The current homepage route handles:

1. landing-page rendering
2. auth state checks
3. sign-in/sign-up rendering
4. dashboard redirect behavior

Impact:

1. the route is harder to evolve cleanly
2. the homepage cannot stay mostly static and focused
3. design work gets tangled with auth concerns

Required change:

1. separate marketing surface concerns from auth-entry concerns

## 5. Some Polish Decisions Are Effect-Led Instead Of Design-Led

The current page uses glow, blur, and neon shadows aggressively.

Problems:

1. some effects are doing the work that layout and hierarchy should do
2. glow intensity is sometimes louder than the content itself
3. parts of the UI read closer to a prototype aesthetic than a product aesthetic

Impact:

1. the page can feel amateurish even when the ambition is high

Required change:

1. reduce effect noise and increase design discipline

## Product Direction

The right direction is not a generic enterprise landing page.

The right direction is:

1. retro-futuristic, but refined
2. playful, but credible
3. developer-friendly, but not cold
4. stylish, but not visually noisy
5. creation-first, not just controller-first
6. fun-first, without becoming unserious

The page should feel like:

1. a polished game-tech product
2. a real SDK/platform
3. a branded experience with taste

It should not feel like:

1. a crypto page
2. a WebGL experiment with marketing text under it
3. a template-based SaaS site with a custom hero pasted on top

## Product Thesis To Communicate

The homepage should communicate one idea clearly:

Air Jam is a system for turning fast game ideas into immediate social fun.

More explicitly:

1. people can make multiplayer games quickly
2. this is friendly to developers, but not only developers
3. vibe-coding is part of the product identity, not a side note
4. phones-as-controllers are the enabling mechanic, not the whole story
5. the reward is instant play with friends
6. the deeper loop is addictive because creation and payoff are tightly connected

The future vision should also be visible, but lightly:

1. today: a friendly SDK and platform for making and playing these games
2. future: a more lovable-style creation studio that lowers the barrier even further

The page should not depend on future product promises for its credibility.

It should prove that the loop is already real today.

## Emotional Target

The page should create two reactions almost immediately:

1. "This looks fun."
2. "Wait, I could actually make one of these."

If it only creates the first reaction, it reads as a demo.

If it only creates the second reaction, it reads as dry tooling.

The homepage should hold both at once:

1. wonder
2. clarity
3. possibility
4. social payoff

## Required Improvements

## 1. Rebuild The Information Hierarchy

The homepage needs a cleaner narrative order.

Recommended order:

1. hero: what Air Jam is in one sentence, with primary and secondary CTA
2. core loop section: make, join, play, repeat
3. proof section: real games or real multiplayer moments
4. how it works: host screen, QR join, phone controller flow
5. builder proof: real SDK code or creation workflow proof
6. platform proof: docs, dashboard, open-source credibility, supported workflow
7. future direction: lightly signal the studio vision without overpromising
8. final CTA: build or explore

This is stronger than:

1. generic features first
2. abstract copy blocks with icons

## 2. Redesign The Hero Around Authority, Not Just Style

The hero should keep the world-building, but become more product-focused.

What to keep:

1. the retro-futuristic environment
2. the strong cyan/magenta/night palette
3. the sense of motion and atmosphere

What to improve:

1. stronger headline and subheadline hierarchy
2. primary CTA for builders
3. secondary CTA for arcade/demo exploration
4. cleaner relationship between the text block and the 3D scene
5. less reliance on oversized glow treatments
6. clearer suggestion of the creation-to-play loop

The hero needs to answer, immediately:

1. what is Air Jam
2. who it is for
3. what the first useful action is
4. why it feels uniquely fun

## 3. Replace Generic Feature Rows With Product Evidence

The current icon-card rows are serviceable but too generic for a polished product page.

Replace them with sections that show real proof:

1. a real game showcase using the three refactored games
2. a real join flow explanation with host and controller surfaces
3. a real SDK snippet showing how little code it takes to get started
4. a real product capability summary tied to actual surfaces like docs, dashboard, and arcade

The page should show the product instead of describing it from a distance.

## 4. Use The Games As The Main Proof Layer

The games are likely the strongest trust-building asset available.

Required direction:

1. feature the current games as deliberate product examples
2. show that Air Jam supports distinct gameplay styles, not just one gimmick
3. make the games feel like evidence of the platform's range and maturity

Possible forms:

1. a horizontal showcase with art, short descriptor, and interaction model
2. a curated "built with Air Jam" strip
3. a section that contrasts game style, controller design, and social dynamic

This is much more persuasive than repeating claims like "developer friendly" or "zero app download."

## 4A. Show The Addictive Loop, Not Just Static Capability

The homepage should make the loop feel alive:

1. have an idea
2. make the game
3. get people in instantly
4. laugh, compete, iterate
5. do it again

This is the emotional engine of the product.

Content should make that loop visible through sequence, not just through statements.

Good forms:

1. short clips that move from creation to play
2. a "made with Air Jam tonight" feeling
3. visual contrast between weird game ideas and immediate social payoff

Bad forms:

1. static feature lists with no momentum
2. long explanations before showing the fun

## 5. Add A Proper "How It Works" Section

One of Air Jam's biggest strengths is that the product model is simple and intuitive.

That should be visualized more clearly.

The section should explain:

1. host display runs on a computer or TV
2. players scan a QR code
3. phones become controllers instantly
4. inputs flow to the game in real time

The design should feel product-grade, not diagram-heavy.

Good direction:

1. sleek device framing
2. clean sequence or lane layout
3. minimal text with high clarity

Bad direction:

1. enterprise infographic clutter
2. overexplaining implementation details on the homepage

## 6. Add A "Who This Is For" Layer Without Sounding Broad Or Generic

Air Jam should feel welcoming to:

1. developers
2. creative tinkerers
3. people using AI to vibe-code game ideas
4. people who have never properly built a game before

This should not be framed as generic "for everyone" copy.

The right framing is:

1. developers can go deep
2. beginners can still get to the fun loop fast
3. the product lowers the barrier without flattening the ceiling

This matters because the future studio vision only makes sense if the homepage already signals that Air Jam is broader than a traditional SDK audience.

## 6. Add Real Developer Proof

If Air Jam is for builders, the page should show a builder surface.

Required direction:

1. replace at least one generic marketing section with a real code example
2. keep the snippet short and legible
3. highlight ease of adoption, type safety, and controller flow without overselling

The goal is not to teach the entire SDK on the homepage.

The goal is to make the SDK feel real, clean, and approachable.

## 7. Content Strategy

The homepage should not rely mainly on copy.

It should rely on the right mix of:

1. live-feeling visuals
2. short clips
3. strong stills
4. concise words
5. one or two technical proof surfaces

Recommended content inventory:

1. one hero world that feels branded and alive
2. three strong post-hero proof sections built around `Make`, `Join`, and `Play`
3. short looping clips for the three refactored games
4. at least one host-screen-to-phone-controller visual sequence
5. one short clean SDK snippet
6. one light future-facing studio mention

What should do most of the persuasive work:

1. real gameplay footage
2. visible join flow
3. visible variety across games
4. visible ease of creation

What should not do most of the persuasive work:

1. abstract claims
2. decorative icons
3. generic feature rows
4. a large top-of-page promo film unless it clearly improves the page

## 7A. Hero Media Strategy

The homepage does not need a large hero video by default.

Current preferred direction:

1. keep the hero atmospheric and focused
2. let the main proof begin immediately below the hero
3. avoid forcing a top-level promo video if the `Make`, `Join`, and `Play` sections already carry the product story strongly

Reasoning:

1. the hero already has a strong visual identity
2. adding a top-level video risks visual overload and diluted hierarchy
3. the post-hero sections can do a better job of teaching the loop clearly

The page should earn motion density carefully.

If a top-level video is ever added later, it should be because it materially improves clarity, not because product pages are "supposed" to have one.

Potential later experiment:

1. test a hero-integrated gameplay reel only after the core landing page is already working well without it

Rules for that experiment:

1. do not default to a raw fullscreen gameplay montage
2. preserve headline readability and hierarchy
3. preserve the hero's branded identity instead of flattening it into trailer wallpaper
4. treat gameplay as a controlled compositional layer, not as pure background noise

Success criteria:

1. the hero feels more alive without becoming noisier
2. the page still reads as premium and intentional
3. the gameplay layer improves understanding or desire rather than merely adding motion

## 7B. The Core Proof Structure Should Be `Make`, `Join`, `Play`

The first major proof block under the hero should be a sequence of three sections:

1. `Make`
2. `Join`
3. `Play`

These three sections should do different emotional jobs:

1. `Make` creates possibility
2. `Join` creates understanding
3. `Play` creates desire

Together they should explain the entire Air Jam loop in a way that feels self-evident.

## 7C. Media Treatment Should Differ By Section

The three proof sections should not all use the same kind of asset.

Using one repeated treatment everywhere will make the page flatter and more generic.

Recommended treatment:

1. `Make`: stylized composed graphics built from real product truths
2. `Join`: clear product-mechanic visuals showing controllers and join flow
3. `Play`: real fullscreen gameplay footage

This gives each section a distinct role while keeping the overall system coherent.

## 7D. `Make` Should Be Designed, Not Raw

The `Make` section should not rely on raw desktop capture as its main visual.

Raw screen recordings of terminals, editors, and desktop windows can easily look messy or amateurish even when the workflow is genuinely strong.

Preferred direction:

1. use real commands, real snippets, and real product surfaces
2. present them in a clean designed composition
3. crop aggressively
4. simplify window framing
5. animate the sequence so it feels fast, intentional, and approachable

This section should feel like:

1. idea becoming playable
2. creation becoming tangible quickly
3. a friendly workflow, not a cluttered workstation recording

Avoid:

1. literal unart-directed desktop capture
2. fake sci-fi terminal nonsense
3. overly technical sequences that make the product feel dev-only

## 7D1. `Make` Should Be A Runtime Motion Graphic, Not A Pre-Rendered UI Video

Current preferred direction:

1. build the `Make` section directly in React using `motion` / `motion/react`
2. treat it as a branded animated UI component inside the landing page
3. only use real video where the preview needs real gameplay proof

This is preferred because:

1. it keeps the section responsive and integrated with the page
2. it avoids AI-generated fake UI artifacts
3. it avoids turning a simple landing section into a heavier media pipeline
4. it makes iteration easier as the page design evolves

Remotion is still valid later for exported promo assets, but it should not be the default for this section.

## 7D2. `Make` Should Show A Simplified Real Workflow

The `Make` section should still be grounded in a real Air Jam workflow.

Preferred sequence:

1. terminal
2. `npx create-airjam`
3. code editor
4. publish / run control
5. gameplay preview

The sequence should be symbolic and art-directed, not literal and dense.

The goal is:

1. not to document every step
2. not to teach the SDK in detail
3. to make creation feel fast, clear, and surprisingly achievable

## 7D3. Recommended `Make` Motion Sequence

The section should animate through these visual beats:

1. a clean terminal panel fades or slides into place
2. the command `npx create-airjam` appears as the main text anchor
3. the terminal compresses into a success / scaffold state
4. the scene reconfigures into a simplified editor panel
5. a small amount of believable code becomes visible
6. a prominent `Run`, `Preview`, or `Publish` action becomes active
7. the action is triggered
8. a gameplay preview surface expands and comes alive using a real screen recording

Important constraints:

1. the command is the main textual moment
2. the editor should show only a tiny amount of code
3. the publish / run action should read immediately at a glance
4. the gameplay preview should feel like the payoff of the sequence
5. the whole section should stay visually sparse

## 7D4. `Make` Should Use Abstracted UI Surfaces

The `Make` section should not try to perfectly recreate:

1. a real desktop OS
2. a full terminal window with many logs
3. a detailed editor product UI

Instead it should use:

1. one clean terminal-like frame
2. one clean editor-like frame
3. one obvious action control
4. one framed gameplay viewport

This abstraction is important.

Detailed fake UI often looks cheaper than deliberately simplified UI.

## 7D5. `Make` Motion Principles

The animation language for this section should be:

1. clean
2. confident
3. premium
4. fast without being frantic

Preferred motion behaviors:

1. panel expansion
2. smooth layout re-parenting
3. controlled fades
4. subtle depth or parallax
5. small highlight pulses only when they help focus

Avoid:

1. constant glow pulsing
2. hyperactive micro-animation
3. multiple simultaneous attention grabs
4. "tech trailer" chaos

## 7D6. `Make` Asset Composition

The section should combine:

1. motion-built terminal/editor/publish graphics
2. real gameplay footage inside the preview frame

This hybrid is preferred because:

1. the workflow stays clean and branded
2. the result still uses real product proof
3. the section avoids both fake-dashboard tackiness and raw screen-recording mess

## 7D7. `Make` Content Hierarchy

The most important visual facts in the section should be:

1. `npx create-airjam`
2. a tiny glimpse of code
3. an obvious run / publish moment
4. the preview coming alive

Everything else should be subordinate.

If too many controls, logs, tabs, or labels are shown, the section will lose taste quickly.

## 7E. `Join` Should Make The Mechanic Obvious

The `Join` section should be the clearest explanation of how Air Jam works socially.

Recommended content:

1. multiple phones with different controller layouts for different games
2. the join/overlay or QR moment
3. controller interactions that visibly map to host behavior
4. optional profile or controller customization if it strengthens the sense of personality

This section should make people think:

1. "Oh, I get it."
2. "The phones are part of the fun, not just an input device."

## 7F. `Play` Should Be Mostly Pure Payoff

The `Play` section should lean hardest on real gameplay footage.

Recommended content:

1. fullscreen host gameplay
2. multiple games with visibly different moods and interaction patterns
3. moments where it is obvious that players are affecting the screen live

This section should not be over-designed.

It should feel immediate, kinetic, and undeniably real.

## 7G. Delivery Format

Preferred delivery format:

1. short looping `mp4` or `webm` assets

Avoid:

1. GIFs as the primary implementation format

Reasoning:

1. video loops look better
2. video loops compress better
3. GIFs are heavier and feel cheaper

## 7H. Tooling Direction

Current preferred direction:

1. use `motion` / `motion/react` for in-page motion graphic sections
2. use real video assets for gameplay-heavy proof sections
3. do not default to Remotion for homepage runtime animation

Reasoning:

1. page-native motion components integrate more cleanly with responsive layout
2. they are easier to edit as product UI instead of as rendered media
3. they avoid unnecessary media-pipeline complexity for simple branded motion sections

Remotion remains a valid later tool for:

1. exported marketing renders
2. social assets
3. tightly choreographed gameplay reels
4. reusable motion templates if the media layer grows large enough

But for the landing page itself, the clean default is:

1. runtime motion graphics for abstract branded sections like `Make`
2. real looped video assets where footage is the proof

## 8. Tighten Copywriting

The tone should stay friendly, but it needs more precision and less placeholder energy.

Copy rules:

1. avoid startup-sounding exaggeration
2. avoid gimmicky phrasing that reduces product trust
3. prefer simple, direct language
4. make every headline specific
5. write like a real product team, not a hype page
6. keep the language imaginative, but grounded
7. speak about fun without sounding childish
8. speak about accessibility without sounding watered down

Desired tone:

1. modern
2. friendly
3. confident
4. concise
5. creatively charged
6. socially alive

Undesired tone:

1. over-marketed
2. corporate
3. meme-heavy
4. vague

Copy should emphasize:

1. fast creation
2. instant social play
3. creative possibility
4. approachable power

Copy should avoid overemphasizing:

1. controller mechanics in isolation
2. generic "developer friendly" claims with no proof
3. future vision that outruns current reality

## 9. Build A More Intentional Visual System

The lower sections need the same level of taste as the hero.

Required visual improvements:

1. stronger spacing rhythm between sections
2. more deliberate use of large and small typography
3. cleaner content widths and alignment rules
4. fewer generic boxes with centered icons
5. more disciplined use of gradients, glows, and borders
6. background treatments that tie sections together across the whole page

The visual system should feel coherent from top to bottom.

## 10. Improve Navigation And Footer Restraint

The navbar and footer should support the page, not just exist on it.

Required improvements:

1. make the top nav feel more intentional within the hero composition
2. clarify destination priority between docs, dashboard, arcade, blog, and GitHub
3. make the footer simpler and more polished
4. ensure external links and internal product routes are framed consistently

The current nav is functional, but not yet premium.

## 11. Make Motion Feel Deliberate

Motion should add life and quality, not attention noise.

Required direction:

1. keep a small number of strong motions
2. prefer cinematic transitions over constant pulsing
3. let sections reveal with timing and confidence
4. avoid continuous over-animation in UI chrome

The current button glow animation is a good example of something that should likely become more restrained.

## 12. Improve Responsive Behavior

A polished landing page cannot only work well at desktop hero scale.

Required direction:

1. verify mobile composition intentionally, not as a collapsed desktop layout
2. make the hero readable on smaller screens without awkward negative offsets
3. ensure the scene and text retain hierarchy when stacked
4. simplify or reduce visual complexity on lower-power/mobile devices when needed

The mobile page should still feel designed, not merely tolerated.

## 13. Treat Accessibility And Performance As Part Of Polish

Professional polish is not purely visual.

Required expectations:

1. strong text contrast across all hero states
2. motion respect for reduced-motion users
3. keyboard-clear CTA and navigation focus states
4. controlled 3D performance budget
5. graceful fallback behavior if the scene is expensive or unavailable

The hero scene should feel premium, not fragile.

## Content Guidance By Section

This section defines what kind of material each homepage section should carry.

## Hero

The hero should carry:

1. one clear product line
2. one emotionally resonant support line
3. a builder-first CTA
4. a play/demo CTA
5. a visual that implies motion, possibility, and social energy

The hero should not carry:

1. a dense feature summary
2. multiple competing promises
3. heavy future vision copy

## Core Loop Section

This section should make the product loop obvious:

1. make
2. join
3. play
4. repeat

The section should feel almost self-evident from the visuals.

Preferred assets:

1. a simple visual sequence
2. short verbs
3. minimal supporting text

## Game Showcase

This section should prove breadth and personality.

Each game should show:

1. a distinct gameplay feel
2. a distinct phone-controller relationship
3. a short descriptor that makes the social dynamic obvious

Preferred assets:

1. short loop videos first
2. stills only when they are compositionally strong
3. no generic icons as substitutes for real game imagery

## Builder Proof

This section should prove:

1. Air Jam is real to build with today
2. it is friendly, not fake-simple
3. it supports fast iteration

Preferred assets:

1. one short code snippet
2. one screenshot from docs, dashboard, or dev workflow if useful
3. very little explanatory text

## Future Vision

This section should signal:

1. the current SDK/platform is the beginning
2. the direction is toward an even friendlier game-creation studio

Rules:

1. keep it brief
2. do not oversell unreleased surfaces
3. make the vision feel like a natural continuation of the loop already shown

## Implementation Architecture Improvements

The landing page should be cleaned up structurally before or during the redesign.

## 1. Split The Homepage Into Section Components

The current page should not stay as one large mixed route file.

Recommended structure:

1. `landing/hero`
2. `landing/game-showcase`
3. `landing/how-it-works`
4. `landing/sdk-proof`
5. `landing/final-cta`
6. `landing/site-footer`

The goal is not abstraction for its own sake.

The goal is to make the page editable without turning into a monolith.

## 2. Remove Auth UI From The Marketing Surface

The landing route should not remain the sign-in/sign-up container.

Recommended direction:

1. move auth entry to a dedicated route or dedicated overlay boundary
2. keep dashboard redirects/auth checks outside the main landing-page rendering path where possible

This keeps the marketing page mostly static, focused, and easier to optimize.

## 3. Keep Content Local And Typed

Do not introduce a heavy CMS for this.

Recommended direction:

1. keep content in code
2. use small typed data structures for repeated sections if needed
3. avoid over-configurable block systems

The right solution is a clean page architecture, not a mini page builder.

## 4. Keep The 3D Scene As A Contained Primitive

The hero scene should remain a contained visual module, not leak into the whole page architecture.

Recommended direction:

1. hero scene owns atmosphere
2. content layout owns messaging and CTA hierarchy
3. the rest of the page should not depend on hero-scene internals

This keeps the design expressive without coupling the entire page to WebGL decisions.

## What Not To Do

To avoid making the redesign worse, explicitly avoid these mistakes:

1. do not turn the page into generic SaaS blocks
2. do not replace personality with corporate polish
3. do not rely on glow and blur to simulate premium design
4. do not add more sections than the story needs
5. do not use copy that sounds inflated or fake
6. do not make the page visually louder just because it is game-related
7. do not make the landing page architecture more configurable than the product needs
8. do not let auth concerns keep leaking into the core marketing route

## Recommended Build Order

1. agree on product narrative and CTA priority
2. refactor landing-page architecture into section boundaries
3. redesign hero composition and copy
4. replace generic feature rows with proof-based sections
5. integrate real game showcase content
6. add SDK proof and "how it works" sections
7. polish motion, responsive behavior, and accessibility
8. tune performance and remove unnecessary visual noise

## Success Condition

This plan is successful when the landing page:

1. feels like one cohesive product surface from top to bottom
2. communicates Air Jam clearly within a few seconds
3. proves the product with real evidence, not only claims
4. feels stylish and memorable without feeling overdesigned
5. supports both the builder journey and the demo/arcade journey
6. is implemented with a clean page structure that can evolve without becoming messy

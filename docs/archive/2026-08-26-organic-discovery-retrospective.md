# Air Jam Organic Discovery Retrospective

Snapshot date: 2026-08-26
Status: preserved release-story source material

## Purpose

This snapshot preserves the timeline, evidence, and interpretation around Air
Jam's first known organic AI-mediated discovery.

It is source material for the eventual Air Jam 1.0 release story. It is not a
claim that Air Jam had reached product-market fit, acquired meaningful adoption,
or completed its formal v1 release.

## Executive Summary

Air Jam became publicly usable without completing its own formal v1 release
gate.

The public Arcade, origin story, packages, documentation, and launch article
were online, but the final proof and distribution sequence remained unfinished.
The product then stayed mostly quiet until an external developer independently
formed a similar "open-source Jackbox" idea, received Air Jam as a recommendation
from Claude, read the origin story, recognized the same AI-native product
questions, and contacted Tim on LinkedIn.

The strongest honest framing is:

> We built the substrate, put it in production, left the formal v1 and
> distribution sequence unfinished, and 101 days later an AI assistant
> performed the first meaningful piece of distribution for us.

This is not yet adoption evidence. It is evidence that Air Jam's category,
architecture thesis, and public explanation are legible to machines and
compelling to at least one highly relevant human.

## Timeline

| Date                      | Event                                                       | Meaning                                                       |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| 2025-11-21                | Repository created and first commit landed                  | Air Jam development began                                     |
| 2025-11-21 to 2026-01-03  | 144 commits across 21 active dates                          | First framework and open-source build wave                    |
| 2025-12-25                | SDK, server, and `create-airjam` first published to npm     | First public package surface                                  |
| 2026-01-04 to 2026-03-10  | 66 fully idle days                                          | First long pause                                              |
| 2026-03-11 to 2026-05-20  | 265 commits across 46 active dates                          | Main architecture rewrite and release-preparation wave        |
| 2026-03-22 to 2026-05-02  | PR #1, `AirJam 1.0`: 100 commits and 1,511 changed files    | Large clean-swap rewrite toward the agent-native architecture |
| 2026-05-02                | First live hosted releases recorded in production           | Hosted Arcade release model became real                       |
| 2026-05-03                | Public host cut over to `airjam.io`; origin story published | Public product and thesis became discoverable                 |
| 2026-05-05                | Public packages reached `0.9.2`                             | Latest framework prerelease; no 1.0 package was published     |
| 2026-05-19                | Launch article and launch-day discoverability work shipped  | Soft/content launch, not formal v1 completion                 |
| 2026-05-20 to 2026-07-24  | 64 fully idle days                                          | Product remained online without active launch execution       |
| 2026-07-24 and 2026-07-29 | Four bounded Android Auto, release-worker, and CORS commits | Small product-specific return, not the v1 closeout            |
| 2026-07-29                | Last application commit and deployment before this snapshot | Start of the current quiet period                             |
| 2026-08-12                | Oskari Noppa sent the LinkedIn message                      | First known AI-mediated organic discovery conversion          |
| 2026-08-26                | Message answered and this retrospective recorded            | 28 days after the last application commit                     |

At the time of the LinkedIn message, Air Jam was:

1. 264 days from the first commit
2. 101 days from the `airjam.io` cutover and origin story
3. 99 days from the `0.9.2` package release
4. 85 days from the launch article
5. 14 days from the last application commit and deployment

## What Had Actually Been Built

The quiet period followed a substantial production system, not a small demo.

At this snapshot, the repository contained:

1. 413 commits, including 397 non-merge commits
2. 69 active commit dates
3. 1,714 tracked files
4. 190 test or spec files
5. 124 Markdown documentation files
6. 79 archived plans
7. 17 app, package, and game workspaces
8. 6 game packages
9. a production platform, realtime server, release browser worker, Postgres
   control plane, hosted artifact release system, managed media, runtime
   analytics, agent contracts, MCP tooling, and public documentation
10. 6 live hosted releases in production

The large `AirJam 1.0` rewrite PR alone contained 100 commits, changed 1,511
files, and recorded 190,712 insertions and 25,852 deletions.

## The Release Contradiction

Air Jam was public, playable, and described through launch-facing content, but
its own release contract still classified it as prerelease.

Evidence:

1. the May 3 origin story said the Arcade was live while Air Jam was still
   "heading toward its first public release"
2. the public package line stopped at `0.9.2`
3. the `Air Jam 1.0` article existed but remained unpublished
4. the active v1 plan still required final manual proof, hosted validation,
   public-surface alignment, and launch distribution
5. the July 24 current-state snapshot still listed final prerelease proof,
   domain cutover, launch media, and distribution as open

The correct historical term is therefore **soft launch** or **public
prerelease**, not completed v1 launch.

## Adoption And Usage Evidence

### Creator Adoption

Production had exactly two registered accounts. The most recent account had
been created on 2026-03-12, before the public launch surfaces shipped.

This is the strongest evidence that Air Jam had not yet acquired external
creator adoption. Playing through the public Arcade does not require an
account, so account count does not measure players.

### Public Arcade Runtime Activity

The production runtime ledger is authoritative for gameplay activity, but not
for unique people or website visits.

Restricting the ledger to the `https://airjam.io` host origin from the May 3
public cutover through this snapshot produced:

1. 201 host runtime sessions
2. 50 sessions with at least one controller join
3. 59 sessions that reached active gameplay
4. 105 game-session metric records
5. 8,337 seconds, or roughly 2 hours 19 minutes, of eligible gameplay
6. a peak of 3 concurrent controllers

These totals include first-party development, manual proof, automation, and
possibly external players. They must not be reported as users or unique visits.

From the August 12 LinkedIn message through this snapshot, the same scoped
ledger recorded:

1. 61 host runtime sessions
2. 13 sessions with a controller join
3. 14 sessions that reached active gameplay
4. 946 seconds, or 15 minutes 46 seconds, of eligible gameplay

On August 13, the day after the message, the public Arcade recorded four game
sessions across Minimal, Pong, and The Office. Pong reached a peak of three
connected controllers. The timing is consistent with someone exploring Air
Jam after discovery, but the telemetry cannot attribute that activity to
Oskari and the release story must not claim that it can.

### GitHub Traffic

GitHub's authenticated owner traffic window retained only the rolling 14 days
from August 12 through August 25:

1. 17 repository views from 5 unique visitors
2. 18 clones from 15 unique cloners
3. one unique view and one unique clone on August 13

Current public repository state at the snapshot was 5 stars, 0 forks, 4 open
issues, and one public code contributor.

The August 13 timing is notable but remains unattributed.

### npm Traffic

Through August 25, the four primary public packages had accumulated 6,392 npm
download events:

| Package               | Since first publication | Since May 19 | Last 30 days | Last 7 days |
| --------------------- | ----------------------: | -----------: | -----------: | ----------: |
| `@air-jam/sdk`        |                   1,962 |          786 |           73 |           4 |
| `@air-jam/server`     |                   1,360 |          220 |           51 |           3 |
| `@air-jam/mcp-server` |                     536 |          179 |           52 |           0 |
| `create-airjam`       |                   2,534 |          511 |           57 |           2 |
| **Total**             |               **6,392** |    **1,696** |      **233** |       **9** |

npm download events are not users or unique installs. CI, package mirrors,
security scanners, repeat installs, and dependency relationships can all
inflate them.

### Content Reach

The May 19 DEV launch article displayed 46 reactions and 5 comments. A
third-party SquaredTech article about Air Jam displayed 239 views.

Those are public content signals, not verified visits to `airjam.io`.

## The Website Measurement Gap

The production observability baseline selected Umami for lightweight website
analytics, and the platform contains an optional Umami adapter. Production did
not configure the Umami provider or website ID, and the live site did not load
an Umami tracking script.

Consequences:

1. historical landing, docs, blog, and Arcade page views cannot be recovered
2. public runtime sessions cannot be converted into unique website visitors
3. GitHub's 14-day traffic window cannot substitute for product traffic
4. the release story must not claim an `airjam.io` visitor total

This gap is useful product evidence in its own right: Air Jam built a strong
authoritative gameplay accounting plane but did not finish the lightweight
discovery and conversion measurement needed for launch learning.

## What The LinkedIn Message Means

The discovery path was:

`independent problem -> Claude retrieval -> Air Jam recommendation -> origin story read -> architectural recognition -> human contact`

The message validates two Air Jam bets simultaneously:

1. the project is legible as an open-source Jackbox or AirConsole alternative
2. an agent-readable product surface can become a real discovery channel

The message is unusually aligned because Oskari did not only recognize the
party-game category. He independently raised the same deeper question recorded
in the origin story: whether to build a dedicated in-app AI studio or expose a
clean substrate that users can connect their existing Claude, Codex, or other
agent tools to.

The planned Hacker News, Reddit, Product Hunt, and broader directory sequence
had not been executed. Claude effectively supplied the missing first
distribution step by matching an independently expressed problem to Air Jam.

## Claims The Future 1.0 Story May Reuse

Safe, evidence-backed lines:

> Air Jam was publicly playable for 101 days before the first person told us
> they had discovered it through an AI assistant.

> We never completed the distribution plan. Claude performed the first
> meaningful piece of distribution for us.

> The project did not acquire a user yet. It acquired evidence that its thesis
> was legible to machines and compelling to the right human.

> We designed Air Jam so agents could understand and operate it. The first
> external proof of that bet was not an automated test. It was Claude deciding
> Air Jam was the right recommendation for a stranger's idea.

> The room was still mostly empty, but someone found it through Claude and
> knocked on the door.

## Claim Guardrails

The future release story must not say:

1. Oskari created the August 13 GitHub or Arcade activity
2. npm downloads represent developers or installations
3. runtime sessions represent unique players
4. Air Jam had a known website visitor count
5. the May soft launch completed the formal v1 contract
6. one inbound message proves product-market fit

## First-Party Product Telemetry Direction

Air Jam should not build a generic Umami clone.

The stronger end-state is a small first-party product telemetry plane that
answers Air Jam-specific discovery and conversion questions while keeping
runtime usage analytics as the authoritative gameplay and accounting plane.

The future telemetry contract should distinguish:

1. **public-surface discovery events**
   - landing, docs, blog, Arcade, and dashboard entry
   - entry route, referrer host, campaign parameters, and bot classification
2. **intent events**
   - quick-start opened
   - scaffold command copied
   - GitHub or npm link opened
   - Arcade entered
   - creator signup started and completed
3. **authoritative product events**
   - room, controller, active-game, release, and eligible-playtime facts
   - these remain owned by existing server-observed runtime and release systems
     rather than being duplicated as browser claims

Recommended architecture:

1. typed, versioned, append-only product telemetry events
2. first-party ingestion owned by the platform control plane
3. anonymous page-view and session reporting without fingerprinting; do not
   claim durable unique visitors unless a later privacy and consent decision
   explicitly introduces a first-party visitor identity
4. no raw IP retention; retain only narrowly justified, privacy-reviewed data
5. bot and agent classification with separate reporting rather than silent
   discard, plus normalized referrer sources
6. deterministic daily rollups and an internal read surface
7. explicit correlation to existing runtime sessions where the product owns a
   safe correlation key
8. retention and deletion policy decided before collection begins
9. server-observed reach events for agent-facing public resources such as
   `/llms.txt`, docs manifests, search indexes, and AI-pack manifests because
   browser telemetry cannot observe agent fetches

One reporting view may combine discovery telemetry, platform lifecycle facts,
and runtime usage facts, but it must preserve their authority labels:

1. public-request and browser product telemetry is approximate
2. platform account, game, and release lifecycle facts are authoritative in
   the platform domain
3. runtime usage facts are authoritative for gameplay and accounting

This should be implemented as one full replacement:

1. build and verify the first-party telemetry path
2. remove the Umami script adapter, browser global, env contract, CSP allowance,
   and documentation
3. do not run two competing website analytics models

Until that implementation exists, the honest production state is that Air Jam
has authoritative runtime analytics but no website traffic authority.

## Same-Day Implementation Addendum

Later on 2026-08-26, the measurement gap described above was closed in the
repository with a first-party product telemetry plane.

The shipped boundary follows the retrospective's recommendation:

1. one closed, typed event union rather than a generic analytics clone
2. ephemeral in-memory anonymous sessions without durable visitor identity
3. same-origin, size-bounded, rate-limited ingestion
4. separate human, bot, agent, and unknown classifications
5. server-observed reach for the canonical agent resources
6. append-only evidence, deterministic daily projection, rebuild, and explicit
   retention
7. one internal report that keeps discovery, platform lifecycle, and runtime
   facts visibly separated by authority
8. full removal of the dormant external analytics implementation

This does not recover the missing historical visit count. It means the eventual
1.0 story can preserve the measurement gap honestly while explaining what Air
Jam built in response to it.

## Evidence Sources

Repository evidence:

1. git history and GitHub repository metadata
2. GitHub PR #1, `AirJam 1.0`
3. npm registry metadata and download APIs
4. production Postgres aggregate queries against runtime analytics and release
   records
5. the production Railway deployment surface
6. the live `airjam.io` document and analytics script inspection
7. the v1 release plan, current-state snapshot, work ledger, origin story,
   launch article, and discoverability plan

Public references:

1. <https://github.com/vucinatim/air-jam>
2. <https://airjam.io/blog/story-of-building-airjam>
3. <https://airjam.io/blog/every-phone-a-game-controller>
4. <https://dev.to/zerodays/what-if-every-phone-in-the-room-was-a-game-controller-in-the-age-of-ai-375g>
5. <https://www.squaredtech.co/phone-as-controller-air-jams-free-open-source-multiplayer-framework>

# Discoverability and Launch Promotion Plan

Last updated: 2026-05-19 (post-launch session)
Status: actionable plan with first-pass execution complete
Companion to: [discoverability-vision.md](../discoverability-vision.md)

## Session log

### 2026-05-19 — launch day polish + discoverability foundation

**Shipped** (merged to `main` via [#30](https://github.com/vucinatim/air-jam/pull/30) and the [Dockerfile hotfix #31](https://github.com/vucinatim/air-jam/pull/31)):

- Section 1 site polish: real root title + description, OG/Twitter cards (1200×630 card with logo + tagline + cyan accent + terminal-style footer), `Organization` + `SoftwareApplication` JSON-LD, apple-touch-icon, web manifest, `robots.ts` AI crawler rules
- Blog post coverImage schema + per-post `BlogPosting.image` + Twitter/OG images wired (`every-phone-a-game-controller` ships with its cover.png)
- GitHub repo description + 19 topics including `airconsole-alternative`, `airconsole`, `phone-controller`, `mobile-controller`, `qr-code`, `mcp`, `ai-native`, `nextjs`, `gamedev`, `party-games`, `vibe-coding`
- npm package metadata: tightened descriptions + expanded keywords on `@air-jam/sdk`, `@air-jam/server`, `create-airjam` (effective next publish)
- Search Console: verified airjam.io under **both** zerodays work account and personal account as parallel verified owners (two TXT records at root)
- Bing Webmaster Tools: imported from Google Search Console (no separate verification)
- Hashnode mirror: cross-posted launch article at `vucinatim.hashnode.dev` with canonical pointing to `airjam.io/blog/every-phone-a-game-controller`
- Awesome-list PR #1: [punkpeye/awesome-mcp-servers#6633](https://github.com/punkpeye/awesome-mcp-servers/pull/6633) — Gaming section, awaiting maintainer review
- Personal DMs to friends (some sent, no stars yet — expected; star-velocity comes from cold reach, not warm DMs)

**Polish that came up during execution** (not in original plan, but shipped):

- Mobile footer fix: nav + social icons now always stack on mobile (was cramping on wider phones)
- Mobile landing perf: per-card video + blurred-background gated on `(hover: hover) and (pointer: fine)`; on touch, IntersectionObserver-style scroll pass autoplays whichever card is closest to viewport center; full-section blurred-video background feature-flagged off
- Arcade auto-opens QR overlay for fresh visitors when `joinUrlStatus` is ready and no controllers are connected
- Špela Buh's GitHub credit added to arcade attributions + launch post
- **Critical Dockerfile fix**: `cp -r` → `cp -rT` for `public/` and `.next/static` (the old form nested the source inside the existing Next standalone directory, so most `public/` assets were returning 404 on prod — including the dev.to article's images). Hotfix shipped as [#31](https://github.com/vucinatim/air-jam/pull/31).

**Attempted but blocked**:

- `appcypher/awesome-mcp-servers` — fork created, branch pushed, but the maintainer disabled community PRs. Fork cleaned up.
- `hesreallyhim/awesome-claude-code` — mid-restructure, README is a stub with "TODO" for the new ToC. No place to PR. Revisit in a few weeks.
- `Calinou/awesome-gamedev` — last pushed 17+ months ago, likely abandoned. Skipped.

**Discussed and subsequently implemented**:

- Preview-server CORS architecture. PR-30 surfaced an infra bug: the server isn't deployed per PR (watchPatterns excludes platform changes), so PR previews couldn't reach a working signal server. The shared production server now supports narrow leading-subdomain CORS patterns such as `https://*.vercel.app`; per-app bootstrap origin policy remains the authoritative host boundary.

## Purpose

This plan turns the principles in `discoverability-vision.md` into concrete, prioritized work. It covers three problems:

1. **Site polish** — how `airjam.io` presents in Google search results and on social shares today is generic and undersells the product.
2. **Discoverability surfaces** — humans (Google), agents (LLM crawlers and retrieval), and curated lists (GitHub "awesome" repos, registries, Product Hunt) each need different work.
3. **Article promotion** — keeping the recently published `dev.to` launch article ranking, without changing its existing headline.

Each section ends with a checklist. The plan is intentionally executable in small PRs — none of this needs a single large drop.

## Guiding constraints

- **Published article headlines are frozen.** The dev.to launch piece ("What If Every Phone in the Room Was a Game Controller — in the Age of AI?") and the on-site origin story ("Story of building Air Jam") keep their current titles. Reframing happens in new surfaces, not by rewriting shipped ones.
- **Lean into the "open-source AirConsole alternative" framing** wherever it does *not* require editing already-published pieces. That phrase has high search intent, zero current competition, and matches what readers actually google.
- **Truth density over volume** ([discoverability-vision.md](../discoverability-vision.md)). No thin landing pages, no AI-bait copy, no metadata that overpromises what the surface delivers.

---

## 1. Site polish — metadata, social cards, structured data

### Problem

Current Google snippet for `airjam.io` shows:

> **Air Jam Platform**
> Start with one command, write your game logic, and let Air Jam handle the room, controllers, and networking. Read more

The title is generic ("Air Jam Platform" — the literal default from `apps/platform/src/app/layout.tsx`). The description Google chose is actually a body sentence because the configured `<meta description>` ("Air Jam docs and platform for QR-code multiplayer controllers and SDK integration") reads like a dependency README. There is no `openGraph` block, no `twitter` block, no `og:image`, so every link share on Discord, Slack, X, iMessage, LinkedIn, etc. renders without a card.

### Work

#### 1.1 Root metadata rewrite

In `apps/platform/src/app/layout.tsx`:

- **Title default**: `"Air Jam — Phone-controller multiplayer games, built for the AI era"`
  - Template stays `"%s | Air Jam"`.
- **Description** (~155 chars): one declarative sentence + one verb sentence. Draft:
  > "Open-source framework for QR-code multiplayer party games. Scaffold a game with one command, deploy as a static site, play on any phone."
- Add `keywords` lightly — only if they reflect real surface content.

#### 1.2 Open Graph + Twitter cards

Add to root `metadata` export:

- `openGraph`: `siteName: "Air Jam"`, `type: "website"`, `url`, `title`, `description`, `images: [{ url: '/opengraph-image', width: 1200, height: 630 }]`.
- `twitter`: `card: "summary_large_image"`, `site`/`creator` handles, mirrored title + description + image.

Generate the image via Next file conventions:

- `apps/platform/src/app/opengraph-image.tsx` — 1200×630 dark background, Air Jam logo, tagline ("Phone-controller multiplayer for the AI era" or similar), maybe a small phone-as-controller visual element.
- `apps/platform/src/app/twitter-image.tsx` — same source or a variant.

Use Next's `ImageResponse` so the card is generated at build time, no manual PNG to keep in sync.

#### 1.3 Per-route metadata

- Each blog post should export `generateMetadata` returning a `title`, `description`, and `openGraph.images` driven by its own `post.meta.ts`. Confirm `story-of-building-airjam` (and any future post) renders its own social card, not the site default.
- Each docs page should set a `title` derived from the heading and a one-line `description`.
- Arcade and individual game pages should set titles like `"<Game Name> — Air Jam Arcade"` plus a description.

#### 1.4 Structured data (JSON-LD)

In the root layout, embed two JSON-LD blocks:

- `Organization` — name, url, logo, `sameAs` array pointing to the GitHub org/repo, npm packages, dev.to author page, zerodays.dev. This is what lets Google attach a knowledge-graph entity to the site.
- `SoftwareApplication` — name "Air Jam", `applicationCategory: "GameApplication"`, `operatingSystem: "Web"`, free price, link to GitHub.

For each blog post: `BlogPosting` JSON-LD on the post page with `author`, `datePublished`, `image`, `headline`.

#### 1.5 Icons + manifest

- Add `apple-touch-icon.png` (180×180) under `apps/platform/src/app/`.
- Add `manifest.webmanifest` exposing name, short_name, theme_color, icons. Cheap, polishes home-screen adds and some link previews.

#### 1.6 Checklist

- [x] Rewrite root `title` + `description` in `apps/platform/src/app/layout.tsx` — shipped: `"Air Jam — Phone-controller multiplayer games for the AI era"` (60 chars)
- [x] Add `openGraph` + `twitter` blocks to root metadata
- [x] Create `opengraph-image.tsx` and `twitter-image.tsx`
- [/] Wire per-route `generateMetadata` for blog, docs, arcade — **partial**: blog done with per-post `coverImage`. Docs/arcade still inherit site defaults.
- [x] Add `Organization` + `SoftwareApplication` JSON-LD to root layout
- [x] Add `BlogPosting` JSON-LD to blog post template — includes `image`, `ImageObject` publisher logo, `mainEntityOfPage`
- [x] Add `apple-touch-icon.png` and `manifest.webmanifest` — shipped as `apple-icon.tsx` + `manifest.ts` via Next file conventions
- [ ] Manually verify with [Google's Rich Results test](https://search.google.com/test/rich-results) and [opengraph.xyz](https://www.opengraph.xyz/) — pending; one-off check, ~5 min
- [ ] Request re-indexing in Google Search Console after deploy — pending; submit launch article + origin story URLs explicitly

---

## 2. Discoverability — humans, agents, curated lists

### 2.1 Human SEO

Light, foundation-level only at this stage. We are not buying ads, building backlinks, or shipping content farms.

- **Google Search Console + Bing Webmaster Tools**: register property, submit `sitemap.xml`. Gives crawl visibility and indexed-page count. Do this on launch day or sooner.
- **Push the "open-source AirConsole alternative" framing on *new* surfaces only.** Specifically:
  - GitHub repo description and the `<repo>/About` section.
  - npm package `description` and `keywords` for `@air-jam/sdk`, `@air-jam/server`, `create-airjam`.
  - Future blog posts, social posts, Product Hunt / HN copy.
  - A new short doc page (`/docs/why-air-jam` or similar) that uses the phrase in an H1 and naturally throughout. This is the on-site page Google can rank for that query.
  - **Not** the dev.to article (frozen) and **not** the existing origin-story post (frozen).
- Ensure docs pages render server-side. LLM crawlers and Google both reward SSR'd content over JS-gated content. Already the case in Next; verify no client-only docs surface exists.

#### Checklist

- [x] Verify property in Google Search Console, submit `sitemap.xml` — verified under both work + personal accounts as parallel verified owners (two TXT records at root)
- [x] Same for Bing Webmaster Tools — imported from Google Search Console (no separate verification)
- [x] Update GitHub repo description + topics to include "airconsole-alternative" framing — 19 topics, including `airconsole-alternative`, `airconsole`, `phone-controller`, `mobile-controller`, `qr-code`, `mcp`, `ai-native`, `nextjs`, `gamedev`, `party-games`, `vibe-coding`
- [x] Update npm package descriptions + keywords — committed; effective on next `release:public` cycle
- [ ] Author `/docs/why-air-jam` (or equivalent) with the framing in H1 + body — pending; **high-value remaining item** (own search landing page for `"open source airconsole alternative"`)
- [ ] Audit all docs routes render under SSR with JS disabled — pending; quick spot-check task

### 2.2 Agent / LLM discoverability

This is the surface where Air Jam has an unusual structural advantage — the framework is *designed* for agents — and it should be visible.

- **`/llms.txt` and `/llms-full.txt`** at the site root. Emerging convention (Anthropic, Mintlify, Vercel). `llms.txt` is a short markdown index pointing to canonical pages; `llms-full.txt` concatenates the canonical docs into one long markdown file for retrieval. Cheap to generate at build time from existing MDX.
- **`ai-pack` directory** at `apps/platform/public/ai-pack/` already exists. Confirm:
  - It's reachable at `airjam.io/ai-pack/...`
  - It's referenced from the home page or docs nav so a human/agent can find it
  - Versioned (it already has `stable/0.1.0/`)
- **`robots.ts` audit**: explicitly *allow* `GPTBot`, `ClaudeBot`, `Claude-Web`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`. Do not block. The product wants to be in their retrieval and training surfaces.
- **MCP registry submissions.** Air Jam already ships MCP connectors. Submit to:
  - [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) — official list
  - [`punkpeye/awesome-mcp-servers`](https://github.com/punkpeye/awesome-mcp-servers) — community list
  - Any MCP registry surfaces inside Claude Desktop / Cursor / Continue
- **Schema.org `Action` markup** on docs pages for agent-callable actions where it fits — but only where the action genuinely exists. Truth density over volume.

#### Checklist

- [/] Generate `/llms.txt` and `/llms-full.txt` at build time from docs MDX — **partial**: `/llms.txt` exists in repo; not yet generated from docs MDX. `/llms-full.txt` not yet shipped.
- [ ] Link `ai-pack` from docs nav and home page agent section — pending
- [x] Audit `robots.ts` to explicitly allow major AI crawlers — explicit rules for `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `ClaudeBot`, `Claude-Web`, `anthropic-ai`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`, `DuckAssistBot`, `Meta-ExternalAgent`
- [ ] Submit MCP connector to `modelcontextprotocol/servers` — pending; official registry, worth doing
- [x] Submit MCP connector to `punkpeye/awesome-mcp-servers` — PR [#6633](https://github.com/punkpeye/awesome-mcp-servers/pull/6633) open, awaiting review
- [ ] Verify Anthropic / OpenAI / Perplexity can fetch and summarize the home page cleanly — pending; spot-check with each, 5 min each

### 2.3 Curated lists and registries

Each of these is a one-PR or one-form effort with outsized payoff. Doing them as a batch over a single afternoon is correct.

GitHub "awesome" lists to target (open a PR on each, follow their format):

- `awesome-nextjs`
- `awesome-game-development`
- `awesome-multiplayer-game-development`
- `awesome-self-hosted`
- `awesome-opensource-games`
- `awesome-claude-code`
- `awesome-mcp-servers` (also covered in 2.2)
- `awesome-react`
- `awesome-typescript`

Other surfaces:

- **GitHub repo topics**: `multiplayer`, `game-development`, `websocket`, `qr-code`, `party-games`, `airconsole`, `airconsole-alternative`, `agent-tools`, `mcp`, `nextjs`, `react`, `open-source`.
- **npm keywords** on `@air-jam/sdk`, `@air-jam/server`, `create-airjam` — same vocabulary.
- **Product Hunt** — one-shot launch. Plan for a Tuesday. Recruit a hunter ahead of time (better than self-launching). Assets needed: 30-sec demo video, GIFs, screenshots, dev.to article + origin story as supporting links. Don't do this until 1.x metadata work above is shipped.
- **Hacker News (Show HN)** — see Section 3, treated as a promotion lever there.
- **Reddit**: `r/gamedev` and `r/webdev` for the dev.to article; both subs reward "I built X and here's what I learned" framing, not announcements. Read each sub's self-promo rules before posting.
- **Lobsters** — invite-only but the audience overlaps heavily with HN, less noise. Submit the origin story.
- **Indie Hackers** — a build-in-public-style post linking the origin story.

#### Checklist

- [x] Update GitHub repo topics — 19 topics, see Session log
- [x] Update npm package keywords across `@air-jam/sdk`, `@air-jam/server`, `create-airjam` — effective next publish
- [/] Open PRs to each `awesome-*` list listed above — **partial / re-scoped**:
  - [x] `punkpeye/awesome-mcp-servers` (87k ⭐) — PR [#6633](https://github.com/punkpeye/awesome-mcp-servers/pull/6633) open
  - ⏭️ `appcypher/awesome-mcp-servers` (5.5k ⭐) — maintainer disabled community PRs; fork cleaned up
  - ⏭️ `hesreallyhim/awesome-claude-code` (44k ⭐) — mid-restructure, ToC removed pending rewrite; revisit later
  - ⏭️ `Calinou/awesome-gamedev` (3k ⭐) — 17+ months stale, likely abandoned
  - [ ] `awesome-nextjs`, `awesome-react`, `awesome-typescript`, `awesome-self-hosted`, `awesome-opensource-games` — not yet evaluated; need to confirm activity first
- [ ] Identify and contact a Product Hunt hunter (target launch: TBD, post 1.x metadata work) — pending
- [ ] Prepare PH assets: demo video, GIFs, screenshots, tagline — pending
- [ ] Submit origin story to Lobsters and Indie Hackers — pending
- [ ] Schedule Reddit posts (r/SideProject, r/IndieDev Day 1; r/gamedev, r/webdev Day 2+) — pending, see [Section 3.6](#36-launch-week-distribution-sequence) for the full sequence + templates

---

## 3. Promoting the dev.to launch article

### Context

Article is already published; headline is frozen. Goal: maximize its ranking on dev.to and its reach off-platform, in the first 1–2 weeks where dev.to's algorithm is most responsive.

dev.to's ranking is approximately: reactions (hearts / unicorns / bookmarks) + comments + reading time + tag fit, weighted toward the first 24–72 hours but with a long tail if comments stay active.

### Work

#### 3.1 On-platform optimization

- **Tags**: use all four tag slots. Best mix: `#webdev`, `#opensource`, `#javascript` (or `#typescript`), `#gamedev`. The first three are the largest pools; `#gamedev` is the niche fit. If `#ai` or `#llm` is allowed and the tag is active, swap one of the broad three for it.
- **Cover image**: confirm a 1000×420 cover image is set on the dev.to post. If not, upload one — dev.to's feed is image-first and CTR from feed drops sharply without a cover.
- **Comments**: respond to every comment within hours, substantively (2–3 paragraphs where appropriate). Comment depth is a ranking signal.
- **Bookmarks**: ask explicitly in the closing CTA on social posts — "bookmark on dev.to if you want to come back to it." Bookmarks rank heavily.

#### 3.2 Off-platform amplification (drive traffic *to* dev.to, not away)

The instinct on a launch is to send people to `airjam.io`. For the first 72 hours of dev.to ranking work, the inverse is correct: send people to the dev.to URL. External traffic that converts to reactions/comments lifts the post in the algorithm.

- **X / Twitter**: a thread, not a single tweet. Opening tweet hooks with the AirConsole-shaped problem; subsequent tweets pull the strongest beats from the article; final tweet links the dev.to URL.
- **LinkedIn**: same content, reframed for a professional audience — lean on the "infra-vs-creative split" and "what AI changes for indie game dev" angles.
- **Bluesky**: a shorter version of the thread.
- **Mastodon**: same.
- **zerodays internal Slack / Discord**: ask team to react and share. Team reactions early matter disproportionately.
- **Personal network DMs**: 5–10 targeted DMs to people who would actually find it interesting and might share — this beats public posting for engagement quality.

#### 3.3 Cross-posting with canonical link

Republish the dev.to article on:

- **Hashnode** with `canonical_url` pointing back to dev.to.
- **Medium** with the same canonical setup (use the import-from-URL tool, then set canonical).
- **The zerodays blog** if there is one, also with canonical link.

Canonical tells Google the dev.to version is primary, so cross-posts don't compete in search. They pick up incidental readers on each platform without diluting ranking.

#### 3.4 HN Show HN — the big lever

The on-site **origin story** (not the dev.to launch piece) is the right post for Hacker News. It's essay-shaped, has real lessons, and the "designed for agents, not humans first" angle is exactly what HN rewards.

- **Title**: not the article's current title. Draft options:
  - `Show HN: Air Jam — Open-source AirConsole alternative, designed for AI agents`
  - `Show HN: A phone-controller multiplayer framework built for AI-assisted dev`
  - `Show HN: Air Jam – Every phone in the room is a game controller`
- **URL**: link to the on-site origin story post, not the dev.to article. Origin story is the substantive read.
- **Timing**: Tuesday or Wednesday, 8–10am Pacific. Don't post Friday-Sunday.
- **First comment**: write a top-level comment as the author within 1 minute of posting — short, friendly, points at the most interesting technical decision (probably the agent-first design principle from the 1,500-file rewrite). This sets the tone for the thread.
- **Engagement**: respond to every comment for the first 4 hours. HN ranks heavily on comment activity in the first hour.

This is the single highest-leverage promotion action available. Do not do it on the same day as the Product Hunt launch — split them by at least a week.

#### 3.5 Checklist

- [x] Set/confirm 4 tags on dev.to — `opensource, react, ai, gamedev`
- [x] Set/confirm 1000×420 cover image on dev.to
- ⏭️ Author X/Twitter thread linking dev.to, post — **explicitly skipped** (0-follower account, low ROI vs. effort/cringe; documented as user preference)
- ⏭️ LinkedIn version of the post, link dev.to — skipped, same reason
- ⏭️ Bluesky + Mastodon versions — skipped, same reason
- [ ] zerodays Slack share, ask for reactions — pending
- [x] 5–10 targeted DMs to relevant network — friends DMed
- [x] Cross-post to Hashnode with canonical link — live at `vucinatim.hashnode.dev`, canonical points to `airjam.io/blog/every-phone-a-game-controller` (note: **canonical is airjam.io**, not dev.to — see note below)
- [ ] Cross-post to Medium with canonical link — pending; ~15 min remaining
- [ ] Submit origin story to HN as Show HN (Tuesday/Wednesday morning Pacific, with prepared title + first comment) — pending; **the highest-leverage unactioned move**
- [ ] Respond to every dev.to comment within hours for first 72 hours — ongoing
- [ ] Respond to every HN comment for first 4 hours after submission — when HN happens

> **Note on canonical URL choice:** the dev.to article's frontmatter explicitly sets `canonical_url: https://airjam.io/blog/every-phone-a-game-controller`. So airjam.io is the canonical home, and **every mirror points at airjam.io** (not at dev.to). This is the correct setup — airjam.io collects Google authority for the article.

### 3.6 Launch-week distribution sequence

This is the recommended day-by-day fire-order across HN, Reddit, and remaining channels. Designed to (a) preserve HN Show HN's "OP is the author" framing, (b) avoid burning multiple platforms with rushed posts on the same evening, and (c) keep posts crisp by spacing them to fresh-energy mornings.

**Day 1 — HN morning (Tue or Wed, 8–10am Pacific)**

- Post the **origin story** (`https://airjam.io/blog/story-of-building-airjam`) as **Show HN**, not the dev.to launch piece.
- Use one of the prepared title drafts in Section 3.4.
- Write a first comment from yourself (the OP) within 60s of posting. Short, friendly, points at the most interesting technical decision (the 1,500-file rewrite / agent-first design principle).
- Respond to every reply for the first 4 hours.
- **Do not** post to other platforms while HN is in its first hour — the HN attention should be undivided, and any external link to a non-HN URL during that window dilutes the story.

**Day 1 — Reddit afternoon (same day, after HN settles ~4 hours in)**

Two low-risk subs in parallel. Different audiences from HN, won't cannibalize.

- **r/SideProject** (~250k members) — friendly "I made this" sub. Use the template below.
- **r/IndieDev** (~600k members) — indie game dev audience. Same template, light edit.

**Day 2–3 — Reddit higher-quality subs (Thu/Fri, US morning)**

These require more thoughtful framing — wait until you can write them fresh.

- **r/gamedev** (~1.7M members) — *not* "we launched", but "what I learned building a phone-controller multiplayer framework with AI in the loop". Lead with the infra-vs-creative split from the origin story.
- **r/webdev** (~2M members) — same idea, framed for the web audience.

Skip `r/programming` (too anti-self-promo) and `r/javascript`/`r/reactjs` (poor fit for the framework story).

**Day 4+ — Niche / curated surfaces**

- **Lobsters** — invite-only but the audience overlaps heavily with HN. Submit the origin story.
- **Indie Hackers** — build-in-public post linking the origin story.

### 3.6.1 Ready-to-paste templates

**r/SideProject post (3 min effort, low-risk)**

> **Title**: I built an open-source AirConsole alternative — every phone in the room becomes a game controller
>
> **Body**:
> Spent the last few months building [Air Jam](https://airjam.io) — open-source framework for QR-code phone-controller multiplayer party games. You run it, players scan a QR with their phones, everyone joins as a controller. Six template games ship with it.
>
> It's free, MIT, runs anywhere. Built so AI assistants (Claude Code, Cursor) can write games on it without reinventing networking each time.
>
> Site: https://airjam.io · Repo: https://github.com/vucinatim/air-jam
>
> Would love feedback / stars if you find it interesting.

**r/IndieDev post** — same content, slight reframing toward indie game dev audience: lead with the jam-game outcomes (Code Review, Last Band Standing, The Office) as proof that the framework lets you ship a real game in a day.

**r/gamedev post** (Day 2+, more thoughtful framing — *not* a launch announcement)

> **Title**: What I learned building a phone-controller multiplayer framework with AI in the loop
>
> **Body**: link to the origin story post on airjam.io. Pull one or two reflective beats into the body text (the infra-vs-creative split, the 1,500-file rewrite, the agent-first design principle). Frame as a post-mortem / lessons-learned, not as an ad for a product.

---

## Execution order (suggested)

This plan is large but the dependencies are loose. A sensible order:

1. ~~**This week**: Section 1 (site polish — metadata, OG image, JSON-LD) and Section 3.1–3.3 (dev.to tags, cross-posts, social amplification). Both can ship in parallel.~~ ✅ **Done 2026-05-19** (except Medium cross-post).
2. **Next week** (revised): the high-leverage items below in priority order.
3. ~~2–3 weeks out: HN Show HN~~ — bumped up; metadata + OG cards are live, so HN can go in next session.
4. **Post 1.x release / when v1 lands**: Product Hunt launch (Section 2.3), with all metadata, OG cards, MCP registry presence, and `awesome-*` PRs already shipped — so anyone who clicks through lands on a complete, professional surface.

### Top of next-session queue (priority order)

1. **Launch-week distribution sequence** ([Section 3.6](#36-launch-week-distribution-sequence)) — the day-by-day fire order: HN Show HN morning → r/SideProject + r/IndieDev afternoon → r/gamedev + r/webdev on Day 2–3. Single highest-leverage cluster of work remaining. Templates already drafted.
2. **Medium cross-post** (Section 3.3) — ~15 min. Import from dev.to URL, set canonical to `airjam.io/blog/every-phone-a-game-controller`, publish.
3. **`/docs/why-air-jam` page** (Section 2.1) — the on-site search landing page for `"open source airconsole alternative"`. H1 + body uses the framing honestly with a real comparison.
4. **`modelcontextprotocol/servers` PR** (Section 2.2) — official MCP registry. Air Jam's MCP server (`@air-jam/mcp-server`) is a strong fit.
5. ~~**Preview-server CORS architecture fix**~~ — implemented with narrow leading-subdomain origin patterns so PR-specific hosts can reach the shared realtime server without opening production CORS globally.
6. **Manual validators** (Section 1.6) — drop `airjam.io` through [Google Rich Results test](https://search.google.com/test/rich-results) and [opengraph.xyz](https://www.opengraph.xyz/). Confirm JSON-LD + OG cards render. Request indexing of the two launch posts.
7. **`/llms.txt` + `/llms-full.txt`** (Section 2.2) — generate at build time from docs MDX. Link from docs nav.

## Definition of done

For each section the "done" state is concrete:

- **Section 1**: Sharing any `airjam.io` URL on X / Discord / iMessage renders a rich card with image, title, and description. Google search for "Air Jam" returns a card with logo, title, and at least one sitelink within 4 weeks.
- **Section 2**: Air Jam appears on at least 3 `awesome-*` lists, in `modelcontextprotocol/servers`, and ranks on first page of Google for `"open source AirConsole alternative"` within 6 weeks of the why-air-jam doc shipping.
- **Section 3**: The dev.to article stays in the top of its tag pages for at least 48 hours and accrues >100 reactions. HN Show HN reaches at least the front page (top 30).

None of these are stretch goals — they are the floor that justifies the effort.

# Discoverability and Launch Promotion Plan

Last updated: 2026-05-19
Status: actionable plan
Companion to: [discoverability-vision.md](../discoverability-vision.md)

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

- [ ] Rewrite root `title` + `description` in `apps/platform/src/app/layout.tsx`
- [ ] Add `openGraph` + `twitter` blocks to root metadata
- [ ] Create `opengraph-image.tsx` and `twitter-image.tsx`
- [ ] Wire per-route `generateMetadata` for blog, docs, arcade
- [ ] Add `Organization` + `SoftwareApplication` JSON-LD to root layout
- [ ] Add `BlogPosting` JSON-LD to blog post template
- [ ] Add `apple-touch-icon.png` and `manifest.webmanifest`
- [ ] Manually verify with [Google's Rich Results test](https://search.google.com/test/rich-results) and [opengraph.xyz](https://www.opengraph.xyz/)
- [ ] Request re-indexing in Google Search Console after deploy

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

- [ ] Verify property in Google Search Console, submit `sitemap.xml`
- [ ] Same for Bing Webmaster Tools
- [ ] Update GitHub repo description + topics to include "airconsole-alternative" framing
- [ ] Update npm package descriptions + keywords
- [ ] Author `/docs/why-air-jam` (or equivalent) with the framing in H1 + body
- [ ] Audit all docs routes render under SSR with JS disabled

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

- [ ] Generate `/llms.txt` and `/llms-full.txt` at build time from docs MDX
- [ ] Link `ai-pack` from docs nav and home page agent section
- [ ] Audit `robots.ts` to explicitly allow major AI crawlers
- [ ] Submit MCP connector to `modelcontextprotocol/servers`
- [ ] Submit MCP connector to `punkpeye/awesome-mcp-servers`
- [ ] Verify Anthropic / OpenAI / Perplexity can fetch and summarize the home page cleanly (test with each)

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

- [ ] Update GitHub repo topics
- [ ] Update npm package keywords across `@air-jam/sdk`, `@air-jam/server`, `create-airjam`
- [ ] Open PRs to each `awesome-*` list listed above
- [ ] Identify and contact a Product Hunt hunter (target launch: TBD, post 1.x metadata work)
- [ ] Prepare PH assets: demo video, GIFs, screenshots, tagline
- [ ] Submit origin story to Lobsters and Indie Hackers
- [ ] Schedule Reddit posts (r/gamedev, r/webdev) with non-launch framing

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

- [ ] Set/confirm 4 tags on dev.to (webdev, opensource, javascript|typescript, gamedev)
- [ ] Set/confirm 1000×420 cover image on dev.to
- [ ] Author X/Twitter thread linking dev.to, post
- [ ] LinkedIn version of the post, link dev.to
- [ ] Bluesky + Mastodon versions
- [ ] zerodays Slack share, ask for reactions
- [ ] 5–10 targeted DMs to relevant network
- [ ] Cross-post to Hashnode with `canonical_url = dev.to URL`
- [ ] Cross-post to Medium with canonical link to dev.to
- [ ] Submit origin story to HN as Show HN (Tuesday/Wednesday morning Pacific, with prepared title + first comment)
- [ ] Respond to every dev.to comment within hours for first 72 hours
- [ ] Respond to every HN comment for first 4 hours after submission

---

## Execution order (suggested)

This plan is large but the dependencies are loose. A sensible order:

1. **This week**: Section 1 (site polish — metadata, OG image, JSON-LD) and Section 3.1–3.3 (dev.to tags, cross-posts, social amplification). Both can ship in parallel.
2. **Next week**: Section 2.2 (agent surfaces — `llms.txt`, MCP registries, `robots.ts` audit) and Section 2.3 (curated list PRs).
3. **2–3 weeks out**: Section 3.4 (HN Show HN), after metadata + OG cards are live so the link previews well when HN comments are shared elsewhere.
4. **Post 1.x release / when v1 lands**: Product Hunt launch (Section 2.3), with all metadata, OG cards, MCP registry presence, and `awesome-*` PRs already shipped — so anyone who clicks through lands on a complete, professional surface.

## Definition of done

For each section the "done" state is concrete:

- **Section 1**: Sharing any `airjam.io` URL on X / Discord / iMessage renders a rich card with image, title, and description. Google search for "Air Jam" returns a card with logo, title, and at least one sitelink within 4 weeks.
- **Section 2**: Air Jam appears on at least 3 `awesome-*` lists, in `modelcontextprotocol/servers`, and ranks on first page of Google for `"open source AirConsole alternative"` within 6 weeks of the why-air-jam doc shipping.
- **Section 3**: The dev.to article stays in the top of its tag pages for at least 48 hours and accrues >100 reactions. HN Show HN reaches at least the front page (top 30).

None of these are stretch goals — they are the floor that justifies the effort.

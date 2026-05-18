# Blog Authoring Guide

Last updated: 2026-05-18  
Status: current guide

Related docs:

1. [./local-development-guide.md](./local-development-guide.md)
2. [../working-agreements.md](../working-agreements.md)

## Purpose

This guide is the canonical instruction set for writing, previewing, and
cross-posting Air Jam blog articles. It is written for humans and agents both.
Every blog task starts here.

## Mental Model

One article = one folder under `content/blog/<slug>/`. The folder contains the
canonical source. Everything else (the platform registry, the dev.to-ready
markdown, the syndication frontmatter) is derived.

- `post.mdx` — article body. Portable Markdown. Stays cross-posting-friendly.
- `post.meta.ts` — platform metadata (title, summary, author, published flag).
- `devto.config.ts` — optional. Dev.to-specific frontmatter. Add only if the
  article should be cross-posted to dev.to.
- `apps/platform/public/blog-assets/<slug>/` — images, gifs, svgs, videos.
  Served by Next.js as `https://airjam.io/blog-assets/<slug>/<file>`. Single
  source for both airjam.io and any syndication target.
- `dev-to.md` — **generated**, gitignored. Produced by the export script.
  Never hand-edit.

The platform's blog listing pulls from `post.meta.ts`. Dev.to syndication pulls
from `post.mdx` and `devto.config.ts` through a small exporter. There is no
duplicate-edit step.

## Lifecycle

### 1. Create a draft

```bash
pnpm run repo -- content blog new my-new-post \
  --title "My new post" \
  --author "Tim Vučina" \
  --devto
```

This scaffolds:

- `content/blog/my-new-post/post.mdx`
- `content/blog/my-new-post/post.meta.ts` (with `published: false`)
- `content/blog/my-new-post/devto.config.ts` (if `--devto`)
- `apps/platform/public/blog-assets/my-new-post/` (empty)

### 2. Write

Edit `post.mdx`. Image references go in the public asset folder and use
root-relative paths:

```markdown
![Alt text](/blog-assets/my-new-post/my-image.png)
```

Use `/blog-assets/...` (root-relative). The exporter rewrites these to absolute
`https://airjam.io/...` URLs when generating the dev.to file.

### 3. Register the article on the platform

```bash
pnpm run repo -- content blog generate
```

This regenerates the platform's blog registry. Required before the article
shows up in the platform's blog index.

### 4. Preview the draft locally

The platform hides unpublished posts by default. To preview drafts:

```bash
PLATFORM_INCLUDE_DRAFTS=1 pnpm --filter platform dev
```

Then open the article:

```bash
pnpm run repo -- content blog open my-new-post
```

This opens `http://localhost:3000/blog/my-new-post` in your default browser.

### 5. Export for dev.to (when cross-posting)

```bash
pnpm run repo -- content blog export-devto my-new-post
```

Writes `content/blog/my-new-post/dev-to.md` (gitignored build artifact). Paste
the contents of that file into dev.to's editor. Dev.to's preview tab will
render exactly what readers will see.

### 6. Publish

Flip `published: true` in `post.meta.ts`. Run `pnpm run repo -- content blog generate`
again. Deploy. On dev.to, paste the regenerated `dev-to.md` and click Publish.

## Validation Gate

Before merging or deploying:

```bash
pnpm run repo -- content blog check
```

This asserts:

- The generated blog registry is fresh (no missed `content blog generate`).
- Every `/blog-assets/...` reference in any `post.mdx` resolves to a real file.
- Every article with a `devto.config.ts` exports cleanly without errors.

CI should run this on every PR that touches `content/blog/` or
`apps/platform/public/blog-assets/`.

## Asset Conventions

- All assets for an article live in
  `apps/platform/public/blog-assets/<slug>/`. Not in `content/blog/<slug>/media/`.
- File names match what `post.mdx` references. Renames require updating both.
- Hosted SVGs render on dev.to via `![](url)` markdown. **Inline `<svg>` tags
  in markdown body are stripped by dev.to.** Always reference SVGs by URL.
- GIFs work everywhere but are heavy. For airjam.io-only articles, prefer MP4
  via custom MDX components (future work). For cross-posted articles, GIFs are
  the lowest-common-denominator.

## Voice and Cross-Post Discipline

For articles cross-posted to dev.to, HN-linked, or otherwise public:

- Use plain Markdown inside `post.mdx`. No MDX-specific components in the body
  unless that component has an equivalent or fallback in `dev-to.md`.
- Canonical URL points at airjam.io. The exporter sets this automatically.
- Tags differ slightly: dev.to wants 1–4 lowercase alphanumeric tags. The
  platform tags can be richer.

## Cleaning Up Unpublished Posts

To remove a draft entirely:

1. Delete the folder `content/blog/<slug>/`
2. Delete `apps/platform/public/blog-assets/<slug>/`
3. Run `pnpm run repo -- content blog generate`

To hide without deleting, flip `published: false` and regenerate.

## Troubleshooting

**"Blog asset references are broken"** — a `post.mdx` references an image that
doesn't exist under `public/blog-assets/`. Fix the path or add the file.

**"Generated blog source is stale"** — you edited a `post.meta.ts` without
re-running `content blog generate`. Run it.

**Draft doesn't appear at localhost:3000/blog/<slug>** — either the article is
not in the registry (run `content blog generate`) or you forgot
`PLATFORM_INCLUDE_DRAFTS=1` in the dev command.

**Dev.to article looks different from airjam.io** — expected. Dev.to has its
own theme, typography, and code-highlighting. Only the content and structure
are guaranteed to match.

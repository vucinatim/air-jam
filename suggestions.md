# Suggestions

## High-Impact Follow-Ups

1. Add a CI docs-crawl check that fetches built HTML for each docs route and fails if no `<pre><code>` appears on pages containing fenced code.
2. Add per-page MDX metadata exports (`title`, `description`) and build JSON-LD for docs pages to improve search snippet quality.
3. Generate searchable heading anchors from MDX at build-time and merge them into `docs-index` so command search can include section-level results without hardcoding.

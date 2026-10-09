# Dependency repairs

## tsup 8.5.1 directory watching

`tsup@8.5.1.patch` preserves directory watch targets when tsup expands paths
through tinyglobby. Without it, `tsup --watch src` can start successfully while
ignoring subsequent SDK source changes. Both initial watch-target discovery and
the watcher ignore predicate must include directories.

The pnpm lockfile pins this repair. The regression in
`scripts/repo/runtime/sdk-watch.test.mjs` edits a real SDK source fixture and
requires a rebuilt artifact; a successful watcher startup alone is not proof.

Remove the patch when the upstream version handles directory targets correctly
and that regression passes without the patch. Database driver repairs belong to
the private product repository, not the public framework.

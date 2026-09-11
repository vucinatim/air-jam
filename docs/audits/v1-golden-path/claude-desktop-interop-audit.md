# Claude Desktop Interoperability Audit

Date: 2026-09-11
Status: passed candidate secondary-client local proof; frozen-candidate rehearsal remains separate
Work item: `G2-04`

## What This Proves

The installed Claude Desktop `1.52386.0` exposes **Settings > Developer >
Local MCP servers > Edit config**. Air Jam was not registered. The existing
unrelated connector was left unchanged, and no client configuration, login,
permissions, or production credentials were changed.

The current Air Jam Desktop profile had two concrete defects:

1. it launched `pnpm exec airjam-mcp` without a project directory, although
   Desktop configuration is client-global and the server discovers its project
   from its working directory
2. its `installCommand` suggested `claude mcp add`, which registers with Claude
   Code rather than Claude Desktop

The corrected profile emits `pnpm --dir <absolute game directory> exec
airjam-mcp` and no purported Desktop install command. The portable and Codex
profiles are unchanged. Package documentation describes merging the entry
without overwriting other connectors, checking the live connection, and
resolving the executable path if Desktop cannot find `pnpm`.

This preserves the existing project-local MCP service and public CLI. No new
installer, client abstraction, extension bundle, or lifecycle framework was
introduced.

## Validation

- narrow MCP and public CLI package builds passed
- focused setup tests passed: six tests, including absolute paths, spaces,
  relative-path normalization, unchanged portable/Codex declarations, and no
  misleading Desktop install command
- the complete MCP server suite then passed: 14 tests in 1.35 seconds
- the two-file changed gate passed in 1.854 seconds; an earlier attempt ran
  during build-output replacement and failed on temporarily missing declaration
  files, so the successful check ran after the build completed
- the rebuilt public CLI rendered the corrected Desktop profile as JSON
- launching the rendered `pnpm --dir ... exec` prefix from an unrelated
  directory resolved the intended working directory; this checks directory
  handling, not MCP discovery or an independent client session
- the local homepage still returned HTTP 200 and the current unified signal
  log contained no errors after the rebuild

## Independent Client Proof

The installed client's configuration UI is evidence that the raw profile can
still be tested; it is not certification that Air Jam works through that
client. Anthropic's [local MCP guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
recommends desktop extensions, but that recommendation alone does not justify
replacing a supported configuration path before testing it.

Public registry inspection found `create-airjam` and `@air-jam/mcp-server`
latest at `0.9.2`, while this source candidate is `0.9.3`. The new
`@air-jam/cli` package is not yet publicly available. Use an isolated candidate
registry for prerelease proof; do not publish packages merely to bypass this
preflight or count the old public package as the current candidate.

The maintainer subsequently approved a temporary local connection. The
[retained independent run](./evidence/g2-04-20260911/README.md) passed through
Claude Desktop's incognito Chat mode against registry-installed `0.9.3`
candidate packages. The run controller prepared the clean project and client
configuration; Claude independently discovered and operated it without the
monorepo, a prior transcript, or follow-up implementation hints.

Claude opened room `R8SM`, read the initial counter, invoked the advertised
`player:tap`, and confirmed `0 → 1` with a separate authoritative read. It
closed the session, verified the handle was gone, stopped the development
process it had started, and recovered the original empty process baseline.
The run controller independently checked cleanup, removed the temporary
registration, verified the original connector was unchanged, and restarted
Desktop to unload the test server.

The install proof also caught four stale generated starter archives left by
the earlier reference-game changes. They were regenerated and verified before
the successful candidate install. The earlier failed preparation remains
described in the evidence rather than being treated as a passing attempt.

This closes `G2-04`, not the final immutable-candidate rehearsal or the full
coding lifecycle in a second client. No public registry publication, push,
merge, production deployment, or new extension system was needed.

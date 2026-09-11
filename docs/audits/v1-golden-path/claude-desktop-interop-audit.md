# Claude Desktop Interoperability Audit

Date: 2026-09-11
Status: preflight and setup correction; independent client proof remains open
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

## Independent Proof Still Required

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

The remaining run must connect Claude Desktop to an isolated registry-installed
game, independently discover tools/resources, and open, read, invoke, and close
a semantic session without the monorepo or prior agent transcript. Retain the
actual client/tool evidence and remove the run-specific registration afterward.
Permission to add that temporary connection to the maintainer's existing
Desktop app was requested; until supplied, its configuration stays unchanged.

No independent Claude session, registry publication, push, merge, or production
deployment is claimed by this audit.

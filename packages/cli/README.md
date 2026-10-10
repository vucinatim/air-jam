# `@air-jam/cli`

The canonical project and operator CLI for Air Jam.

`create-airjam` only creates a project. The generated project then depends on
this package for its complete ongoing lifecycle: development, inspection,
semantic game control, AI-pack maintenance, MCP setup, hosted game records,
and releases.

## Discover the contract

```bash
pnpm exec airjam --help
pnpm exec airjam session --help
pnpm exec airjam mcp --help
pnpm exec airjam release --help
pnpm exec airjam docs --help
```

## Machine-first local lifecycle

These commands return stable JSON documents and are safe for terminal agents
to compose:

```bash
pnpm exec airjam status --dir .
pnpm exec airjam evaluate --dir .
pnpm exec airjam dev start --dir .
pnpm exec airjam session open --dir .
pnpm exec airjam session read <session-id> --dir .
pnpm exec airjam session invoke <session-id> <action-id> --payload '{}'
pnpm exec airjam session capture <session-id> --dir .
pnpm exec airjam session close <session-id> --dir .
pnpm exec airjam dev stop --dir .
pnpm exec airjam reset local --dir .
```

`airjam evaluate` is the canonical complete evaluation contract. It runs
typecheck, lint, tests, and the production build, then returns every gate in one
stable `air-jam-complete-evaluation/v1` JSON document. The MCP equivalent is
`airjam.evaluate`; use individual quality gates only to narrow a failure.

A semantic session starts or reuses the canonical Air Jam dev process, opens a
real controller/runtime connection, exposes the game's published semantic
actions and authoritative snapshot, and releases processes it created when the
last session closes. The project-local broker is authenticated, loopback-only,
and can capture canonical desktop-host and phone-controller screenshots into
the owning project's `.airjam/artifacts/session-visuals` directory. It can be
inspected or stopped explicitly:

```bash
pnpm exec airjam session broker status --dir .
pnpm exec airjam session broker stop --dir .
```

## Agent clients

The Air Jam MCP exposes the same underlying project, development, semantic
session, quality, and release services to Codex, Claude, and other MCP clients.

```bash
pnpm exec airjam mcp doctor --dir . --json
pnpm exec airjam mcp init --dir .
pnpm exec airjam mcp config --profile portable --dir .
pnpm exec airjam mcp config --profile codex --dir .
pnpm exec airjam mcp config --profile claude-desktop --dir .
```

The portable declaration is `.mcp.json`. Codex and Claude Desktop use their
own client registration formats; `mcp doctor` reports declarations and actual
client registrations separately.

The Claude Desktop profile targets the selected game's absolute directory.
Merge its `airjam` entry into Desktop's configuration through **Settings >
Developer > Edit config**, preserving other connectors, then restart Desktop
and check its connection status. Rendering a profile does not register it;
`claude mcp add` is a Claude Code command, not a Desktop installer. See the
[`@air-jam/mcp-server` setup guide](https://github.com/vucinatim/air-jam/tree/main/packages/mcp-server#discover-and-connect) for details.

## Platform machine authentication

CLI and MCP platform operations share one authentication transport. A saved
login is bound to the platform origin that issued it: changing the platform URL
cannot silently send that saved token to another server. Log in to the other
platform, or deliberately supply its own explicit token and target instead.
Equivalent host casing, default ports, and trailing slashes do not change the
origin. Self-hosted HTTPS targets are supported; HTTP is limited to loopback
development addresses.

Invalid target URLs fail rather than falling back to localhost. API paths stay
on the selected origin, and redirects are rejected rather than replaying
tokens or device codes elsewhere. Device login stores the requested platform
only after the response confirms the same origin. This destination boundary
does not change token scopes, expiry, or server-side ownership checks.

## Framework guidance ownership

The CLI owns the canonical managed framework pack under `docs/airjam/`.
Project instructions (`AGENTS.md`, `CLAUDE.md`, and `skills/`) are copied only
during bootstrap and belong to the project afterward.

```bash
pnpm exec airjam ai-pack status --dir . --json
pnpm exec airjam ai-pack diff --dir . --json
pnpm exec airjam ai-pack update --dir . --json
```

AI-pack updates replace managed framework guidance only. They never overwrite
project-owned agent instructions or skills.

## Programmatic assets

The installed package includes all public creator pages and their portable
metadata. Read them without an account, network request or source checkout:

```bash
pnpm exec airjam docs list --json
pnpm exec airjam docs read sdk/ui-components --json
```

`readDocumentationSnapshot()` from `@air-jam/cli/documentation` returns the
package version and verified MDX content, page identities and navigation
metadata. Content and metadata originate in the public repository's
`content/docs/` catalog. The private website supplies rendering components and
generates its build inputs from this snapshot; it does not maintain a second
authored copy. MDX component names are presentation slots, not imports of private
application code. Only trusted package documentation is compiled this way,
never creator-uploaded MDX. The API reads do not write project files.

Scaffolding code can resolve the two explicit asset roots and portable MCP
declaration through `@air-jam/cli/scaffold`. Vite projects use
`@air-jam/cli/vite-config`.

Repository-owned development orchestration can use the typed
`@air-jam/cli/development` entrypoint for local network discovery, environment
loading, runtime topology construction and secure-development state. It shares
the CLI implementation; consumers do not import files inside its source tree.
Reading state or constructing a topology does not initialize certificates or
change tunnel configuration. `runSecureInitCli()` is the explicit setup action,
with the same arguments and effects as `airjam secure:init`.

`readAiPackSnapshot()` from `@air-jam/cli/ai-pack` returns the verified
packaged manifest and a `Map<string, Buffer>` of managed file contents. Consumers
can serve that exact snapshot without a CLI source checkout, network request or
second pack generator. Invalid manifests, paths or content hashes fail the read;
it does not modify the package or a creator's project.

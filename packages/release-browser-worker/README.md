# Release Browser Worker

Dedicated Playwright protocol worker for Air Jam hosted release screenshot capture and moderation.

## Purpose

This package exists so release screenshot capture and image moderation do not live inside:

1. the platform request runtime
2. the realtime Railway server

The release-processing path connects to this worker through a Playwright websocket endpoint for browser capture. This is a separate process, not a separate authorization or publishing system.

## Runtime Contract

Each authenticated `/ws` connection owns one Chromium process tree, network
namespace and egress budget. There is no shared long-lived game browser. Every
environment requires an access token. Websocket connections must supply exactly
one `Authorization: Bearer <token>` value; missing, malformed, or mismatched
credentials are rejected. Other websocket paths are rejected too.

The worker admits at most two simultaneous captures, matching existing job
admission rather than adding a second queue. A capture is terminated after 120
seconds, on caller disconnect, or on exhausted egress budget. Shutdown closes
owned transports, browsers and proxies.

The platform should point:

1. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`

at the public websocket endpoint for this service.

## Railway Setup

Create a dedicated Railway service for this package.

Recommended setup:

1. source repo: `vucinatim/air-jam`
2. branch: `main`
3. root directory: repo root
4. config-as-code path: `/packages/release-browser-worker/railway.json`
5. builder: Dockerfile
6. Dockerfile path: `packages/release-browser-worker/Dockerfile`

The supported target is the non-root Linux worker image with Chromium sandboxing
enabled. It additionally needs unprivileged user/network/PID namespaces. The
launcher brings up only namespace-local loopback, then drops its capabilities;
Chromium and the Unix-socket bridge cannot add a direct outbound route. The
browser inherits only its own execution settings, not worker/provider secrets.
Disabling sandboxing or falling back to native platform execution is unsupported.
The default listening port is `8080` unless the deployment supplies `PORT`.

The worker also exposes:

1. `GET /health` for Railway healthchecks, backed by an actual isolated blank-page
   probe (cached for 30 seconds when idle) or a currently running owned browser
2. authenticated `GET /` for the transport path and capacity
3. authenticated websocket proxying on `/ws`

## Network Boundary

Both Chromium traffic and Playwright's Node-side private-asset fetches use the
same worker-local HTTP/CONNECT proxy. Each connection resolves A and AAAA records,
rejects the entire answer set if any address is non-public, and dials a vetted
numeric address. The private `@air-jam/network-policy` package owns classification;
there is no worker-specific CIDR copy. Resolver queries intentionally do not use
`/etc/hosts` or private search aliases.

HTTP, WS and opaque CONNECT for HTTPS/WSS share that policy. TLS remains
end-to-end. Proxy destinations and credentials are not logged. Per capture,
traffic is limited to 512 MiB and 10,000 requests/tunnels, with 32 simultaneous
connections, 10-second DNS/connect deadlines and 30-second idle timeouts. The
total budgets accommodate the existing 250 MiB/5,000-file release allowance;
they are capture-worker bounds, not new player/session limits.

## Environment Variables

Required env:

1. `AIRJAM_BROWSER_WORKER_ACCESS_TOKEN`: a randomly generated secret of 32–512 printable ASCII characters, with no whitespace. Length/format validation does not prove randomness; use a cryptographic generator. Keep this value out of logs, screenshots, committed files, and websocket URLs.

Optional env:

1. `AIRJAM_BROWSER_WORKER_HOST`
2. `AIRJAM_BROWSER_WORKER_PORT`: a complete decimal integer from `1` through `65535`
3. `AIRJAM_BROWSER_WORKER_HEADLESS`
4. `AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX`: defaults to `true`; explicitly setting `false` rejects startup
5. `AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH`

In Railway, `PORT` is normally injected automatically and should be preferred.

## Platform Wiring

Once the service is live, set:

1. `AIRJAM_RELEASES_BROWSER_WS_ENDPOINT`
2. `AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN`

on the platform deployment to the worker's stable public websocket endpoint.

`AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN` must match
`AIRJAM_BROWSER_WORKER_ACCESS_TOKEN` on the worker deployment.

Example shape:

```text
wss://<railway-public-domain>/ws
```

The `/ws` path is stable across worker restarts and deployments.

## Local Development

Discover and inspect through the package CLI:

```bash
pnpm --filter @air-jam/release-browser-worker... build
pnpm --filter @air-jam/release-browser-worker exec node dist/cli.js --help
pnpm --filter @air-jam/release-browser-worker exec node dist/cli.js health --url https://<worker-origin>
```

Health writes JSON and exits nonzero when unhealthy. `start` is the default
command; use SIGINT/SIGTERM for owned cleanup. Run it in the worker image, not a
native macOS browser. A local platform must connect to this same isolated lane,
with generation assets on a publicly reachable approved release origin. Private
or loopback asset origins are not a production-policy escape hatch.

## Security Scope

Focused checks run with `pnpm --filter @air-jam/release-browser-worker test`.
Opt into actual Chromium HTTPS/WSS and Node-side proxy-inheritance fixtures with:

```bash
AIR_JAM_TEST_RELEASE_CAPTURE_BROWSER=1 pnpm --filter @air-jam/release-browser-worker exec node --import tsx --test src/egress-proxy.test.ts
```

These use owned listeners and a deliberately non-secret test certificate. They
do not install system trust or prove the Linux namespace. Normal TLS identity,
hostname and trust rejection remain covered by the ordinary test suite.

The raw Playwright protocol is an internal trusted-caller interface, not a public
agent product. Chromium's sandbox remains the untrusted-JavaScript boundary;
network and process namespaces add egress containment and process ownership, not
a claim of a separate filesystem/VM boundary.

The built-image proof is deliberately separate from ordinary source tests:

```bash
docker build -f packages/release-browser-worker/Dockerfile -t airjam-release-browser-worker:proof .
docker run --rm --init --security-opt seccomp=<playwright-seccomp-profile.json> airjam-release-browser-worker:proof pnpm --filter @air-jam/release-browser-worker test:image
```

Use the [official profile matching Playwright 1.58.2](https://github.com/microsoft/playwright/blob/v1.58.2/utils/docker/seccomp_profile.json).
Docker's default seccomp policy rejects namespace startup; the worker exits
unhealthy rather than disabling isolation. The profile changes only this owned
container's runtime, not the host or Railway configuration.

The proof runs the compiled worker, authenticates its real Playwright transport,
loads owned HTTP/HTTPS assets and WS/WSS, captures a PNG, exercises private-header
driver fetches, denies loopback and redirect escape, inspects the browser's
network routes/capabilities/environment, and verifies child-process cleanup.
Only already policy-approved numeric dials are redirected to fixture listeners.
An owned browser context trusts the fixture certificate; production TLS trust
is unchanged. Run this in an isolated container without provider credentials.

**Delivery status:** local ARM64 image proof passed on 2026-10-03. That is not an
AMD64 Railway deployment, a production unpublished-release capture, or security-
gate closure. Reviewed delivery and exact provider validation remain pending.
See the
[bounded containment plan](../../docs/plans/release-browser-worker-containment-plan.md)
for feasibility evidence and unresolved validation, not a security-closure claim.

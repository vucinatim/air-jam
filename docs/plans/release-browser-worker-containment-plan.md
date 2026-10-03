# Release Browser Worker Containment

Last updated: 2026-10-03
Status: active bounded architecture plan

Finding authority: [AJ-SEC-004](../audits/v1-security/threat-model-audit.md#aj-sec-004--browser-worker-can-fail-open-and-gives-untrusted-pages-privileged-egress).
Execution authority remains `G5-02` in the release manifest. This is not another
release tracker or a replacement for the [1.0 execution plan](./v1-release-execution-plan.md).

## Product contract

Opening an uploaded game for moderation must not give that game our credentials,
private-network access, or an unbounded browser lifetime. Normal JavaScript,
WebGL, public game assets/fonts, and public realtime connections remain usable.
No player permission prompts, creator approval flow, new moderation queue, or
additional hosting provider is part of this change.

Keep the existing platform job/moderation owners and existing dedicated browser
service. Its authenticated Playwright transport remains an internal trusted-
caller interface; it is not a new public agent product. Ordinary local game
development continues through the existing dev harness, not this worker.

## End-state boundaries

1. **Inspection authority:** one signed, expiring game/release/generation token.
   The platform's capture path attaches it only to that generation's canonical
   asset origin/path. No context-wide credential and no inherited redirect
   header. Unpublished assets must still load. Old generationless tokens are
   removed, not supported through a compatibility path.
2. **Worker admission:** a required strong generated secret in every environment;
   strict bearer parsing, secret-safe diagnostics, authenticated HTTP/WS entry,
   and real browser health. No missing-token or sandbox-disabled fallback.
3. **Browser execution:** non-root Chromium with its sandbox enabled; no worker
   credentials in browser child environment. A Linux network namespace has no
   direct outbound route. The browser may reach only the controlled egress path.
   Namespace startup/cleanup and nested Chromium sandboxing must be proven,
   not inferred from an environment variable.
4. **Controlled egress:** one bounded streaming HTTP/CONNECT path in the existing
   worker, using the canonical public-address classifier and pinning validated
   addresses at connection time. Preserve TLS hostname verification, public
   assets and WSS. Deny private, loopback, link-local, metadata, special-use and
   mixed public/private DNS answers. Recheck new destinations after redirects.
   No second DNS lookup may bypass the validated address. A private local bridge
   from the browser namespace is an implementation detail, not another public
   service or another queue. Its feasibility and capability dropping still need
   the owned-container proof below.
5. **Resource ownership:** keep the existing global-two/per-creator-one capture
   job admission. Worker execution still needs a hard lifetime, owned process/
   context cleanup, bounded page creation, transfer budgets and output size.
   Capture the declared viewport, not creator-controlled full-document height.
   Existing operation failure/retry classification owns failed jobs.
6. **One untrusted execution lane:** hosted capture must use the isolated worker,
   including when run locally. Remove the platform's unsandboxed executable-path
   fallback as part of integration; do not keep it as a convenience escape hatch.
   This does not remove the trusted local game-development browser harness.

The streaming egress design is subject to actual container proof before it is
treated as implemented. In particular, Playwright's API-request fetches used for
private assets must use the same validated egress policy; protecting Chromium
while leaving its Node-side fetches unbounded would not close the finding.

## Evidence-led delivery

The existing credential and capture owners can be corrected independently and
remain valid in the final architecture. That work is underway locally: scoped
tokens, redirect-safe private fetching, explicit connect/screenshot timeouts,
viewport capture, required worker authentication and non-root/sandbox defaults.
Do not merge or call the worker contained based only on these changes.

The worker-owned isolation/egress boundary and lifecycle integration are now
implemented locally, and the platform launch fallback is removed. The package
CLI exposes help, start and JSON health. These remain unmerged implementation,
not a completed containment claim. Next prove the exact worker image and full
capture path, including hostile-network and cancellation cases.
Run one final combined batch and one Canonicalizer pass only after this coherent
worker batch is complete. Native GitHub review follows the normal green-PR gate.
Production rollout and exact-candidate proof remain separate explicit actions.

## Acceptance proof

- Missing/malformed credentials and unsupported sandbox execution fail closed;
  a healthy HTTP process with a dead browser is not reported healthy.
- Owned-container hostile fixtures cannot reach a local listener, metadata,
  private/mixed/rebound DNS, redirect escape, WebSocket bypass, service worker,
  popup or direct-network bypass. Only fixture-controlled endpoints are used;
  do not probe actual metadata or unrelated private services.
- Real unpublished host/chunk/image/font assets and public realtime connections
  work. Inspection credentials reach only the exact generation, including under
  redirect tests. The browser environment has no worker/provider secrets.
- Hanging/oversized/many-page fixtures terminate within the declared budgets;
  both normal completion and cancellation leave no owned browser/process/socket.
- Exact container evidence identifies the image/source and runtime settings.
  Source checks and a live-runtime feasibility probe are not substituted for
  that deployment proof.

## Integrated image checkpoint — 2026-10-03

The Dockerfile now builds locally; no image pruning, volume deletion or host
security change was needed. The ARM64 image
`sha256:ab0eecb3fa1ac89527c9499d07775075242661bab6011ffa5542558fb36e8ede`
passed the compiled-worker proof in `runtime/image-proof.mjs` using the official
Playwright `v1.58.2` seccomp profile. Default Docker seccomp rejected startup and
the worker exited unhealthy, as required.

The real authenticated transport loaded owned HTTP/HTTPS assets and WS/WSS,
captured a PNG, performed a private-header Node-side asset fetch, denied both
direct loopback and redirect escape before the fixture listener was reached,
and cleaned up every inspected Chromium process. The outer browser had no
effective capabilities, no outbound route and no worker token in its environment;
all inspected Chromium processes had `no_new_privs`. Chromium's nested sandbox
zygote legitimately holds capabilities inside its own user namespace, so the
initial blanket zero-capability assertion was corrected to inspect the browser
that owns the egress namespace, not disable Chromium sandboxing.

Only policy-approved public numeric dials were redirected to owned listeners.
The fixture browser context trusts its test certificate; production TLS policy
and system trust remain unchanged. This is local image proof, not a production
AMD64 image or exact unpublished-release capture. Protected review, coordinated
delivery, provider health and live release capture remain required before
closing `G5-02`. The historical checkpoint below is retained as the reason this
work originally stopped, not current Docker availability.

## Railway AMD64 Proof — 2026-10-03: Deployment Blocked

An empty, owned environment `worker-proof-oct3`
(`781f83a9-6892-4ce9-b963-882227463cf9`) contained only a disposable worker
(`3d1b6f0a-3375-4289-b31e-efc7d37a12a8`). No production database, app credential,
storage authority or worker token was copied. The compiled-image proof was a
pre-deploy command, so a failing capture could not start a serving worker.

The actual Dockerfile built AMD64 image
`sha256:92c4985dc7942dc4f89791cde3dd1209adea3acb971fef391ef7add98d5fe86a`
in deployment `2f09cb8f-12c1-4308-aec9-e12060e72f39`. Its browser health
check failed before capture. A same-image debug retry
`e8176704-c364-4aff-b4a8-e0b21ff00d6e` failed the same check. Configuration
diagnostic deployment `6e8e6621-7b28-4261-af11-c62ce1b31a33` then printed:

```text
uid=1000(pwuser) gid=1000(pwuser) groups=1000(pwuser)
unshare: unshare failed: Permission denied
```

The probe used the launcher's user/network/PID namespace flags and only `true`,
not creator code. The provider manifest selected `europe-west4-drams3a`, the
existing production region. An explicit redeploy `621ffb3e-74d8-4bb2-b1e6-129fe6938562`
also ended `FAILED` without additional runtime logs. This is evidence that the
new deployment cannot use the required namespace path, not an attestation of
containment or a diagnosis of the provider's specific denying policy. September's
older root-started-container probe does not contradict this result.

Do not remove sandboxing, run creator capture as root, or claim that proxy
configuration alone replaces direct-egress isolation. A supported worker
deployment boundary must be established before this batch can safely deploy.
The disposable service/environment are removed after recording evidence; no
production deployment or migration was attempted. Reviewer OAuth also expired,
so Canonicalizer did not run and protected delivery remains pending.

Tim then authorized a separate GPT-6.1 Sol reviewer because Claude is out of
credits. Its read-only integration review at `36551396` confirmed no new
actionable source defect, retained this provider failure as release-blocking,
and found no justified source-only relaxation. It checked the pinned Playwright
proxy inheritance for Node-side private asset fetching. This review does not
identify the denying policy or establish a supported deployment configuration;
final green-PR GitHub review and deployed capture proof remain outstanding.

### Actual Service Runtime Follow-Up

To distinguish a pre-deploy-job restriction from the normal service runtime,
the unchanged compiled worker was uploaded to a second empty owned environment
`worker-runtime-proof-oct3` (`c172e10a-7970-49b0-9c0e-57b17744090c`), with
only service `e3c4d2ab-ec6e-423a-a683-a6c864834f3e`. Its start command first
probed the launcher's namespace flags with `true`, then would run the same
compiled capture proof and ordinary worker CLI. No pre-deploy command or
production credentials were used.

Deployment `b3625b10-b1ea-4596-a210-bb1570640602` built and entered the actual
service runtime with image
`sha256:646f1418bb71d2a0f012e627e456d7f11e62715adaa3544fe8b714a58830d50e`.
Worker and network-policy source matched the reviewed tree; the earlier proof
context's README was synchronized before upload, without a behavioral change.
That runtime also printed UID 1000 and `unshare: unshare
failed: Permission denied`; therefore it could not reach the capture proof or
start a serving worker. Provider health checks then ended in literal `FAILED`.
This closes the pre-deploy-versus-runtime uncertainty without changing worker
source, sandboxing, credentials or production settings. It still does not
identify the provider's denying mechanism. The second disposable service and
environment are removed after retaining this evidence.

## Feasibility observed on 2026-09-12

The existing production worker deployment `40f6a53b-2a34-47eb-b858-e5937b96d2fa`
is successful and its token is present with at least 32 characters. The token
value was not printed. Its current main process is still root and its image
still disables Chromium sandboxing: the new source is **not deployed**.

Bounded SSH diagnostics showed Linux `6.12.12+bpo-cloud-amd64`, seccomp mode `2`,
and enabled unprivileged user namespaces. A dropped-privilege UID 65534 process
successfully created user/network and nested user namespaces. A separate
credential-free UID 65534 Chromium `145.0.7632.6` process launched with
`chromiumSandbox: true`, opened only `about:blank`, and closed. This supports
continuing on the existing provider, not a complete containment claim.
`chrome://sandbox` is unavailable in that headless-shell build; its diagnostic
failure was retained rather than called an attestation.

This is consistent with [Playwright's non-root/sandbox guidance](https://playwright.dev/docs/docker#crawling-and-scraping).
Railway's [outbound-networking documentation](https://docs.railway.com/networking/outbound-networking)
does not supply evidence of the needed private-destination firewall. Do not
equate a static outbound IP or private networking with egress containment.

## Implementation and proof checkpoint — 2026-09-12

- The existing classifier and its 40 tests moved unchanged into the private
  `@air-jam/network-policy` package. The platform and worker share it; cold CLI
  builds, workspace manifests and deployment watch paths are wired. No old
  platform classifier or compatibility re-export remains.
- The worker egress proxy streams HTTP, WS and CONNECT. It validates all A/AAAA
  answers and dials a vetted numeric address. Its 512 MiB/10,000-request totals
  accommodate the existing 250 MiB/5,000-file artifact allowance. Thirty-two
  simultaneous flows are allowed; excess admission receives 503 without killing
  existing flows. Limits are worker safeguards, not new player UX constraints.
- Each authenticated transport owns its browser, private proxy and 120-second
  deadline. The Linux launcher uses user/network/PID namespaces, loopback plus a
  private Unix bridge, then drops capabilities before Chromium and bridge start.
  The worker checks actual blank-page execution, not only HTTP process liveness.
- Platform capture requires the remote authenticated worker, closes popups while
  retaining game iframes, has a 90-second deadline and 5-second cleanup bound,
  closes its browser before storage, and rejects PNG output over 16 MiB. Thirty-five
  capture/config tests and 14 staging-verifier tests pass; PostgreSQL fixtures
  remain opt-in and were not run in this slice.
- Nineteen focused proxy tests pass with the browser opt-in enabled, including owned HTTP/WS/CONNECT fixtures,
  mixed/private/rebound DNS rejection, pinned dialing, fixed budgets,
  concurrency, cancellation and deadlines. DNS/dial redirection in unit fixtures
  is a test seam, not actual namespace proof. The encrypted/browser extensions
  below additionally exercise real HTTPS/WSS, not opaque pretend-TLS bytes.
- Six worker-entry/lifecycle tests run real local HTTP/WS/proxy sockets and
  private temp-directory ownership with only Chromium mocked. They cover exact
  routing/auth, two-capture admission, worker-bearer stripping, confined launch
  options, failed browser health, disconnect/shutdown and the hard deadline.
  A silent half-open peer exposed an actual disconnect gap; cancellation now
  handles client FIN as well as socket close. Three CLI tests cover credential-
  free help, secret-safe failure and healthy/unhealthy JSON exit behavior.
  Package test/typecheck commands use the existing cached dependency-build helper
  so a clean checkout does not depend on previously generated classifier output.

An additional bounded probe on the existing Railway worker launched Chromium
`145.0.7632.6` as UID 65534 inside user/network/PID namespaces with all capabilities
dropped and `no_new_privs` set. It opened only `about:blank` and closed. A proposed
private `/proc` remount was rejected by the provider's mount policy. It was not
made a requirement or bypassed: this design owns networking and process lifetime;
Chromium's sandbox remains the JavaScript execution boundary. It does not claim
separate filesystem or VM isolation.

The exact local image build stopped while downloading the pinned Playwright base
with Docker's `no space left on device`. The host filesystem has free space, but
Docker's own storage is full. Permission was requested to remove only the old
rebuildable Air Jam platform test image and its two stopped test containers;
no database volumes, unrelated resources or Docker settings were changed.

Local default Docker seccomp also rejects unprivileged namespace creation. A
bounded probe using the upstream pinned Playwright namespace-compatible profile
(plus PID-fd syscalls for the newer diagnostic image's `unshare`) confirmed
namespace/capability behavior. That alternate installed diagnostic image is not
substituted for the exact production worker image. Final local runtime arguments,
full unpublished-asset capture, HTTPS/WSS, direct-egress denial and process cleanup
remain to be proven after the disk-space decision. A subsequent repository batch
completed with focused rechecks after a server-test isolation defect was repaired;
see the [integration evidence](../audits/v1-security/threat-model-audit.md#aj-sec-009--reporter-identity-leaks-to-creators-while-public-report-intake-is-unbounded).
This does not substitute for exact-image containment. Canonicalizer, push,
merge and deployment remain pending for this unfinished worker batch.

### Encrypted traffic and driver-fetch proof

The source proxy was subsequently tested with a real owned HTTPS server and
Chromium `145.0.7632.6`, without needing Docker space:

- HTTPS retains the fixture server's certificate fingerprint and SNI hostname;
  untrusted certificates and wrong hostnames fail normal TLS verification.
- Real Chromium loads HTTPS HTML, negotiates a WSS subprotocol and exchanges
  correctly framed text messages in both directions through CONNECT.
- Playwright's Node-side `route.fetch` uses the same proxy for a private-header
  request. Its API-request context is denied an owned loopback URL (403), and
  the fixture listener confirms the forbidden request never arrived.

Only post-policy numeric dials are redirected to owned fixture listeners. The
browser test trusts one test-only certificate SPKI in that child process;
production has no trust override and no system trust store was changed. Strict
TLS trust/hostname rejection is verified separately without that browser override.
This is real protocol/driver integration, **not Linux namespace or deployed-image
containment**. No creator-controlled game or unrelated private endpoint was opened.

Reproduce the 19 tests, including the two opt-in real-browser cases:

```bash
AIR_JAM_TEST_RELEASE_CAPTURE_BROWSER=1 pnpm --filter @air-jam/release-browser-worker exec node --import tsx --test src/egress-proxy.test.ts
```

The run passed in about 1.9 seconds on Node 24. The ordinary worker test suite
skips only those two browser cases and retains strict TLS tests. The first
driver-fetch attempt exposed an over-broad **fixture** dial mock that redirected
the driver's own proxy connection; it was corrected to preserve real connections
to the known local proxy. No production networking change was needed for this
proof. Exact-image tests must still repeat these behaviors inside the namespace.

The follow-through also corrected a capture-owner bug: `page.goto` previously
discarded its HTTP response, so an HTTP error page could proceed to screenshot
storage and image moderation. Capture now requires a successful HTTP response;
403/404/500/503 and missing-response tests verify no screenshot/object is written
and owned browser cleanup still runs. All 13 capture-service tests pass. Existing
job failure/retry ownership is unchanged; this adds no moderation workflow.

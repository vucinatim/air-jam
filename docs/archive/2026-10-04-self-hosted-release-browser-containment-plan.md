# Release Browser Worker Containment

Last updated: 2026-10-04
Status: historical self-hosted design and provider investigation; superseded by the accepted Cloudflare architecture in [the completed capture plan](./2026-10-04-managed-release-screenshot-capture-plan.md)

Finding authority: [AJ-SEC-004](../audits/v1-security/threat-model-audit.md#aj-sec-004--browser-worker-can-fail-open-and-gives-untrusted-pages-privileged-egress).
Execution authority remains `G5-02` in the release manifest. This is not another
release tracker or a replacement for the [1.0 execution plan](./v1-release-execution-plan.md).

## Product contract

Opening an uploaded game for moderation must not give that game our credentials,
private-network access, or an unbounded browser lifetime. Normal JavaScript,
WebGL, public game assets/fonts, and public realtime connections remain usable.
No player permission prompts, creator approval flow, or new moderation queue is
part of this change. Worker placement may change only when required isolation is
proven on the selected host; a feasibility test does not authorize a domain
migration or production switch.

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

## Bee worker feasibility and rejected placement

Tim approved a disposable bee worker test after both Railway launch paths denied
namespace creation. The same reviewed worker and network-policy sources built
as Linux AMD64 and passed the compiled-image containment proof on bee. The proof
also passed with a read-only root, bounded temporary filesystems, two CPUs,
2 GiB memory and 256 processes. Docker's normal AppArmor policy remained active;
only this container used the official pinned Playwright seccomp profile. No host
setting, source sandbox bypass or production credential was required.

Normal service startup, CLI browser health, missing/incorrect bearer rejection,
public HTTPS homepage screenshot and SIGTERM shutdown passed. All owned test
containers are removed; only the rebuildable image and disposable context remain.
The [machine evidence](../audits/v1-security/2026-10-03-bee-worker-image-proof.json)
identifies the image/profile hashes, flags, failed optional checks and limits.
The optional container-wide capability-removal profiles failed health and are
not supported. The required browser-local capability dropping and `no_new_privs`
remain unchanged and proven. This is not a multi-capture load test, stable public
transport, real unpublished-release capture or production cutover.

Read-only DNS/provider discovery found `airjam.io` and `air-jam.app` on
Namecheap's nameservers. Neither is among the configured Cloudflare token's
visible zones; Air Jam's existing R2 account has no tunnel. The standard
[Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/)
requires a domain on Cloudflare. Keeping Namecheap authoritative through
[partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/)
requires Business or Enterprise; that is not justified for this free product.

Tim subsequently rejected production capture on the core private bee server:
container isolation does not justify exposing the host that holds unrelated
private services to uploaded code. The earlier bee service, tunnel and
`air-jam.app` DNS migration recommendation is withdrawn. Preserve the disposable
proof as compatibility evidence, not a placement decision. No permanent service,
Cloudflare zone/tunnel, DNS write or production worker switch occurred.

## Railway first provider investigation

Tim requested Railway-supported isolation first, Cloudflare second. Air Jam's
platform, realtime, database and operations worker remain on Railway. Only the
untrusted capture execution boundary is being evaluated.

[Railway Sandboxes](https://docs.railway.com/sandboxes) are documented as isolated
Linux VMs for on-demand code execution, including production jobs. Their default
`ISOLATED` mode permits outbound internet traffic but denies access to the
environment's private services. Tim approved one disposable trial on 2026-10-03.
It provisioned successfully with `ISOLATED` mode, no domains, a five-minute idle
timeout and no supplied credentials. Native namespace creation failed as both
root and `ubuntu`, including a user-namespace-only probe. The exact denying
mechanism is not established; no source was uploaded and no worker/browser was
launched. Do not disable sandboxing or change provider security settings to make
this pass. Destruction is confirmed by API readback and an empty active list.
This rejects the tested VM path for the current reviewed worker, not every
possible Railway architecture. The CLI still labels Sandboxes experimental.

The fallback trial used
[Cloudflare Browser Run via remote Playwright](https://developers.cloudflare.com/browser-run/cdp/playwright/).
The configured agentic-devtools token verified active but browser acquisition
returned an authentication error; the cause is not established and revocation
must not be inferred. The existing normal-user Wrangler OAuth login included
browser access and worked without another login or credential creation.

One remote CDP session acquired in 2.87 seconds, rendered an owned inline WebGL2
canvas with the expected pixel and captured a bounded PNG. Explicit deletion
returned `closed`; total capture and cleanup took under six seconds. The session
requested an empty allowed-domain list, but no network-denial fixture ran: that
is not guardrail enforcement evidence. No real game or external page was opened.
The browser reported version `128.0.6613.137`; its security maintenance guarantees
need confirmation, rather than assuming patch status from the version string.
Exact identities, results and limitations are retained in the
[provider proof](../audits/v1-security/2026-10-03-capture-provider-proof.json).

Cloudflare is now the next integration candidate. Railway remains the trusted
orchestrator and product host; no bee service, Cloudflare Worker deployment or
Air Jam DNS migration is required for the documented CDP integration. This
changes the connection protocol, so it is not a drop-in endpoint for the existing
Playwright `connect()` call. Keep the existing job/moderation owners and inspection
contract; do not introduce another scheduler or a provider abstraction framework.

The follow-up [routing proof](../audits/v1-security/2026-10-03-cloudflare-routing-proof.json)
confirmed HTTP guardrail denial against the owned public Air Jam origin. A WSS
attempt also failed with HTTP 403, but no handshake response headers were
observed: that error alone does not establish general WebSocket containment.
An owned private HTML/chunk/CSS/WebGL fixture rendered through the existing
generation-scoped routing with a fixture-only transport mapping. Redirects and
other-generation requests were blocked. This is not real R2/game/realtime proof.

CDP's API request client reached an owned caller-side private listener; its IO
does not run inside the remote browser's guardrails. The private routing owner
now uses a bounded public-address fetcher instead of `route.fetch()`. It checks
all A/AAAA answers, dials a validated numeric address, verifies TLS against the
original hostname, strips inherited browser credentials, and fetches one GET/HEAD
response without redirect following. Limits derive from the existing release
file/count/size contract; closing the browser context cancels DNS, sockets and
queued IO. Private asset tests now use explicit network-denial and pinned
owned-fixture checks rather than permitting direct loopback fetching. All 39
targeted fetch/routing/capture tests pass. This local hardening does not migrate
the transport or certify the managed provider boundary.

The separate optional Chromium redirect test is restored in
`release-inspection-routing.browser.test.ts`. It uses the real routing and
fetch owners, mapping only approved numeric dials to an owned HTTP fixture.
Private HTML/chunks load; same-origin and cross-origin redirects and an external
asset reach their destinations without the inspection header. Its loopback
browser permission is fixture-only, not private-network denial evidence. The
43 combined session/fetch/routing/browser cases pass in 1.52 seconds. The initial
attempt lacked the pinned browser binary; after installing it through the
platform's `playwright-core` CLI, the fixture also needed trusted localhost
origins and the same scoped loopback permission as the original browser proof.
Neither correction relaxed production policy. Explicit test-file typechecking
and platform lint pass.

```bash
pnpm --filter platform exec playwright-core install chromium --only-shell
AIR_JAM_TEST_RELEASE_CAPTURE_BROWSER=1 pnpm --filter platform test -- \
  src/server/releases/release-inspection-routing.browser.test.ts
```

The authorized GPT-6.1 Sol canonicality review found no actionable source
blockers in the new delta since `c8b3b676`; its reported missing browser regression
coverage is addressed above. This is local source review, not final GitHub review,
managed-isolation risk acceptance or live uploaded-release proof.

The [built-game proof](../audits/v1-security/2026-10-04-cloudflare-game-capture-proof.json)
now covers fresh Pong output rather than only synthetic HTML. Its real lobby,
JavaScript chunks, stylesheet and sounds rendered through the hardened inspection
owner and existing hosted asset/bootstrap helpers, with no uncaught page errors.
The fixture mapped only validated numeric HTTP dials to an owned local listener;
it did not replace the fetcher or claim real R2 delivery. A separate owned
HTTPS/WSS probe passed without creating a room. The new managed-session owner
acquires via REST, connects via CDP, deletes its exact session even after a failed
connection, and bounds cleanup. Its 16 unit cases and the existing 39 capture
cases pass. The production screenshot service still uses the existing worker;
the new owner is a tested integration candidate, not a provider switch.

The old `games-staging.air-jam.app` hostname now returns a Railway certificate
that does not match it. Do not bypass TLS or reuse September's staging proof as
current upload/capture evidence. The next uploaded-release proof needs a working
isolated preview with the matching database, storage and asset origin.

Run the opt-in built-game fixture only with explicit test credentials, after
building the SDK and bundling Pong through `airjam release bundle`:

```bash
AIRJAM_TEST_CLOUDFLARE_CAPTURE=1 \
AIRJAM_TEST_CLOUDFLARE_ACCOUNT_ID=<account-id> \
AIRJAM_TEST_CLOUDFLARE_API_TOKEN=<test-token> \
pnpm --filter platform test src/server/releases/cloudflare-game-capture.integration.test.ts
```

Use an existing authenticated credential resolver to supply the token in memory;
do not put real secrets into the command history or retained proof. This paid
network test is skipped in normal local and CI runs. Its offline traffic denial
is fixture-only; no creator dependency restrictions are introduced.

Cloudflare's [session guardrails](https://developers.cloudflare.com/browser-run/features/guardrails/)
document HTTP/HTTPS hostname allowlists, not complete public-address, DNS-rebinding
or WSS containment. Do not claim they alone replace our egress contract or impose
a fixed creator CDN allowlist without revisiting the product contract. Actual
unpublished generation assets, redirect-safe credential routing, public HTTP/WSS,
private-address/DNS/direct-bypass denial, resource limits and cancellation still
need owned-fixture proof. Production also needs a least-privilege machine
credential, provider security maintenance assurance and reviewed exact-candidate
integration. Basic rendering alone does not close `G5-02`.

Resolve the managed network-policy guarantee before implementing the transport
switch. A fixed CDN allowlist would change the capture product contract; a
custom HTTP/WebSocket forwarding layer would be a material architecture expansion,
not an automatic response to missing provider guarantees. Neither is approved
or implemented. Do not claim that managed rendering is impossible merely because
the current documentation does not establish every required guarantee.

Its [paid browser pricing](https://developers.cloudflare.com/browser-run/pricing/)
includes ten browser-hours per month and charges $0.09 per additional hour, with
separate concurrency charges and Workers plan costs; the free ten-minute daily
allowance is not a launch operating envelope. The bounded session trial did not
activate a subscription. No persistent service, template/checkpoint, DNS change,
production configuration or capture-worker switch occurred.

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

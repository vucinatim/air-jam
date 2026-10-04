# Managed Release Screenshot Capture

Last updated: 2026-10-04
Status: active bounded architecture plan

Execution authority remains `G5-02` in the release manifest. Tim accepted
Cloudflare's managed browser isolation on 2026-10-04 and authorized reviewed
delivery and release when confidence is established. This resolves the provider
choice, not the remaining integration, hosted proof or release checks.

## Product and security boundary

Railway continues to host Air Jam and its operational worker. Cloudflare Browser
Run executes uploaded games for screenshots. No untrusted capture runs on bee
or in a platform-local Chromium process. This does not change normal local game
development, room joining, creator publishing permissions or game dependencies.

Cloudflare owns browser execution isolation and security maintenance. Air Jam
does not claim an independently enforced browser-network firewall, private-IP
denial or DNS-rebinding containment. That limitation is explicitly accepted;
it is not proof that those provider guarantees exist. Do not add a fixed creator
CDN allowlist or a custom HTTP/WebSocket proxy to recover the old guarantee.

Air Jam's privileged asset fetching still validates all public DNS answers,
pins numeric connections, verifies the original TLS hostname and refuses
redirect following. A signed, expiring inspection token reaches only the exact
game/release/generation path. Public external requests receive no inspection
token or inherited browser credentials.

## One capture lifecycle

1. The existing moderation job and global-two/per-creator-one admission remain
   the only scheduling owners.
2. Capture acquires one provider session through authenticated REST, connects
   through CDP and creates one context with downloads and service workers
   disabled. Unsolicited top-level pages are closed.
3. Existing viewport, navigation, settle-wait, output-size and 90-second capture
   limits remain. Successful and failed captures close their owned context,
   connection and exact provider session with bounded cleanup before storage.
4. Configuration requires `AIRJAM_RELEASES_BROWSER_ACCOUNT_ID` and
   `AIRJAM_RELEASES_BROWSER_API_TOKEN`. No legacy WebSocket endpoint, local
   executable or alternate provider fallback remains.
5. Production and disposable previews use distinct browser credentials. The
   browser credential grants only required Browser Run permissions in the Air
   Jam account, never storage, DNS or general account administration.

## Credential storage and verification

Tim approved the two restricted tokens on 2026-10-04. Both provider policies
were read back and verified: Browser Run Read and Write only, scoped to the
existing Air Jam account. They grant no DNS, storage or token-administration
permission.

Deployment copies live outside Git in the normal macOS user's
`~/.config/agentic-devtools/airjam/browser-run-production.json` and
`browser-run-preview.json`. The directory is mode `0700`; files are `0600`.
Do not put these secrets in source, `.env.local`, command arguments or output.
Load them into operator memory/environment only for the intended provider work.

The production account/token variables are stored on Railway's platform and
operational-worker services, with `skipDeploys: true`. Read-back matches both
values and deployment identities are unchanged. The preview token is not in
production; it is reserved for the disposable isolated environment. New
production processes will consume the staged variables during reviewed rollout.

The preview credential passed the actual managed-session owner: acquisition,
remote rendering, a PNG screenshot and acknowledged closure. No screenshot
object was stored. This proves machine authentication and lifecycle, not a
hidden uploaded R2 release or deployed capture service.

## Delivery proof still required

The session owner and real offline Pong render were already proven. Integration
must additionally prove the actual screenshot service, a hidden uploaded R2
release, capture failure and cleanup, and the unchanged player/creator flow.
The working branch now integrates that service, the three-service Railway CLI
preview topology, and existing release-job/error sensors. The obsolete custom
worker package and configuration are removed. Retire the deployed browser
service only after the replacement is live and verified.

The integrated local batch passes, including full workspace typechecking, lint,
canonical guards and tests. Focused capture/synthetic tests pass (62), as do
staging lifecycle/isolation tests (24). The authorized GPT-6.1 Sol pre-push
source review found no actionable blockers. Environment-dependent local tests
remain skipped; these checks are not hosted or production sign-off. Current-head
[CI](https://github.com/vucinatim/air-jam/actions/runs/37202101846) and the
[installation matrix](https://github.com/vucinatim/air-jam/actions/runs/37202101888)
also passed for `92e5efa9`. No production deployment or schema change occurred.

Use one integrating batch and one authorized pre-push review for the coherent
change. The final green-PR review and exact Railway rollout follow
[working agreements](../working-agreements.md#review-stacks-and-integration).
Acceptance does not close `G5-02` or authorize announcing an unfinished 1.0.

Historical worker designs, rejected placements and owned-fixture limits are
retained in the [provider investigation archive](../archive/2026-10-04-self-hosted-release-browser-containment-plan.md).
Cloudflare's [session lifecycle](https://developers.cloudflare.com/browser-run/cdp/session-management/)
defines the REST/CDP acquisition and closure contract.

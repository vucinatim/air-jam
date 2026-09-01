# Hosted Release Domain Cutover Plan

Last updated: 2026-09-01
Status: active bounded Gate 5 cutover
Governed by: [Air Jam 1.0 Release Roadmap](./v1-release-roadmap-plan.md)
Execution authority: readiness item `G5-02`

## Decision

Air Jam's canonical production origin for creator-controlled executable game
content is:

```text
https://games.air-jam.app
```

The trusted product remains on `https://airjam.io`, and the multiplayer server
remains on `https://api.airjam.io`. The release origin is an implementation
boundary loaded inside the trusted Arcade shell; normal public links, QR codes,
room codes, controller URLs, and reconnect behavior remain on `airjam.io`.

## Non-Negotiable Invariants

1. `games.air-jam.app` is attached to the production `air-jam-platform`
   service, because that service owns hosted-release HTTP routing. It is not
   attached to the release browser worker.
2. The release origin is outside the `airjam.io` cookie site and outside Better
   Auth trusted origins.
3. The game host serves only canonical release-generation paths and cannot
   expose platform, account, dashboard, device-approval, or machine-auth
   authority.
4. The game host sets no Air Jam authentication cookies.
5. Missing or invalid release-origin configuration disables hosted delivery;
   it never falls back to the authenticated platform origin.
6. Provider changes are additive until the new origin has passed production
   attestation. No existing `air-jam.app` record is modified in the initial
   cutover.
7. DNS, deployment, and legacy-host changes are inspectable and operable by
   agents through the repo CLI and published `@vucinatim/agentic-devtools`
   surfaces.

## Verified Pre-Cutover Baseline

The 2026-09-01 read-only inventory established these stored application and
routing records:

| Host                     | Provider record                              | Observed result                         | Current live attachment                                 |
| ------------------------ | -------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `air-jam.app`            | A `216.198.79.1`                             | `404 DEPLOYMENT_NOT_FOUND`              | no Vercel alias or Railway custom domain                |
| `www.air-jam.app`        | CNAME `f7aa8a9b4a05d9c6.vercel-dns-017.com.` | deployment missing; certificate expired | no Vercel alias or Railway custom domain                |
| `api.air-jam.app`        | CNAME `5uw30tew.up.railway.app.`             | `404 Application not found`             | no custom domain in the current Air Jam Railway project |
| `air-strike.air-jam.app` | A `76.76.21.21`                              | deployment missing; certificate expired | no Vercel alias                                         |
| `games.air-jam.app`      | no A, AAAA, CNAME, or TXT record             | NXDOMAIN                                | none                                                    |

Historical repository evidence confirms that `air-jam.app` and
`www.air-jam.app` once redirected to the new `airjam.io` host. Those redirects
were later removed because the old domains were no longer attached to a live
service. The current repository has no live `air-jam.app` runtime references,
and a bounded public search found no indexed references. This does not authorize
destructive cleanup; it establishes that the existing hosts are already stale
and that adding the unused `games` label cannot interrupt their present
behavior.

Namecheap is authoritative through `dns1.registrar-servers.com` and
`dns2.registrar-servers.com`. Namecheap's provider configuration reports
`emailType: FWD`. That setting is part of the production baseline even though
the provider's stored host-record collection contains only the four existing
application records above. It currently synthesizes these effective public DNS
records and they must remain present throughout the cutover:

| Type | Priority | Value                                                |
| ---- | -------- | ---------------------------------------------------- |
| MX   | 10       | `eforward1.registrar-servers.com.`                   |
| MX   | 10       | `eforward2.registrar-servers.com.`                   |
| MX   | 10       | `eforward3.registrar-servers.com.`                   |
| MX   | 15       | `eforward4.registrar-servers.com.`                   |
| MX   | 20       | `eforward5.registrar-servers.com.`                   |
| TXT  | n/a      | `v=spf1 include:spf.efwd.registrar-servers.com ~all` |

The zone has no wildcard or CAA restriction. Negative DNS caching for the
current NXDOMAIN may persist for roughly one hour. Because `.app` is HTTPS-only
in modern browsers, the cutover cannot proceed past DNS until Railway's
certificate is valid.

## Target Provider Identity

The production target is intentionally explicit:

1. Railway project: `0b0761f9-9bb1-4d4f-8191-50d43cccdee7`
2. Railway environment: `53607220-1116-4d93-89b2-d508835901ac`
   (`production`)
3. Railway service: `5966dcb6-88cb-49d6-a1fa-60ca78c533ac`
   (`air-jam-platform`)
4. DNS provider during this cutover: Namecheap
5. release origin: `https://games.air-jam.app`

Moving the zone to Cloudflare is deliberately out of scope. A nameserver
migration would combine two independent production changes without improving
the release-origin boundary.

## Execution Sequence

### 1. Land The Decision And Runbook

Land this plan and the matching contract documentation through one dedicated
pull request. The merge must satisfy the repository's layered checks and final
review rules before provider state changes.

### 2. Create The Pending Railway Domain

Create `games.air-jam.app` as a custom domain on the exact production platform
service. Record Railway's returned domain identity and required routing and
verification records. Do not infer or reuse a CNAME target from another host.

Read the pending domain back from Railway before changing DNS. Stop if the
project, environment, service, target port, or requested hostname differs from
the target identity above.

Railway can rotate the CNAME target when a custom domain is recreated. Never
reuse a routing or verification value from an earlier attempt.

### 3. Add Only The New Namecheap Records

Immediately before the first write, read and retain Namecheap's complete
provider configuration, including `emailType`, and the normalized tuples for
every stored host record. Independently resolve the effective public MX and SPF
records. Add the exact `games` routing record and Railway verification record,
then repeat both readbacks. The agentic-devtools Namecheap mutation must
preserve every unrelated record and `emailType: FWD`.

Namecheap replaces the full host collection behind its DNS API, including when
agentic-devtools exposes a targeted add operation. Serialize the routing and
verification writes, read the full zone after each one, and permit no parallel
DNS or UI edit during the sequence. Compare normalized semantic values rather
than provider-assigned IDs, record ordering, or representational TTL changes.
After each write:

1. `emailType` must still equal `FWD`
2. every baseline stored host record must remain semantically unchanged
3. only the exact Railway-required record may have been added by that write
4. the five forwarding MX records and forwarding SPF TXT record above must
   still resolve publicly

Do not edit or remove `@`, `www`, `api`, `air-strike`, the email-forwarding
setting, or its effective public MX and SPF records during this phase. Stop and
roll back the exact new record if any baseline state changes.

### 4. Prove TLS Before Enabling Delivery

Wait for Railway to report a valid certificate for `games.air-jam.app`. Verify
public DNS and HTTPS independently. Before configuration is enabled, the host
must fail closed rather than expose the normal platform shell. Before
`AIRJAM_RELEASES_PUBLIC_ORIGIN` is set, normal paths on the new host must return
`404` with `Cache-Control: no-store` and the untrusted-release response marker.
`/api/health` intentionally remains a `200` liveness response at this stage
because the configured release origin is not known yet; it is not readiness or
boundary proof. After the variable is set and the deployment succeeds, the
release host must also return `404` for `/api/health` through the
`block_release_origin` policy.

### 5. Enable The Canonical Origin

Set this production platform variable through the repo-owned Railway surface:

```text
AIRJAM_RELEASES_PUBLIC_ORIGIN=https://games.air-jam.app
```

Allow the resulting platform deployment to finish. A queued or building
deployment is not success. Bind the exact merged revision, GitHub deployment
status, Railway deployment ID, literal terminal `SUCCESS`, liveness identity,
and product-readiness identity according to the canonical Railway deployment
guide.

### 6. Attest The Boundary And Normal Experience

Run the canonical machine checks against one exact immutable live generation:

```bash
pnpm --silent run repo -- platform release-origin inspect \
  --platform-url https://airjam.io \
  --json

pnpm --silent run repo -- platform release-origin attest \
  --platform-url https://airjam.io \
  --release-url https://games.air-jam.app/releases/g/<game-id>/r/<release-id>/generations/<generation-id> \
  --railway-project 0b0761f9-9bb1-4d4f-8191-50d43cccdee7 \
  --json
```

The attestation must report `status: passed`,
`evidenceKind: production-deployment`, and
`productionEvidenceEligible: true`. Run `pnpm smoke:browser` against the exact
merged revision for the controlled hostile fixture and normal Pong proof. In
production, exercise only a known reviewed hosted game; do not upload or execute
a hostile fixture before the browser worker closes `AJ-SEC-004`.

Regression proof covers:

1. `airjam.io`, `/arcade`, and `/docs`
2. anonymous session and same-origin host-grant behavior
3. QR and manual room-code join
4. controller ready/start behavior
5. reconnect after a transient disconnect
6. host and controller rendering for a hosted release
7. exact public release URLs and their response policy

### 7. Observe Before Legacy Cleanup

Retain the new domain binding and all old DNS records through a bounded
observation period. Product telemetry, release-origin synthetics, and platform
health must remain clean before starting the legacy-host slice.

## Legacy Host Slice

Legacy cleanup is a separate reviewed and reversible change:

1. `air-jam.app` and `www.air-jam.app` permanently redirect to the equivalent
   `https://airjam.io` path.
2. `air-strike.air-jam.app` redirects to its exact Arcade entry if one exists;
   otherwise it redirects to `https://airjam.io/arcade`.
3. `api.air-jam.app` is not redirected to the current API. HTTP redirects are
   not a sound compatibility contract for API and WebSocket clients. After a
   final dependency check it is explicitly retired with `410 Gone` or removed.
4. Stale Vercel and Railway targets are removed only after their replacement
   behavior has valid HTTPS and a read-back check.
5. Nothing sensitive is ever hosted on the `air-jam.app` cookie site; its apex
   and legacy labels remain redirects or tombstones only.

## Stop Rules

Stop the cutover without improvising when:

1. Railway requests a record different from its read-back domain contract.
2. Namecheap cannot preserve the existing zone while adding one record.
3. TLS does not reach a valid terminal state.
4. the release origin appears in Better Auth trust or receives any platform
   cookie.
5. the release host serves a platform/account route.
6. the deployed platform identity changes during attestation.
7. the normal Arcade, room, controller, or reconnect path regresses.

## Rollback

Rollback disables hosted release delivery before changing DNS:

1. delete `AIRJAM_RELEASES_PUBLIC_ORIGIN` from the production platform through
   the published agentic-devtools `deleteRailwayVariable` lifecycle
2. wait for the resulting exact platform deployment to reach terminal success
3. verify `/api/health` remains live and `/api/readiness` reports the explicit
   disabled state
4. leave the valid domain and DNS binding in place while diagnosing, unless the
   binding itself is the cause
5. remove the new DNS and provider binding only after the disabled deployment
   is proven

Because the implementation has no same-origin fallback, rollback cannot cause
creator code to execute with `airjam.io` authority.

## Completion Evidence

This bounded cutover is complete only when the readiness manifest references:

1. the merged decision/runbook pull request
2. Namecheap before/after provider configuration, stored host-record, and
   effective public mail-DNS evidence
3. Railway custom-domain and valid-certificate evidence
4. the exact successful production deployment and merged revision
5. the production release-origin inspection and attestation JSON
6. hostile-browser and normal-game regression evidence
7. the rollback verification result

The historical outcome belongs in `docs/work-ledger.md`. Live execution status
remains in the readiness manifest rather than in Markdown checkboxes.

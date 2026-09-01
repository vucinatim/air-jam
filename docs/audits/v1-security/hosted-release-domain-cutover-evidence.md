# Hosted Release Domain Cutover Evidence

Date: 2026-09-01
Status: production cutover complete; observation and broader `G5-02` work remain
Authority: readiness item `G5-02`

## Outcome

Creator-controlled hosted release documents now load from
`https://games.air-jam.app`. The trusted product, public navigation, room codes,
QR links, controllers, and reconnect flows remain on `https://airjam.io`.

The production release boundary passed all `20` canonical attestation checks
and is eligible as production evidence. The exact machine record is preserved
in
[2026-09-01-production-release-origin-attestation.json](./2026-09-01-production-release-origin-attestation.json).

## Reviewed Delivery

1. PR `#79` merged the provider contract and cutover implementation at
   `9db5426fe17dd94edaeae7e3f16876031d211738`.
2. PR `#80` corrected the canonical no-trailing-slash release root and aligned
   browser preflight attestation with actual CORS authority. It merged at
   `ebf63d8a0d5587f27ba59adf48213fb71f20340b` after green GitHub checks, green
   Railway previews, and a `CLEAR TO MERGE` Claude Opus 5 review.
3. Production platform deployment
   `e65c8e41-3f72-4078-9ce0-443695d296a2` reached literal terminal `SUCCESS`
   and reported the exact merge revision above.
4. The public catalog returned six games, all six URLs used
   `games.air-jam.app`, and zero retained the obsolete trailing slash.
5. The local browser smoke matrix passed `7/7`, including hostile distinct-
   origin containment, common host/controller iframe policy, reconnect, and
   real Next host-derived routing.

## Provider Evidence

The domain is attached to the exact production platform service:

1. Railway project: `0b0761f9-9bb1-4d4f-8191-50d43cccdee7`
2. production environment: `53607220-1116-4d93-89b2-d508835901ac`
3. platform service: `5966dcb6-88cb-49d6-a1fa-60ca78c533ac`
4. custom-domain identity: `2adee84d-ca46-4c8a-9f6d-6075ba5927e7`
5. Namecheap CNAME: `games` -> `fwkerixp.up.railway.app`
6. Railway verification TXT: `_railway-verify.games` with the exact provider-
   issued verification token
7. certificate state: `VALID` / `COMPLETE`
8. certificate fingerprint:
   `f86726f6736509a7e4edfcdc3d6dbc42cb0b6fc71fa3a7899663ac5e103cf432`
9. certificate expiry: 2026-11-30

The additive Namecheap mutation preserved `emailType: FWD`, all five registrar
mail-forwarding MX records, the forwarding SPF TXT record, and every unrelated
application record. No apex, `www`, `api`, or `air-strike` record was changed.

## Production Schema Recovery

The first public catalog proof exposed a pre-existing production schema drift:
the database journal ended at migration `0020` while the deployed application
expected `0033`. Health stayed green because process liveness did not exercise
the catalog query; `game.getAllPublic` returned `500`.

Recovery followed the production-valid path:

1. restored the fresh dump into isolated PostgreSQL 17 and rehearsed the exact
   `0021` through `0033` journal
2. stopped the exact active platform deployment and confirmed zero other
   database client sessions
3. captured a fresh PostgreSQL 17 custom-format dump before mutation
4. applied the exact merged migration journal with bounded lock and statement
   timeouts
5. verified `34` journal rows, `35` release generations, `6` live releases,
   removal of the legacy artifact table, and successful public catalog joins
6. redeployed the previous exact application image and proved health,
   readiness, and the six-game catalog before continuing the URL correction

The operator-local recovery artifact is retained at
`.airjam/backups/production/platform-2026-09-01T13-40-10Z.dump` with mode `0600`,
size `527512` bytes, and SHA-256
`3a81ad196fb618ff4b6c696d550ef890223564d9a998e55f2aa11de18befae04`.

An attempted provider-native zero-replica drain did not reach zero: Railway
accepted the scale request but moved the replica from EU West to US West. No
database mutation occurred during that attempt. The exact original topology
was immediately restored to one EU West replica and deployment
`1612106e-501b-488a-bead-ae8987a4a5ef` reached `SUCCESS` before the exact
deployment-stop path was used for the migration window.

## Remaining Scope

This evidence closes the dedicated-domain production cutover, not all of
`G5-02` or `G3-02`:

1. observe the new origin before deciding the separate legacy-host slice
2. prove the documented release-origin rollback path without weakening the
   production boundary
3. automate production migration drift detection and a bounded maintenance
   lifecycle so process health cannot hide schema incompatibility
4. finish the remaining auth, abuse, privileged-endpoint, reliability, and
   overload work owned by the release roadmap


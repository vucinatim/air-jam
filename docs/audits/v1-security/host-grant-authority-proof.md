# Host Grant And Host Resume Authority Proof

Last updated: 2026-09-09
Status: Gate `G5-02` authority slice locally proven and Canonicalizer-ready; reviewed merge and coordinated production cutover pending

## Outcome

The working branch closes `AJ-SEC-003` without adding a login, permission
prompt, or alternate room-joining flow. Arcade visitors receive an anonymous,
signed launch session from the trusted platform. The platform can exchange that
session for one short-lived host grant, and the realtime server can consume the
grant exactly once to establish the intended host authority.

The ordinary interaction remains:

1. open Arcade
2. select a game
3. receive a room code
4. join from controllers as before

The security machinery stays below that product surface.

## Authority Chain

One explicit chain now owns Arcade system-host bootstrap:

1. platform middleware issues the `__Host-airjam-launch-session` secure,
   host-only cookie for the anonymous Arcade launch
2. the same-origin host-grant endpoint requires the exact platform origin and
   a valid, unexpired launch session
3. the endpoint resolves one active app credential and its canonical game and
   creator identity from PostgreSQL
4. it issues an `airjam.host_grant.v3` grant containing a UUID `jti`, fixed
   realtime audience, app/game/creator identity, bounded lifetime, allowed
   origins, and session kind
5. the realtime auth service validates every claim and consumes the `jti` in
   one PostgreSQL transaction before granting socket bootstrap authority
6. the Arcade system host uses the ordinary `host:createRoom` lifecycle action

Migration `0040_host_grant_consumption.sql` adds the durable single-use
authority and its expiry index. The durable row retains only `jti`, `app_id`,
`session_kind`, `expires_at`, and `consumed_at`; the primary key, session kind,
chronology, and non-empty identifiers are constrained by PostgreSQL rather than
trusted to process memory.

The authoritative validation and insert occur in one transaction, and the
`jti` primary key admits only one insert. Two realtime instances or concurrent
sockets racing the same grant therefore cannot both accept it. Invalid origin,
audience, session kind, app ownership, expiry, or replay fails closed.

## Active-Room Ownership

A successful room creation returns a server-issued host resume capability. The
SDK persists that opaque capability with the room identity and supplies it for
reconnect. A room code alone is no longer master authority.

The realtime server rejects:

1. reconnect without the exact room capability
2. host lifecycle actions before the socket establishes bootstrap authority
3. a public app-ID bootstrap that attempts to elevate itself to system authority
4. a room ownership claim from a socket without the matching resume capability

A room reset creates a new room and rotates the resume capability. The old
room capability cannot claim the new room. Legacy room-only browser storage is
discarded rather than silently treated as authority.

## Removed Hosted Bypass

`AIR_JAM_MASTER_KEY` is no longer an accepted hosted authentication backend.
Production and Railway preview environments in required-auth mode need the
canonical PostgreSQL app/grant authority. The master key remains available only
for explicit development and test environments where it is useful as a local
tool; the realtime server environment validator is the sole policy owner for
that eligibility.

This is a deliberate zero-compatibility cleanup:

1. host-grant versions before v3 do not satisfy the protocol schema
2. room-only reconnect state is not upgraded into authority
3. hosted master-key authentication has no fallback path

## Local Validation

The retained focused proof covers:

1. v3 grant creation, verification, mutation rejection, expiry, excessive
   lifetime, and future-issued rejection
2. launch-session issuance plus tampered, wrongly signed, and expired failure
   paths
3. exact same-origin, valid launch-session, and active app-credential
   requirements at the platform endpoint
4. canonical app/game/creator binding
5. one-time and exactly-one-winner concurrent PostgreSQL consumption
6. missing and forged origin, replay, stale ownership, and bounded
   expired-consumption cleanup
7. legitimate first launch while rejecting raw replay and active-room hijack
8. rejection of public app-ID bootstrap attempts to claim system authority
9. explicit local-only system bootstrap when authentication is disabled
10. host reconnect capability issuance, persistence, required ownership, and
    rotation on room reset
11. hosted master-key rejection and explicit local-development behavior
12. a fresh migration catalog through `0040` classified `ready` by the
    canonical database-migration inspector

The focused server database authority proof passes `13/13` tests against local
PostgreSQL after a fresh catalog application through `0040`. The phased `0037`
to `0038` to `0039` ownership/admission upgrade test also passes. These are
local implementation facts, not production claims.

The post-correction complete local batch passed on 2026-09-09 with PostgreSQL
enabled: generated-source checks, typechecks, lint, canonical guard, 200 repo
contract tests, 200 server tests, 287 SDK tests, and 464 platform tests passed.
The one pre-push Canonicalizer session initially returned `CONTINUE`: it
identified client-controlled session elevation, duplicated signing machinery,
redundant grant persistence, hosted master-key provisioning, authentication-
coupled cleanup, inaccurate lifecycle proof language, stale operational-worker
status, and obsolete abuse-identity guidance. Those findings are corrected in
the working tree. The same session, `2408e343-78a8-43a8-b14f-1e44d07a3467`,
then returned `READY`, confirming one owner per boundary, verified-state session
authority, no surviving compatibility shims, and a minimal matching migration.
Protected GitHub review and production proof remain separate gates.

## Coordinated Rollout Boundary

Grant v3 and capability-based reconnect intentionally replace the old contract
rather than carrying dual verification paths. Production rollout therefore
requires one short, controlled admission cutover:

1. apply and verify migration `0040` while the current application remains
   compatible with the additive table
2. pause new room admission while allowing existing rooms to continue
3. deploy the platform grant issuer, SDK-facing Arcade build, and realtime
   verifier/lifecycle implementation from their reviewed commits
4. verify platform readiness, realtime readiness, grant issuance, one
   legitimate system-host launch, replay rejection, reconnect, logs, and exact
   deployed revisions
5. restore normal room admission only after those checks pass
6. roll back the exact deployments and keep admission paused if any authority
   boundary fails

This document does not claim that `AJ-SEC-003` is closed in production. Gate
`G5-02` retains ownership until protected review, guarded migration, coordinated
deployment, hostile-path smoke proof, and retained production evidence all
pass.

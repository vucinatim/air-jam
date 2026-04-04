# Air Jam Platform Dashboard Account Auth Plan

Last updated: 2026-03-29  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [Auth Capability Plan (Archived)](./auth-capability-plan-2026-03-31.md)
5. [Release-Facing Polish Plan](./release-polish-plan.md)

## Purpose

This plan defines the account-auth direction for the Air Jam platform dashboard.

This is not the same problem as runtime/framework auth.

The goal here is:

1. make dashboard sign-in trustworthy enough for public use
2. keep the UX low-friction for the current builder audience
3. avoid creating email-delivery or password-support burden too early
4. keep the auth surface simple enough that it will not become a maintenance trap

## Decision

The v1 account-auth direction should be:

1. ship GitHub sign-in first
2. do not block release on Google sign-in
3. do not switch to OTP-only or magic-link-first right now
4. do not invest in full password flows unless password auth remains a deliberate product requirement

## Why This Is The Right Scope

The current audience is primarily developers and technical builders.

That means:

1. GitHub is the lowest-friction provider with the best audience fit
2. GitHub avoids email verification, password reset, and OTP delivery complexity
3. Google is worth supporting later, but it adds more setup and policy ceremony than GitHub
4. OTP or magic-link is not actually the simpler path unless we already want to own email delivery well

## Current Baseline

Today the platform has:

1. Better Auth configured with email/password only
2. a simple combined sign-in/sign-up page
3. no password reset flow
4. no email verification flow
5. no social providers
6. no transactional email provider integration

This is acceptable for internal use, but not the best v1 public account model.

## Current Implemented Baseline

Done:

1. Better Auth now supports GitHub as an optional configured social provider
2. the platform auth page is now GitHub-first instead of password-first
3. email/password remains only as an explicit fallback instead of pretending to be the main public flow
4. unauthenticated dashboard redirects now point to `/login` with a safe post-auth return path
5. GitHub profile image/name can flow through the dashboard session surface

Still pending:

1. production GitHub OAuth app setup and env configuration
2. final decision on whether email/password should remain available at all after GitHub is live in production
3. any first-login profile completion, if it turns out we need it

## V1 Product Shape

### Primary Sign-In Method

Use:

1. `Continue with GitHub`

### Secondary Sign-In Methods

For v1:

1. do not make Google a release dependency
2. do not make OTP/magic-link a release dependency
3. either hide email/password entirely or clearly treat it as non-primary

### Recommended V1 UX

1. GitHub-first auth page
2. clean shadcn-based presentation is fine
3. short explanation of why an account exists
4. direct redirect into dashboard/onboarding after successful sign-in
5. first-login profile completion only if needed for product identity

## Email Decision

### Do We Need Email For V1?

No, not if we ship GitHub-first only.

That means:

1. no Resend requirement for the initial release
2. no password reset emails
3. no OTP emails
4. no email verification pipeline

### When Email Becomes Necessary

Email becomes necessary only if we add:

1. password reset
2. magic-link / OTP sign-in
3. email verification
4. account-recovery flows

### Recommended Email Provider Later

If and when email is needed:

1. use Resend first for simplicity
2. use the `air-jam.app` domain with proper SPF/DKIM
3. defer SES or lower-level mail infrastructure unless email volume or control actually demands it

## UI Decision

Using shadcn auth blocks is fine.

Rule:

1. use shadcn for presentation
2. keep Better Auth as the auth engine
3. do not let block templates drive product decisions or force unnecessary flows

## Explicitly Out Of Scope For V1

1. Google sign-in as a release blocker
2. OTP-only sign-in
3. magic-link sign-in
4. password reset flow
5. email verification flow
6. multi-provider account linking polish
7. team/org auth
8. billing/entitlement coupling

## Implementation Plan

## 1. GitHub OAuth Baseline

Status:

1. implemented baseline

Add:

1. GitHub provider to Better Auth
2. required env vars and callback config
3. dashboard session behavior for GitHub-authenticated users

Done when:

1. local development works
2. Vercel deployment works
3. sign-in produces stable dashboard sessions

## 2. GitHub-First Auth Surface

Status:

1. implemented baseline

Change the platform auth page to:

1. lead with `Continue with GitHub`
2. present account auth as dashboard access, not generic website auth
3. keep the page visually polished but minimal

Done when:

1. the page looks intentional
2. the primary CTA is GitHub
3. the page no longer feels like a placeholder password form

## 3. Decide Fate Of Email/Password

Status:

1. active

Choose one explicit v1 stance:

1. remove email/password from the public auth page
2. or keep it clearly secondary and knowingly unfinished

Preferred outcome:

1. remove or hide it until we support it properly

## 4. First-Login Identity Completion

If GitHub account data is not enough for product identity:

1. add a lightweight profile-completion step
2. keep it minimal and skip it when GitHub data is already sufficient

Done when:

1. users have a stable display identity in the dashboard
2. the flow adds minimal friction

## 5. Docs And Release Contract

Update docs so they clearly state:

1. dashboard auth is GitHub-first
2. runtime/framework auth is a separate system
3. email-based auth flows are intentionally deferred

## Open Questions

1. whether email/password should stay internally available or be removed entirely
2. whether Google sign-in should land shortly after v1 or wait until demand is real
3. whether first-login profile completion is needed at all

## Closeout Rule

This plan is complete for v1 when:

1. GitHub sign-in is live and stable
2. the login page is no longer barebones
3. the chosen stance on email/password is explicit
4. remaining Google/OTP/password-reset ideas move to `docs/suggestions.md` or a later bounded plan

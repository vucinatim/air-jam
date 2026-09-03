# Public Install Matrix Audit

Last updated: 2026-09-03

Status: passed; closes readiness item `G6-01`

## Decision

Air Jam's coordinated five-package candidate graph is installable and usable
from a clean environment across the complete 1.0 support matrix:

1. Linux on Node.js 22 and 24
2. macOS on Node.js 22 and 24
3. Windows on Node.js 22 and 24

The proof covers candidate version `0.9.2`. It does not publish to npm and does
not mutate production. Each cell publishes the exact locally packed Air Jam
tarballs to a fresh loopback Verdaccio registry, forbids upstream fallback for
Air Jam package names, gives `npx` an empty run-scoped cache, and obtains only
non-Air Jam dependencies from npm.

The canonical support contract remains
[public-package-support-contract.md](../../contracts/public-package-support-contract.md).
This document records the measured release evidence and the defects the proof
forced the implementation to remove.

## Exact Evidence Identity

| Field                       | Value                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Workflow                    | [Public Install Matrix run 33312857389](https://github.com/vucinatim/air-jam/actions/runs/33312857389) |
| Exact branch CI             | [CI run 33312857422](https://github.com/vucinatim/air-jam/actions/runs/33312857422)                    |
| Branch head                 | `1a05fd0f75ecad720d1c357acbd3f9246e22a6c9`                                                             |
| Tested pull-request merge   | `19eb8e41f5bf9a06100d3c5af975a59d1837bd62`                                                             |
| Merge parents               | `006924de5fbcf22507913501afd30a8e860a5167`, `1a05fd0f75ecad720d1c357acbd3f9246e22a6c9`                 |
| Permanent production commit | `0aaa8d2c2e83f3855104836f61b52b597fc39096`                                                             |
| Matrix contract             | `air-jam-public-install-matrix/v1`                                                                     |
| Cell evidence contract      | `air-jam-public-install-matrix-cell/v1`                                                                |
| Aggregate evidence contract | `air-jam-public-install-matrix-aggregate/v1`                                                           |
| Evidence result             | six passing cells; one passing aggregate                                                               |

GitHub's aggregate and a separate local aggregation of only the six downloaded
cell documents were identical after removing the independently generated
timestamp. The repository aggregator rejected missing, duplicate, unexpected,
non-passing, wrong-contract, wrong-budget, and mixed-commit evidence in its
contract tests.

The historical branch identity records the exact candidate proof. Readiness
uses the permanent production squash commit because GitHub removes merged head
branches and fresh CI checkouts must be able to resolve every durable artifact.

## Certified Environments And Timings

| Cell              | Exact runtime                               | Architecture | Runner image                  | Scaffold and install | Complete cell |
| ----------------- | ------------------------------------------- | ------------ | ----------------------------- | -------------------: | ------------: |
| Linux / Node 22   | Node `22.23.2`, pnpm `9.9.0`, npm `10.9.8`  | x64          | `ubuntu24@20260823.283.1`     |            99,211 ms |    182,607 ms |
| Linux / Node 24   | Node `24.19.0`, pnpm `9.9.0`, npm `11.17.0` | x64          | `ubuntu24@20260823.283.1`     |           114,634 ms |    209,577 ms |
| macOS / Node 22   | Node `22.23.1`, pnpm `9.9.0`, npm `10.9.8`  | arm64        | `macos26@20260728.0273.1`     |           117,635 ms |    200,299 ms |
| macOS / Node 24   | Node `24.18.0`, pnpm `9.9.0`, npm `11.16.0` | arm64        | `macos26@20260728.0273.1`     |           112,748 ms |    192,117 ms |
| Windows / Node 22 | Node `22.23.2`, pnpm `9.9.0`, npm `10.9.8`  | x64          | `win25-vs2026@20260824.214.3` |           137,223 ms |    308,915 ms |
| Windows / Node 24 | Node `24.19.0`, pnpm `9.9.0`, npm `11.17.0` | x64          | `win25-vs2026@20260824.214.3` |           147,076 ms |    275,962 ms |

The slowest scaffold-and-install result was 147,076 ms against a 600,000 ms
ceiling. The slowest complete cell was 308,915 ms against a 1,800,000 ms
ceiling. These are launch guardrails, not performance promises; future runner
images remain required to satisfy the same canonical budgets.

## Exact Candidate Package Graph

| Package               |   Packed bytes |         Ceiling | SHA-512 integrity                                                                                 |
| --------------------- | -------------: | --------------: | ------------------------------------------------------------------------------------------------- |
| `@air-jam/sdk`        |      1,223,635 |       2,097,152 | `sha512-8QirW6i0QQKRR2OlIb5LoFtC9vydi83GnNHFI1Yzbn2jHlHDSQs8q9IWiAtANyJRmzEw8sOUsjBkgTX9O+UqPw==` |
| `@air-jam/cli`        |        373,737 |       1,048,576 | `sha512-B5+pHHXQLy/HurDgEe/GACyNH2qDKPa3zK8v1qjdg9DiNCsvYawXK3kpMkIFw+aVRK0hWTrxiNsWzzbgRQG7aQ==` |
| `@air-jam/mcp-server` |        666,552 |       1,048,576 | `sha512-C0fa6SSkg6Lo9VbnLcnw2HJQR6aKxN4XhmvN6jDKRCqtigZC/sTb+YAOYYrbm5GBNMuJYxkCth+f5Ay8cNldeQ==` |
| `@air-jam/server`     |        117,890 |         524,288 | `sha512-y1YXbFHj1+6pxinfAhITC3GNFLSlfBLe3MadvumzT00tEmhwBEjUYGyhMswCYtXukiwAccrA8YD+Ohj0R4ybAQ==` |
| `create-airjam`       |     87,164,321 |     104,857,600 | `sha512-x53Ht6YQTxF4/nxNapCQwVB9eMlPzTk8HIIoM/MBxIcZ7SjIZw9LebD3lMVWxl2S8IOXvxxRUWhwdHwVb2lMYw==` |
| **Total**             | **89,546,135** | **110,100,480** | exact graph below ceiling                                                                         |

`create-airjam` is intentionally allowed to carry all six version-matched
scaffold templates for 1.0, but it represents 97% of the packed graph. That is
a clear post-contract optimization opportunity, not an unmeasured release
unknown and not a reason to weaken embedded template availability now.

## Lifecycle And Agent Proof

Every cell independently proved all of the following from the installed
candidate packages:

1. `npx --yes create-airjam@0.9.2` created and installed the `minimal` template
2. installed lockfile integrity matched the exact five packed candidate
   tarballs
3. no `workspace:`, `link:`, `file:`, private monorepo path, or retained
   workspace dependency survived
4. the scaffold exposed the canonical `dev`, `status`, `reset:local`, `mcp`,
   and `lint` scripts
5. `create-airjam`, the Air Jam CLI, the server, and the MCP server reported
   their shipped version
6. CLI help, topology, doctor, and project-scoped Codex discovery worked
7. the MCP handshake reported the installed server identity and all 26
   canonical Air Jam tools
8. managed development start, machine-readable status, and stop all passed
9. generated-project typecheck, lint, tests, and production build all passed

The shipped scaffold extraction contract was also identical in all cells: at
most 64 MiB compressed, 512 entries, 128 MiB total extracted bytes, 32 MiB per
file, and a 100:1 per-file and aggregate compression ratio. Extraction
preflights the complete archive, writes into a hidden sibling staging
directory, removes partial output on failure, and exposes the requested project
directory only after success.

## Defects The Matrix Removed

The first implementation did not pass by merely adding CI retries. Repeated
clean-room execution exposed product defects and the owning runtime boundaries
were corrected:

1. an existing public package with the same version could satisfy `npx` from a
   reused cache; the proof now uses an empty run-scoped cache and verifies
   tarball integrity end to end
2. environment loading could contaminate commands that promised JSON stdout;
   discovery and status now preserve the machine-output contract
3. Windows package-manager shims could not be launched like Unix executables;
   all supported command resolution now uses the portable process boundary
4. managed development did not supervise and terminate process trees reliably
   across operating systems; lifecycle ownership now lives in one portable
   supervisor
5. Node.js 24 changed child-process behavior used by MCP helpers; the supported
   execution path no longer depends on that obsolete behavior
6. ZIP timestamps, executable modes, and line endings made scaffold archives
   vary by build platform; generation is now deterministic and package builds
   are read-only checks of authored inputs
7. Windows short-path and canonical-path aliases could make Vite and libuv
   disagree about one workspace; path identity is now canonical and CI uses the
   runner-owned temporary root. This is consistent with the upstream
   [Node.js failure](https://github.com/nodejs/node/issues/63638) and
   [libuv path assertion](https://github.com/libuv/libuv/issues/5010)
8. the final evidence collector attempted to invoke Windows command shims with
   a Unix-only primitive; tool-version reads now share portable command
   resolution
9. normal CI concurrently exposed that controller IDs had only 32 random
   possibilities inside one millisecond; runtime IDs now use `crypto.randomUUID`
   with a monotonic collision-resistant fallback and deterministic regression
   coverage

The sequence matters: the support claim is credible because failures changed
the product architecture and its tests, rather than being hidden by exclusions
or platform-specific skips.

## Verification Record

The exact branch head passed:

```bash
pnpm check:ci
```

That command covered generated-platform integrity, repository and package
typechecking, lint, canonical guards, all test suites, all builds, and the
reconnect performance sanity contract. Focused contract suites additionally
covered resource exhaustion, malicious archives, deterministic archive output,
portable process and path behavior, controller-ID collision resistance, and
matrix aggregation failure modes. The same exact branch head passed the remote
CI run linked above.

The final remote proof passed:

```text
Public Install Matrix run 33312857389
6/6 support cells passed
aggregate evidence passed
```

The downloaded cell artifacts were then re-aggregated through the same
repo-owned machine surface:

```bash
pnpm --silent run repo -- release install-matrix aggregate \
  --evidence-root <six-downloaded-cell-documents> \
  --json
```

The result matched GitHub's retained aggregate. No npm package was published,
no release tag was changed, and no production service or data store was
mutated.

## Remaining Boundary

`G6-01` proves the public candidate package graph and clean installation support
matrix. It deliberately does not claim that the final 1.0 candidate has been
published to npm. Public prerelease publication, provenance verification,
immutable rehearsal, promotion, and final go/no-go remain governed by later
Gate 6 and Gate 7 work and require their explicit production approvals.

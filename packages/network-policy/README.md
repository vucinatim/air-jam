# Internal network policy

One pure address-classification owner for release-origin attestation and browser
worker egress. This private workspace package performs no DNS or network I/O.
Callers own resolution, connection pinning, and effect enforcement.

Build with `pnpm --filter @air-jam/network-policy build`; runtime imports and
types resolve to compiled ESM in `dist/`. Run the classifier regressions with
`pnpm --filter @air-jam/network-policy test`.

Public unicast, special-use rejection, and explicit loopback diagnostic behavior
are shared unchanged. This package is not part of the public game SDK.

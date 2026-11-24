import { describe, expect, it } from "vitest";
import { resolveClientAddress } from "../src/room-server/connection-limits";

describe("resolveClientAddress", () => {
  it("uses the direct handshake address by default for public peers", () => {
    expect(
      resolveClientAddress("203.0.113.20", "::ffff:198.51.100.10", "socket-1"),
    ).toBe("198.51.100.10");
  });

  it("trusts forwarded headers in auto mode when the peer looks like a local proxy hop", () => {
    expect(
      resolveClientAddress(
        "203.0.113.20, 10.0.0.2",
        "::ffff:10.1.2.3",
        "socket-1",
      ),
    ).toBe("203.0.113.20");
  });

  it("allows explicit proxy-header trust when deployments require it", () => {
    expect(
      resolveClientAddress(
        "203.0.113.20",
        "::ffff:198.51.100.10",
        "socket-1",
        "enabled",
      ),
    ).toBe("203.0.113.20");
  });

  it("can disable proxy-header trust completely", () => {
    expect(
      resolveClientAddress(
        "203.0.113.20",
        "::ffff:10.1.2.3",
        "socket-1",
        "disabled",
      ),
    ).toBe("10.1.2.3");
  });
});

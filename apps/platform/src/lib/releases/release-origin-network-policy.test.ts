import { describe, expect, it } from "vitest";
import {
  assessReleaseOriginAddresses,
  isLoopbackReleaseOriginAddress,
  isPublicReleaseOriginAddress,
} from "./release-origin-network-policy";

describe("release-origin network policy", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "2606:4700:4700::1111",
    "2a00:1450:4009:821::200e",
  ])("accepts public global-unicast address %s", (address) => {
    expect(isPublicReleaseOriginAddress(address)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.2.1",
    "192.0.0.9",
    "192.31.196.1",
    "192.52.193.1",
    "192.88.99.1",
    "192.168.0.1",
    "192.175.48.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "64:ff9b:1::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
    "2001:2::1",
    "2001:1::1",
    "2001:3::1",
    "2001:4:112::1",
    "2001:20::1",
    "2001:30::1",
    "2001:db8::1",
    "2620:4f:8000::1",
    "3fff::1",
  ])("rejects special-use address %s as public", (address) => {
    expect(isPublicReleaseOriginAddress(address)).toBe(false);
  });

  it("requires loopback syntax and exclusively loopback answers for diagnostics", () => {
    expect(
      assessReleaseOriginAddresses({
        hostnameIsLoopback: true,
        addresses: [
          { address: "127.0.0.1", family: 4 },
          { address: "::1", family: 6 },
        ],
      }).mode,
    ).toBe("loopback-diagnostic");
    expect(isLoopbackReleaseOriginAddress("::ffff:127.0.0.1")).toBe(true);
  });

  it("rejects poisoned localhost and mixed public/private answer sets", () => {
    expect(
      assessReleaseOriginAddresses({
        hostnameIsLoopback: true,
        addresses: [{ address: "169.254.169.254", family: 4 }],
      }).mode,
    ).toBe("rejected");
    expect(
      assessReleaseOriginAddresses({
        hostnameIsLoopback: false,
        addresses: [
          { address: "1.1.1.1", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ],
      }).mode,
    ).toBe("rejected");
  });
});

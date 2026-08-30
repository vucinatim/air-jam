import ipaddr from "ipaddr.js";

export type ResolvedReleaseOriginAddress = {
  address: string;
  family: 4 | 6;
};

const parseAddress = (address: string) => {
  try {
    return ipaddr.process(address);
  } catch {
    return null;
  }
};

export const isLoopbackReleaseOriginAddress = (address: string): boolean =>
  parseAddress(address)?.range() === "loopback";

export const isPublicReleaseOriginAddress = (address: string): boolean => {
  const parsed = parseAddress(address);
  if (!parsed || parsed.range() !== "unicast") return false;
  if (parsed.kind() === "ipv4") return true;

  // Public IPv6 global unicast lives in 2000::/3. Requiring both this range
  // and ipaddr's unicast classification excludes ULA, link/site-local,
  // multicast, documentation, benchmark, mapped-IPv4, and translation ranges.
  return parsed.match(ipaddr.parseCIDR("2000::/3"));
};

export const assessReleaseOriginAddresses = ({
  hostnameIsLoopback,
  addresses,
}: {
  hostnameIsLoopback: boolean;
  addresses: ResolvedReleaseOriginAddress[];
}): {
  mode: "public" | "loopback-diagnostic" | "rejected";
  allAddressesPublic: boolean;
  allAddressesLoopback: boolean;
} => {
  const allAddressesPublic =
    addresses.length > 0 &&
    addresses.every((entry) => isPublicReleaseOriginAddress(entry.address));
  const allAddressesLoopback =
    addresses.length > 0 &&
    addresses.every((entry) => isLoopbackReleaseOriginAddress(entry.address));

  return {
    mode:
      hostnameIsLoopback && allAddressesLoopback
        ? "loopback-diagnostic"
        : allAddressesPublic
          ? "public"
          : "rejected",
    allAddressesPublic,
    allAddressesLoopback,
  };
};

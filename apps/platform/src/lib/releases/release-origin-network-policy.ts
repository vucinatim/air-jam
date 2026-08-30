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

// Attestation may connect only to ordinary public unicast destinations. The
// library's range table intentionally groups several IANA special-purpose
// blocks under `unicast`, so keep those registries explicit here rather than
// allowing a package-version gap to become an SSRF path.
const SPECIAL_USE_IPV4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.31.196.0/24",
  "192.52.193.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "192.175.48.0/24",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
].map((cidr) => ipaddr.IPv4.parseCIDR(cidr));

const SPECIAL_USE_IPV6_CIDRS = [
  "::/128",
  "::1/128",
  "::ffff:0:0/96",
  "64:ff9b::/96",
  "64:ff9b:1::/48",
  "100::/64",
  "100:0:0:1::/64",
  "2001::/23",
  "2001:db8::/32",
  "2002::/16",
  "2620:4f:8000::/48",
  "3fff::/20",
  "5f00::/16",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
].map((cidr) => ipaddr.IPv6.parseCIDR(cidr));

export const isLoopbackReleaseOriginAddress = (address: string): boolean =>
  parseAddress(address)?.range() === "loopback";

export const isPublicReleaseOriginAddress = (address: string): boolean => {
  const parsed = parseAddress(address);
  if (!parsed || parsed.range() !== "unicast") return false;

  if (parsed instanceof ipaddr.IPv4) {
    return !SPECIAL_USE_IPV4_CIDRS.some((cidr) => parsed.match(cidr));
  }

  return (
    parsed.match(ipaddr.IPv6.parseCIDR("2000::/3")) &&
    !SPECIAL_USE_IPV6_CIDRS.some((cidr) => parsed.match(cidr))
  );
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

export type AllowedOrigins = string[] | "*";
export type ResolvedCorsOrigin = "*" | Array<string | RegExp>;

const LEADING_SUBDOMAIN_PATTERN = /^(https?):\/\/\*\.([^/:]+)(?::(\d+))?$/i;
const HOSTNAME_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const SUBDOMAIN_LABEL_PATTERN = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const compileOrigin = (origin: string): string | RegExp => {
  if (!origin.includes("*")) {
    return origin;
  }

  const match = LEADING_SUBDOMAIN_PATTERN.exec(origin);
  if (!match) {
    throw new Error(
      `Invalid AIR_JAM_ALLOWED_ORIGINS pattern "${origin}". ` +
        'Use a leading subdomain wildcard such as "https://*.vercel.app".',
    );
  }

  const [, protocol, hostname, port] = match;
  if (!hostname || !HOSTNAME_PATTERN.test(hostname)) {
    throw new Error(
      `Invalid AIR_JAM_ALLOWED_ORIGINS hostname in pattern "${origin}".`,
    );
  }

  const portPattern = port ? `:${escapeRegExp(port)}` : "";
  return new RegExp(
    `^${escapeRegExp(protocol)}://${SUBDOMAIN_LABEL_PATTERN}\\.${escapeRegExp(hostname)}${portPattern}$`,
    "i",
  );
};

export const resolveCorsOrigin = (
  input: AllowedOrigins | undefined,
  fallback: AllowedOrigins,
): ResolvedCorsOrigin => {
  if (input === "*") {
    return "*";
  }

  const origins = input && input.length > 0 ? input : fallback;
  if (origins === "*" || origins.includes("*")) {
    return "*";
  }

  return origins.map(compileOrigin);
};

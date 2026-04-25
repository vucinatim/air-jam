import {
  PLATFORM_PUBLIC_URL_FALLBACK,
  resolvePlatformPublicUrl,
} from "./platform-public-url";

export function getSiteUrl(): string {
  return resolvePlatformPublicUrl(process.env) || PLATFORM_PUBLIC_URL_FALLBACK;
}

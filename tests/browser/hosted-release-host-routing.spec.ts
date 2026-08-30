import { expect, test, type APIRequestContext } from "@playwright/test";

const platformPort = process.env.AIRJAM_SMOKE_PLATFORM_PORT ?? "3400";
const PLATFORM_AUTHORITY = `127.0.0.1:${platformPort}`;
const RELEASE_AUTHORITY = `releases.airjam.test:${platformPort}`;
const UNKNOWN_AUTHORITY = `unknown.airjam.test:${platformPort}`;
const RELEASE_PROOF_PATH = "/releases/host-boundary-proof";

const getWithoutRedirect = (
  request: APIRequestContext,
  path: string,
  authority: string,
) =>
  request.get(path, {
    failOnStatusCode: false,
    headers: { host: authority },
    maxRedirects: 0,
  });

test("real Next request routing derives the release boundary from the incoming Host", async ({
  request,
}) => {
  const directRelease = await getWithoutRedirect(
    request,
    RELEASE_PROOF_PATH,
    RELEASE_AUTHORITY,
  );

  // There is intentionally no application route at the proof path. Reaching
  // Next's downstream 404 proves the host gate allowed the release lane; the
  // old request.url implementation instead produced a self-redirect loop.
  expect(directRelease.status()).toBe(404);
  expect(directRelease.headers().location).toBeUndefined();
  expect(directRelease.headers()["x-airjam-content-class"]).toBe(
    "untrusted-release",
  );

  const releasePlatformRoute = await getWithoutRedirect(
    request,
    "/dashboard",
    RELEASE_AUTHORITY,
  );
  expect(releasePlatformRoute.status()).toBe(404);
  expect(releasePlatformRoute.headers()["cache-control"]).toBe("no-store");

  const platformReleaseRoute = await getWithoutRedirect(
    request,
    RELEASE_PROOF_PATH,
    PLATFORM_AUTHORITY,
  );
  expect(platformReleaseRoute.status()).toBe(307);
  expect(platformReleaseRoute.headers().location).toBe(
    `http://${RELEASE_AUTHORITY}${RELEASE_PROOF_PATH}`,
  );
  expect(platformReleaseRoute.headers()["cache-control"]).toBe("no-store");

  const unknownHost = await getWithoutRedirect(
    request,
    "/dashboard",
    UNKNOWN_AUTHORITY,
  );
  expect(unknownHost.status()).toBe(404);
  expect(unknownHost.headers()["cache-control"]).toBe("no-store");
});

import type { BrowserContext } from "playwright-core";
import { RELEASE_INSPECTION_ACCESS_HEADER } from "./release-inspection-access";

/** Private inspection authority belongs to one generation, not the browser. */
export const installReleaseInspectionRouting = async (
  context: BrowserContext,
  {
    generationUrl,
    token,
    requestTimeoutMs,
  }: { generationUrl: string; token: string; requestTimeoutMs: number },
): Promise<void> => {
  const generation = new URL(generationUrl);
  const assetPrefix = `${generation.pathname.replace(/\/$/, "")}/`;

  await context.route("**/*", async (route) => {
    try {
      const request = route.request();
      const url = new URL(request.url());
      const headers = Object.fromEntries(
        Object.entries(request.headers()).filter(
          ([name]) => name.toLowerCase() !== RELEASE_INSPECTION_ACCESS_HEADER,
        ),
      );
      const privateAsset =
        url.origin === generation.origin &&
        (url.pathname === generation.pathname ||
          url.pathname.startsWith(assetPrefix));

      if (!privateAsset) {
        await route.continue({ headers });
        return;
      }

      // continue({ headers }) carries overrides through redirects. Fetch one
      // response instead; browser-followed redirects cannot inherit this
      // fetch-only credential. Generation assets use canonical direct URLs.
      const response = await route.fetch({
        headers: { ...headers, [RELEASE_INSPECTION_ACCESS_HEADER]: token },
        maxRedirects: 0,
        maxRetries: 0,
        timeout: requestTimeoutMs,
      });
      try {
        await route.fulfill({ response });
      } finally {
        await response.dispose();
      }
    } catch {
      // Do not expose Playwright errors containing private request headers.
      // A closed context may already have disposed this route.
      await route.abort("failed").catch(() => undefined);
    }
  });
};

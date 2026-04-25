import http from "node:http";
import https from "node:https";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeUrl = (url, { allowInsecureLocalHttps = false } = {}) =>
  new Promise((resolve) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const options =
      target.protocol === "https:" && allowInsecureLocalHttps
        ? { rejectUnauthorized: false }
        : {};

    const request = client.request(target, options, (response) => {
      response.resume();
      response.on("end", () => {
        resolve(
          response.statusCode !== undefined &&
            response.statusCode >= 200 &&
            response.statusCode < 400,
        );
      });
    });

    request.setTimeout(5_000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
    request.end();
  });

export const waitForUrl = async (
  url,
  label,
  timeoutMs = 120_000,
  options = {},
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await probeUrl(url, options)) {
      return;
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
};

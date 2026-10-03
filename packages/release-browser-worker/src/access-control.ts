import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const parseBearerToken = (
  authorizationHeader: string | string[] | undefined,
): string | null => {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  return /^Bearer ([\x21-\x7e]+)$/i.exec(authorizationHeader)?.[1] ?? null;
};

export const isAuthorized = ({
  request,
  accessToken,
}: {
  request: IncomingMessage;
  accessToken: string;
}): boolean => {
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return false;
  }
  const token = parseBearerToken(request.headers.authorization);
  if (token === null) return false;
  const supplied = Buffer.from(token);
  const expected = Buffer.from(accessToken);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
};

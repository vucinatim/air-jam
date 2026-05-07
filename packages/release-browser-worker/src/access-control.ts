import type { IncomingMessage } from "node:http";

export const parseBearerToken = (
  authorizationHeader: string | string[] | undefined,
): string | null => {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, value] = authorizationHeader.trim().split(/\s+/, 2);
  if (!scheme || !value || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return value;
};

export const isAuthorized = ({
  request,
  accessToken,
}: {
  request: IncomingMessage;
  accessToken: string | null;
}): boolean => {
  if (!accessToken) {
    return true;
  }

  return parseBearerToken(request.headers.authorization) === accessToken;
};

import {
  AIRJAM_DEV_LOG_EVENTS,
  clientSocketEvents,
  ErrorCode,
  SOCKET_INGRESS_ABUSE_LIMIT,
  SOCKET_INGRESS_WINDOW_MS,
  SOCKET_PAYLOAD_BOUNDS,
  type ClientToServerEvents,
} from "@air-jam/sdk/protocol";
import type { ServerLogger } from "../logging/logger.js";
import type { RateLimitService } from "../services/rate-limit-service.js";
import type { AirJamSocket } from "./socket-types.js";

export function registerSocketIngress(
  socket: AirJamSocket,
  limiter: RateLimitService,
  logger: ServerLogger,
): void {
  let rejected = 0;
  let rateLimited = 0;
  let windowStart = limiter.now();
  let logTimer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (logTimer) clearTimeout(logTimer);
    logTimer = undefined;
    windowStart = limiter.now();
    if (!rejected) return;
    logger.warn(
      {
        event: AIRJAM_DEV_LOG_EVENTS.socket.ingressRejected,
        data: {
          rejectedCount: rejected,
          rateLimitedCount: rateLimited,
          windowMs: SOCKET_INGRESS_WINDOW_MS,
        },
      },
      "Dropped invalid or excessive socket input",
    );
    rejected = 0;
    rateLimited = 0;
  };
  socket.on("disconnect", flush);
  socket.use((packet, next) => {
    if (socket.disconnected) return;
    if (limiter.now() - windowStart >= SOCKET_INGRESS_WINDOW_MS) flush();
    const [event, payload] = packet;
    const known = Object.hasOwn(clientSocketEvents, event);
    const name = event as keyof ClientToServerEvents;
    const contract = known ? clientSocketEvents[name] : undefined;
    const lane = contract?.lane ?? "lifecycle";
    const allowed = limiter.check(
      `socket-ingress:${socket.id}:${lane}`,
      SOCKET_PAYLOAD_BOUNDS[lane].events,
      SOCKET_INGRESS_WINDOW_MS,
    ).allowed;
    const acknowledgement =
      typeof packet.at(-1) === "function" ? packet.at(-1) : undefined;
    const policy = contract?.acknowledgement ?? "none";
    const shapeValid =
      packet.length === (acknowledgement ? 3 : 2) &&
      (policy !== "required" || acknowledgement !== undefined);
    const parsed =
      allowed && contract && shapeValid
        ? contract.schema.safeParse(payload)
        : undefined;
    if (parsed?.success) {
      packet[1] = parsed.data;
      next();
      return;
    }
    rejected += 1;
    if (!allowed) rateLimited += 1;
    const code = allowed ? ErrorCode.INVALID_PAYLOAD : ErrorCode.RATE_LIMITED;
    const message = allowed
      ? "Invalid socket event payload or arguments."
      : "Socket event rate limit exceeded.";
    if (acknowledgement) {
      if (name === "controller:action_rpc")
        acknowledgement({
          ok: false,
          status: "rejected",
          source: "server",
          reason: allowed ? "invalid_payload" : "rate_limited",
          message,
        });
      else if (name === "controller:leasedControl")
        acknowledgement({
          status: "rejected",
          reason: allowed ? "invalid_request" : "rate_limited",
        });
      else if (name === "runtime:error_report")
        acknowledgement({
          ok: false,
          code: allowed ? "invalid_payload" : "rate_limited",
        });
      else acknowledgement({ ok: false, code, message });
    }
    if (!logTimer) {
      logTimer = setTimeout(flush, SOCKET_INGRESS_WINDOW_MS);
      logTimer.unref();
    }
    if (rejected >= SOCKET_INGRESS_ABUSE_LIMIT) {
      socket.emit("server:error", {
        code: ErrorCode.SOCKET_ABUSE,
        message:
          "Socket disconnected after repeated invalid or excessive input.",
      });
      socket.disconnect(true);
    }
  });
}

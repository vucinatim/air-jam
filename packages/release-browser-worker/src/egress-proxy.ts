import { isPublicReleaseOriginAddress } from "@air-jam/network-policy";
import dns from "node:dns/promises";
import http, {
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import net, { type Socket } from "node:net";
import path from "node:path";

// The release contract permits 250 MiB / 5,000 extracted files. Leave room
// for a full artifact fetch plus protocol overhead and ordinary external assets.
const SESSION_BYTES = 512 * 1024 * 1024;
const SESSION_REQUESTS = 10_000;
const CONCURRENT_CONNECTIONS = 32;
const CONNECT_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 30_000;

/** Fixed per-browser totals, kept pure so exact boundaries need no bulk IO. */
export const createBrowserEgressBudget = () => {
  let requests = 0;
  let bytes = 0;
  const withinBudget = () =>
    requests <= SESSION_REQUESTS && bytes <= SESSION_BYTES;
  return {
    recordRequest: () => {
      requests++;
      return withinBudget();
    },
    recordBytes: (length: number) => {
      bytes += length;
      return withinBudget();
    },
  };
};

type Destination = {
  hostname: string;
  port: number;
  host: string;
  pathname: string;
};

const destination = (
  target: string | undefined,
  tunnel: boolean,
  websocket = false,
): Destination => {
  if (
    !target ||
    /[\s\\#]/.test(target) ||
    /^(?:http|ws):\/\/[^/?]*@/i.test(target)
  )
    throw new Error("Invalid proxy target");
  if (tunnel && !/^(?:\[[0-9a-f:]+\]|[^:/?#@]+):\d+$/i.test(target))
    throw new Error("Invalid CONNECT target");
  if (
    !tunnel &&
    !(
      websocket
        ? /^(?:http|ws):\/\/[^/?#]+(?:[/?]|$)/i
        : /^http:\/\/[^/?#]+(?:[/?]|$)/i
    ).test(target)
  )
    throw new Error("Absolute HTTP target required");
  const url = new URL(tunnel ? `http://${target}` : target);
  if (
    (url.protocol !== "http:" && !(websocket && url.protocol === "ws:")) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Invalid proxy target");
  const port = tunnel
    ? Number(target.slice(target.lastIndexOf(":") + 1))
    : Number(url.port || 80);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid proxy port");
  return {
    hostname: url.hostname.replace(/^\[|\]$/g, ""),
    port,
    host: url.host,
    pathname: `${url.pathname}${url.search}`,
  };
};

const forwardHeaders = (headers: IncomingHttpHeaders): IncomingHttpHeaders => {
  const stripped = new Set([
    "connection",
    "proxy-connection",
    "proxy-authorization",
    "proxy-authenticate",
    "keep-alive",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);
  for (const name of String(headers.connection ?? "").split(","))
    stripped.add(name.trim().toLowerCase());
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !stripped.has(name.toLowerCase()),
    ),
  );
};

const rejectCapacity = (socket: Socket) => {
  socket.end(
    "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 1\r\nContent-Length: 0\r\n\r\n",
    () => socket.destroy(),
  );
};

/** A single browser's bounded, public-only egress path; no destination data is logged. */
export const startBrowserEgressProxy = async ({
  socketPath,
  onExhausted,
}: {
  socketPath: string;
  onExhausted: () => void;
}): Promise<{ port: number; close: () => Promise<void> }> => {
  if (!path.isAbsolute(socketPath))
    throw new Error("An absolute private socket path is required.");
  const clients = new Set<Socket>();
  const upstreams = new Set<Socket>();
  const resolvers = new Set<dns.Resolver>();
  let stopped = false;
  let exhausted = false;
  let activeRequests = 0;
  const budget = createBrowserEgressBudget();
  let closing: Promise<void> | undefined;
  const servers: http.Server[] = [];

  const close = (): Promise<void> => {
    if (closing) return closing;
    stopped = true;
    for (const resolver of resolvers) resolver.cancel();
    for (const socket of [...clients, ...upstreams]) socket.destroy();
    closing = Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            if (!server.listening) {
              resolve();
              return;
            }
            server.close(() => resolve());
          }),
      ),
    ).then(() => undefined);
    return closing;
  };
  const exhaust = () => {
    if (exhausted || stopped) return;
    exhausted = true;
    void close();
    onExhausted();
  };
  const countBytes = (chunk: Buffer) => {
    if (!budget.recordBytes(chunk.length)) exhaust();
  };
  const track = (socket: Socket, collection: Set<Socket>) => {
    collection.add(socket);
    // HTTP pipelining can put up to 32 DNS cancellations on the same socket.
    if (collection === clients)
      socket.setMaxListeners(CONCURRENT_CONNECTIONS + 10);
    socket.on("data", countBytes);
    socket.on("error", () => socket.destroy());
    socket.once("close", () => collection.delete(socket));
    socket.setTimeout(IDLE_TIMEOUT_MS, () => socket.destroy());
  };
  const acceptRequest = () => {
    if (stopped) return null;
    if (!budget.recordRequest()) {
      exhaust();
      return null;
    }
    if (activeRequests >= CONCURRENT_CONNECTIONS) return null;
    activeRequests++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        activeRequests--;
      }
    };
  };

  const dial = async (target: Destination, client: Socket): Promise<Socket> => {
    if (stopped || client.destroyed) throw new Error("Proxy closed");
    let addresses: { address: string; family: number }[];
    const family = net.isIP(target.hostname);
    if (family) addresses = [{ address: target.hostname, family }];
    else {
      // Query A and AAAA directly, not /etc/hosts or OS search-domain aliases.
      // Both answer sets must be public; this resolver is cancellable on close.
      const resolver = new dns.Resolver();
      resolvers.add(resolver);
      const cancel = () => resolver.cancel();
      client.once("close", cancel);
      const deadline = setTimeout(cancel, CONNECT_TIMEOUT_MS);
      const resolveFamily = async (family: 4 | 6) => {
        try {
          const values =
            family === 4
              ? await resolver.resolve4(target.hostname)
              : await resolver.resolve6(target.hostname);
          return values.map((address) => ({ address, family }));
        } catch (error) {
          if (
            ["ENODATA", "ENOTFOUND"].includes(
              (error as NodeJS.ErrnoException).code ?? "",
            )
          )
            return [];
          throw error;
        }
      };
      try {
        addresses = (
          await Promise.all([resolveFamily(4), resolveFamily(6)])
        ).flat();
      } finally {
        clearTimeout(deadline);
        client.off("close", cancel);
        resolvers.delete(resolver);
        resolver.cancel();
      }
    }
    if (stopped || client.destroyed) throw new Error("Proxy closed");
    if (
      !addresses.length ||
      addresses.some(({ address }) => !isPublicReleaseOriginAddress(address))
    )
      throw new Error("Destination rejected");
    const selected = addresses[0]!;
    // Dial the vetted numeric address, never the hostname that could rebind.
    const upstream = net.connect({
      host: selected.address,
      port: target.port,
      family: selected.family,
    });
    track(upstream, upstreams);
    upstream.pause();
    return await new Promise<Socket>((resolve, reject) => {
      const cancel = () => {
        cleanup();
        upstream.destroy();
        reject(new Error("Proxy connection closed"));
      };
      const deadline = setTimeout(cancel, CONNECT_TIMEOUT_MS);
      const cleanup = () => {
        clearTimeout(deadline);
        client.off("close", cancel);
        upstream.off("connect", connected);
        upstream.off("close", cancel);
      };
      const connected = () => {
        cleanup();
        if (stopped || client.destroyed) cancel();
        else resolve(upstream);
      };
      client.once("close", cancel);
      upstream.once("close", cancel);
      upstream.once("connect", connected);
    });
  };

  const handleHttp = async (
    request: IncomingMessage,
    response: ServerResponse,
  ) => {
    if (!clients.has(request.socket)) {
      request.socket.destroy();
      return;
    }
    const release = acceptRequest();
    if (!release) {
      if (!stopped) {
        response.writeHead(503, { connection: "close", "retry-after": "1" });
        response.end("Proxy capacity unavailable", () =>
          request.socket.destroy(),
        );
      }
      return;
    }
    response.once("close", release);
    let upstream: Socket | undefined;
    try {
      const target = destination(request.url, false);
      upstream = await dial(target, request.socket);
      if (stopped || response.destroyed) {
        upstream.destroy();
        return;
      }
      const outgoing = http.request(
        {
          method: request.method,
          host: target.hostname,
          port: target.port,
          path: target.pathname,
          headers: {
            ...forwardHeaders(request.headers),
            host: target.host,
            connection: "close",
          },
          createConnection: () => upstream!,
        },
        (remote) => {
          if (stopped || response.destroyed) {
            remote.destroy();
            return;
          }
          response.writeHead(remote.statusCode ?? 502, {
            ...forwardHeaders(remote.headers),
            connection: "close",
          });
          remote.pipe(response);
          remote.on("error", () => response.destroy());
        },
      );
      outgoing.once("socket", (socket) => socket.resume());
      outgoing.on("error", () => {
        if (!response.headersSent) {
          response.writeHead(502, { connection: "close" });
          response.end("Proxy request failed", () => request.socket.destroy());
        } else response.destroy();
      });
      response.once("close", () => outgoing.destroy());
      request.once("aborted", () => outgoing.destroy());
      request.pipe(outgoing);
    } catch {
      upstream?.destroy();
      if (!stopped && !response.destroyed) {
        response.writeHead(403, { connection: "close" });
        response.end("Proxy destination unavailable", () =>
          request.socket.destroy(),
        );
      }
    }
  };
  const handleConnect = async (
    request: IncomingMessage,
    client: Socket,
    head: Buffer,
  ) => {
    if (!clients.has(client)) {
      client.destroy();
      return;
    }
    const release = acceptRequest();
    if (!release) {
      if (!stopped) rejectCapacity(client);
      return;
    }
    client.once("close", release);
    client.pause();
    try {
      const upstream = await dial(destination(request.url, true), client);
      if (stopped || client.destroyed) {
        upstream.destroy();
        return;
      }
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      // CONNECT is opaque: TLS, including WSS, remains end-to-end.
      if (head.length) upstream.write(head);
      client.pipe(upstream).pipe(client);
      client.once("close", () => upstream.destroy());
      upstream.once("close", () => client.destroy());
    } catch {
      if (!client.destroyed)
        client.end(
          "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
          () => client.destroy(),
        );
    }
  };

  const handleUpgrade = async (
    request: IncomingMessage,
    client: Socket,
    head: Buffer,
  ) => {
    if (!clients.has(client)) {
      client.destroy();
      return;
    }
    const release = acceptRequest();
    if (!release) {
      if (!stopped) rejectCapacity(client);
      return;
    }
    client.once("close", release);
    client.pause();
    const reject = () => {
      if (!client.destroyed)
        client.end(
          "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
          () => client.destroy(),
        );
    };
    try {
      if (
        request.method !== "GET" ||
        request.headers.upgrade?.toLowerCase() !== "websocket"
      ) {
        reject();
        return;
      }
      const target = destination(request.url, false, true);
      const upstream = await dial(target, client);
      if (stopped || client.destroyed) {
        upstream.destroy();
        return;
      }
      const outgoing = http.request({
        method: "GET",
        host: target.hostname,
        port: target.port,
        path: target.pathname,
        headers: {
          ...forwardHeaders(request.headers),
          host: target.host,
          connection: "Upgrade",
          upgrade: "websocket",
        },
        createConnection: () => upstream,
      });
      outgoing.once("socket", (socket) => socket.resume());
      outgoing.once("error", reject);
      outgoing.once("response", (remote) => {
        remote.destroy();
        outgoing.destroy();
        reject();
      });
      client.once("close", () => upstream.destroy());
      outgoing.once("upgrade", (remote, upgraded, remoteHead) => {
        if (stopped || client.destroyed) {
          upgraded.destroy();
          return;
        }
        const headers = {
          ...forwardHeaders(remote.headers),
          connection: "Upgrade",
          upgrade: "websocket",
        };
        const lines = Object.entries(headers).flatMap(([name, value]) =>
          value === undefined
            ? []
            : (Array.isArray(value) ? value : [value]).map(
                (entry) => `${name}: ${entry}\r\n`,
              ),
        );
        client.write(
          `HTTP/1.1 101 Switching Protocols\r\n${lines.join("")}\r\n`,
        );
        if (remoteHead.length) client.write(remoteHead);
        if (head.length) upgraded.write(head);
        upgraded.once("close", () => client.destroy());
        client.pipe(upgraded).pipe(client);
      });
      outgoing.end();
    } catch {
      reject();
    }
  };

  const createServer = () => {
    const server = http.createServer(
      { maxHeaderSize: 16 * 1024 },
      (req, res) => {
        void handleHttp(req, res);
      },
    );
    servers.push(server);
    server.headersTimeout = CONNECT_TIMEOUT_MS;
    server.requestTimeout = 0; // Streaming is bounded by socket idle + session bytes.
    server.on("connection", (socket) => {
      if (stopped) {
        socket.destroy();
        return;
      }
      if (clients.size >= CONCURRENT_CONNECTIONS) {
        rejectCapacity(socket);
        return;
      }
      track(socket, clients);
    });
    server.on("connect", (request, socket, head) => {
      void handleConnect(request, socket as Socket, head);
    });
    server.on("upgrade", (request, socket, head) => {
      void handleUpgrade(request, socket as Socket, head);
    });
    server.on("clientError", (_error, socket) => socket.destroy());
    return server;
  };
  const tcp = createServer();
  const unix = createServer();
  const listen = (server: http.Server, target: net.ListenOptions) =>
    new Promise<void>((resolve, reject) => {
      const failed = (error: Error) => {
        server.off("listening", ready);
        reject(error);
      };
      const ready = () => {
        server.off("error", failed);
        resolve();
      };
      server.once("error", failed);
      server.once("listening", ready);
      server.listen(target);
    });
  try {
    await listen(tcp, { host: "127.0.0.1", port: 0 });
    await listen(unix, { path: socketPath });
    const address = tcp.address();
    if (!address || typeof address === "string")
      throw new Error("Proxy did not bind");
    return { port: address.port, close };
  } catch {
    await close();
    throw new Error("Browser egress proxy could not start.");
  }
};

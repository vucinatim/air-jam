import { appRouter } from "@/server/api/root";
import { createTRPCContext, getTRPCResponseMeta } from "@/server/api/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    responseMeta: getTRPCResponseMeta,
  });

export { handler as GET, handler as POST };

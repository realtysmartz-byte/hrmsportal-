import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@realty-smartz/api";
import { after } from "next/server";
import { createTRPCContext } from "@/server/context";

export const dynamic = "force-dynamic";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req, afterResponse: after }),
  });

export { handler as GET, handler as POST };

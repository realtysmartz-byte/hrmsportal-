import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@realty-smartz/api";
import superjson from "superjson";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCReact<AppRouter>();

export function getTRPCClient() {
  return trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
      }),
    ],
  });
}

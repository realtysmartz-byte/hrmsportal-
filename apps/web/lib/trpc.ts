import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@realty-smartz/api";
import superjson from "superjson";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")) {
    return process.env.NEXTAUTH_URL;
  }
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
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

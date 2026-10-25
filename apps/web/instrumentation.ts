export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const dns = await import("node:dns");
      if (typeof dns.setDefaultResultOrder === "function") {
        dns.setDefaultResultOrder("ipv4first");
      }
    } catch {}
    try {
      const { prisma } = await import("@realty-smartz/db");
      void prisma.$connect().catch(() => {});
    } catch {}
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}

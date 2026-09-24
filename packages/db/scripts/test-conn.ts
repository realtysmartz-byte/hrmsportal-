import { PrismaClient } from "@prisma/client";

async function test(url: string, label: string) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const e = await prisma.employee.findUnique({
      where: { email: "admin@realtysmartz.com" },
      select: { email: true },
    });
    console.log(label, "OK", e?.email);
  } catch (err) {
    console.log(label, "FAIL", err instanceof Error ? err.message : err);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const pass = "%40Realtysmartz123";
  const host = "aws-0-ap-northeast-2.pooler.supabase.com";

  await test(
    `postgresql://postgres.vlhtdswfzdbnktqyjqff:${pass}@${host}:6543/postgres?pgbouncer=true&sslmode=require`,
    "6543-pgbouncer"
  );
  await test(
    `postgresql://postgres.vlhtdswfzdbnktqyjqff:${pass}@${host}:5432/postgres?sslmode=require`,
    "5432-session"
  );
}

main();

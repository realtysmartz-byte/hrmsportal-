import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const updated = await prisma.employee.update({
    where: { email: "admin@realtysmartz.com" },
    data: { passwordHash, status: "ACTIVE" },
  });
  const ok = await bcrypt.compare("Admin@123", updated.passwordHash);
  console.log("reset_ok", ok, updated.email, updated.employeeCode);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

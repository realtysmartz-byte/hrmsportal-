import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findUnique({
    where: { email: "admin@realtysmartz.com" },
  });
  if (!emp) {
    console.log("NOT_FOUND");
    return;
  }
  console.log("FOUND", emp.employeeCode, emp.role, emp.status);
  const ok = await bcrypt.compare("Admin@123", emp.passwordHash);
  console.log("Admin@123 matches:", ok);
  if (!ok) {
    const newHash = await bcrypt.hash("Admin@123", 12);
    await prisma.employee.update({
      where: { id: emp.id },
      data: { passwordHash: newHash },
    });
    console.log("RESET_DONE");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

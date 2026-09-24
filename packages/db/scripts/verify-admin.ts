import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@realtysmartz.com";
  const employee = await prisma.employee.findUnique({ where: { email } });

  if (!employee) {
    console.log("NOT_FOUND");
    const count = await prisma.employee.count();
    console.log("employee_count", count);
    return;
  }

  console.log({
    id: employee.id,
    email: employee.email,
    status: employee.status,
    code: employee.employeeCode,
    hashPrefix: employee.passwordHash.slice(0, 15),
  });

  console.log("Admin@123", await bcrypt.compare("Admin@123", employee.passwordHash));
  console.log("Employee@123", await bcrypt.compare("Employee@123", employee.passwordHash));
  console.log("employee_count", await prisma.employee.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

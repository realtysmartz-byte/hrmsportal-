import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@realtysmartz.com";
  const password = "Admin@123";
  const hash = await bcrypt.hash(password, 12);

  const emp = await prisma.employee.update({
    where: { email },
    data: {
      passwordHash: hash,
      status: "ACTIVE",
      role: "ADMIN",
    },
  });

  const ok = await bcrypt.compare(password, emp.passwordHash);
  console.log(
    JSON.stringify({
      email: emp.email,
      code: emp.employeeCode,
      role: emp.role,
      passwordOk: ok,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

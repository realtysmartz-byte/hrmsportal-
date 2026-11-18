import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, generateDutyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeId = session.user.id;
  const token = generateDutyToken(employeeId);
  return NextResponse.json({ employeeId, token });
}

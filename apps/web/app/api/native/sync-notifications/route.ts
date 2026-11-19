import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@realty-smartz/db";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}

async function handleSync(req: Request) {
  let employeeId: string | null = null;
  let employeeEmail: string | null = null;

  // 1. Check session
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    employeeId = session.user.id;
  }

  // 2. Check query params
  const url = new URL(req.url);
  const qEmpId = url.searchParams.get("employeeId");
  const qEmpEmail = url.searchParams.get("employeeEmail");
  if (!employeeId && qEmpId) employeeId = qEmpId;
  if (!employeeEmail && qEmpEmail) employeeEmail = qEmpEmail;

  // 3. Check headers
  const hEmpId = req.headers.get("x-employee-id");
  if (!employeeId && hEmpId) employeeId = hEmpId;

  // 4. Check body if POST
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!employeeId && body?.employeeId) employeeId = body.employeeId;
      if (!employeeEmail && body?.employeeEmail) employeeEmail = body.employeeEmail;
    } catch {
      // ignore
    }
  }

  // Resolve employee
  let emp = null;
  if (employeeId) {
    emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, email: true },
    });
  }

  if (!emp && employeeEmail) {
    emp = await prisma.employee.findFirst({
      where: { email: { equals: employeeEmail.trim(), mode: "insensitive" } },
      select: { id: true, firstName: true, email: true },
    });
  }

  if (!emp) {
    return NextResponse.json({ ok: false, error: "Employee not found", notifications: [] }, { status: 404 });
  }

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48 hours

  // Query recent targets, verified activities, and leave responses
  const [recentTargets, recentActivities, recentLeaves] = await Promise.all([
    prisma.employeeTarget.findMany({
      where: {
        employeeId: emp.id,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        title: true,
        month: true,
        year: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.targetActivity.findMany({
      where: {
        target: { employeeId: emp.id },
        verifiedAt: { gte: since },
      },
      select: {
        id: true,
        title: true,
        status: true,
        quantity: true,
        verifiedAt: true,
        targetItem: { select: { title: true } },
      },
      orderBy: { verifiedAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: emp.id,
        OR: [
          { respondedAt: { gte: since } },
          { managerRespondedAt: { gte: since } },
        ],
      },
      select: {
        id: true,
        status: true,
        managerStatus: true,
        numberOfDays: true,
        respondedAt: true,
        managerRespondedAt: true,
        leaveType: { select: { name: true } },
      },
      orderBy: { appliedAt: "desc" },
      take: 5,
    }),
  ]);

  const notifications: Array<{
    id: string;
    title: string;
    body: string;
    type: "target" | "leave";
    createdAt: string;
  }> = [];

  for (const t of recentTargets) {
    notifications.push({
      id: `target-assigned-${t.id}`,
      title: `🎯 Target Assigned: ${t.title || "Performance Targets"}`,
      body: `A new performance target sheet has been assigned for ${t.month}/${t.year}. Tap to review deliverables.`,
      type: "target",
      createdAt: t.createdAt.toISOString(),
    });
  }

  for (const a of recentActivities) {
    const isApproved = a.status === "APPROVED";
    notifications.push({
      id: `target-act-${a.id}-${a.status}`,
      title: isApproved ? "✅ Deliverable Verified & Approved" : "⚠️ Deliverable Needs Attention",
      body: `${a.title || a.targetItem?.title || "Deliverable"} (${a.quantity} qty) was ${isApproved ? "verified & approved" : "rejected"} by management.`,
      type: "target",
      createdAt: (a.verifiedAt || new Date()).toISOString(),
    });
  }

  for (const l of recentLeaves) {
    const isApproved = l.status === "APPROVED" || l.managerStatus === "APPROVED";
    const statusText = l.status === "APPROVED" ? "Approved by HR" : l.managerStatus === "APPROVED" ? "Approved by Manager" : "Rejected";
    notifications.push({
      id: `leave-res-${l.id}-${l.status}`,
      title: isApproved ? `🌴 Leave Application ${statusText}` : "❌ Leave Application Rejected",
      body: `Your ${l.leaveType.name} (${l.numberOfDays}d) request has been ${statusText.toLowerCase()}.`,
      type: "leave",
      createdAt: (l.respondedAt || l.managerRespondedAt || new Date()).toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    notifications,
  });
}

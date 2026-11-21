import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@realty-smartz/db";
import { authOptions } from "@/lib/auth";
import { sendRawTelegramMessage } from "@realty-smartz/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: {
      issueCategory?: string;
      issueDetails?: string;
      deviceInfo?: string;
      employeeId?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "Invalid request payload format" },
        { status: 400 }
      );
    }

    if (!body.issueCategory) {
      return NextResponse.json(
        { ok: false, message: "Please select an issue category" },
        { status: 400 }
      );
    }

    // 1. Authenticate user from session or provided context
    const session = await getServerSession(authOptions);
    const employeeId = session?.user?.id || body.employeeId;

    if (!employeeId) {
      return NextResponse.json(
        { ok: false, message: "Session expired or unauthorized. Please sign in again." },
        { status: 401 }
      );
    }

    // 2. Fetch employee profile
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        email: true,
        phone: true,
        organizationId: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
    });

    const orgId = employee?.organizationId || session?.user?.organizationId || "org_default_realty";

    // 3. Find active Telegram configuration with valid token and chatId
    let config = await prisma.telegramAutomationConfig.findFirst({
      where: {
        organizationId: orgId,
        enabled: true,
        channelType: "ATTENDANCE_LEAVE",
        NOT: [{ botToken: null }, { botToken: "" }, { chatId: null }, { chatId: "" }],
      },
    });

    if (!config) {
      config = await prisma.telegramAutomationConfig.findFirst({
        where: {
          enabled: true,
          NOT: [{ botToken: null }, { botToken: "" }, { chatId: null }, { chatId: "" }],
        },
      });
    }

    if (!config) {
      config = await prisma.telegramAutomationConfig.findFirst({
        where: {
          NOT: [{ botToken: null }, { botToken: "" }, { chatId: null }, { chatId: "" }],
        },
      });
    }

    const botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = config?.chatId || process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn("[support-ticket] No active telegram bot found in config or env");
      return NextResponse.json(
        {
          ok: false,
          message: "Support channel is currently undergoing scheduled maintenance. Please notify administration directly.",
        },
        { status: 503 }
      );
    }

    // 4. Build professional ticket dispatch
    const nowIST = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const empName = employee
      ? `${employee.firstName} ${employee.lastName || ""}`.trim()
      : session?.user?.name || "Employee";
    const empCode = employee?.employeeCode || "N/A";
    const empDept = employee?.department?.name || "N/A";
    const empDesig = employee?.designation?.title || "N/A";
    const empPhone = employee?.phone || "N/A";
    const empEmail = employee?.email || session?.user?.email || "N/A";

    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const safeCategory = escapeHtml(body.issueCategory.trim());
    const safeDetails = body.issueDetails?.trim()
      ? escapeHtml(body.issueDetails.trim())
      : "<i>No additional notes provided</i>";
    const safeDevice = body.deviceInfo ? escapeHtml(body.deviceInfo) : "Web / Mobile App";

    const html = [
      `🚨 <b>HRMS Employee Support Ticket</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 <b>Employee:</b> ${escapeHtml(empName)} (<code>${escapeHtml(empCode)}</code>)`,
      `🏢 <b>Department:</b> ${escapeHtml(empDept)}`,
      `💼 <b>Designation:</b> ${escapeHtml(empDesig)}`,
      `📞 <b>Contact:</b> ${escapeHtml(empPhone)} | ✉️ <code>${escapeHtml(empEmail)}</code>`,
      ``,
      `⚠️ <b>Reported Issue:</b>`,
      `👉 <b>${safeCategory}</b>`,
      ``,
      `📝 <b>Notes / Description:</b>`,
      `${safeDetails}`,
      ``,
      `📱 <b>Device Info:</b> <code>${safeDevice}</code>`,
      `🕒 <b>Reported At:</b> ${nowIST} IST`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ].join("\n");

    const result = await sendRawTelegramMessage(botToken, chatId, html);

    if (!result.ok) {
      console.error("[support-ticket] Telegram dispatch failed:", result.error);
      return NextResponse.json(
        {
          ok: false,
          message: "Unable to dispatch support ticket at this time. Please try again.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Your support request has been submitted successfully.",
      sentAt: nowIST,
    });
  } catch (err: any) {
    console.error("[support-ticket] Unhandled error:", err);
    return NextResponse.json(
      {
        ok: false,
        message: err?.message || "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}

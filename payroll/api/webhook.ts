import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import { payoutProvider } from "../services/payoutProvider";
import { safeExecuteRaw, checkTableExists } from "../services/salaryCalculator";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // Signature verification is mandatory for security
    const isValid = payoutProvider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("[PAYROLL_WEBHOOK_WARNING] Rejected webhook with invalid signature.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const eventData = JSON.parse(rawBody);
    const eventType = eventData.event;
    const payoutEntity = eventData.payload?.payout?.entity;

    if (!payoutEntity) {
      return NextResponse.json({ status: "ignored" });
    }

    const providerPayoutId = payoutEntity.id;
    let newStatus: "queued" | "processing" | "paid" | "failed" | null = null;
    let failureReason: string | null = null;

    if (eventType === "payout.processed") {
      newStatus = "paid";
    } else if (eventType === "payout.reversed" || eventType === "payout.rejected" || eventType === "payout.failed") {
      newStatus = "failed";
      failureReason = payoutEntity.status_details?.description || "Payout failed or was reversed by bank";
    } else if (eventType === "payout.queued") {
      newStatus = "queued";
    } else if (eventType === "payout.pending") {
      newStatus = "processing";
    }

    if (newStatus && providerPayoutId) {
      await safeExecuteRaw(
        prisma,
        `UPDATE payroll_payouts 
         SET status = $1, failure_reason = $2, updated_at = NOW()
         WHERE provider_payout_id = $3`,
        newStatus,
        failureReason,
        providerPayoutId
      );

      const tableExists = await checkTableExists(prisma, "payroll_audit_log");
      if (tableExists) {
        const auditId = `audit_wh_${Date.now()}`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO payroll_audit_log (id, action, performed_by, details, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          auditId,
          "WEBHOOK_STATUS_UPDATE",
          "RAZORPAYX_WEBHOOK",
          JSON.stringify({ eventType, providerPayoutId, newStatus, failureReason })
        ).catch(() => {});
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[PAYROLL_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}


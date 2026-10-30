import crypto from "node:crypto";
import { maskAccountNumber } from "./encryption";

export interface PayoutRequest {
  employeeId: string;
  employeeName: string;
  accountNumber: string;
  ifsc: string;
  amount: number; // in INR
  month: number;
  year: number;
  narration: string;
  idempotencyKey: string;
}

export interface PayoutResult {
  providerPayoutId: string;
  status: "queued" | "processing" | "paid" | "failed";
  failureReason?: string;
  rawResponse?: Record<string, any>;
}

export interface PayoutProvider {
  name: string;
  isSandbox: boolean;
  createPayout(req: PayoutRequest): Promise<PayoutResult>;
  getPayoutStatus(providerPayoutId: string): Promise<PayoutResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  getCompanyAccountInfo(): {
    providerName: string;
    maskedAccountNumber: string;
    isSandbox: boolean;
  };
}

/**
 * RazorpayX implementation of the PayoutProvider interface.
 * Supports both test/sandbox simulation and live RazorpayX Payouts API.
 */
export class RazorpayXPayoutProvider implements PayoutProvider {
  public name = "RazorpayX";

  public get isSandbox(): boolean {
    const sandboxEnv = process.env.PAYROLL_SANDBOX_MODE;
    // Default to sandbox mode if not explicitly set to 'false' or if keys are missing
    if (sandboxEnv === "false" && process.env.RAZORPAYX_KEY_ID && process.env.RAZORPAYX_KEY_SECRET) {
      return false;
    }
    return true;
  }

  public getCompanyAccountInfo() {
    const rawAccount = process.env.RAZORPAYX_ACCOUNT_NUMBER || "781234567890";
    return {
      providerName: this.name,
      maskedAccountNumber: maskAccountNumber(rawAccount),
      isSandbox: this.isSandbox,
    };
  }

  public async createPayout(req: PayoutRequest): Promise<PayoutResult> {
    if (this.isSandbox) {
      // Sandbox mode: Simulate realistic asynchronous bank payout queueing
      const simId = `pout_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        providerPayoutId: simId,
        status: "paid", // Instant completion in test mode
        rawResponse: {
          simulated: true,
          mode: "sandbox",
          idempotencyKey: req.idempotencyKey,
          amount_paise: Math.round(req.amount * 100),
        },
      };
    }

    const keyId = process.env.RAZORPAYX_KEY_ID;
    const keySecret = process.env.RAZORPAYX_KEY_SECRET;
    const companyAccount = process.env.RAZORPAYX_ACCOUNT_NUMBER;

    if (!keyId || !keySecret || !companyAccount) {
      throw new Error("RazorpayX credentials or company account number not configured in environment variables.");
    }

    const amountInPaise = Math.round(req.amount * 100);
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const payload = {
      account_number: companyAccount,
      amount: amountInPaise,
      currency: "INR",
      mode: "NEFT",
      purpose: "salary",
      fund_account: {
        account_type: "bank_account",
        bank_account: {
          name: req.employeeName,
          ifsc: req.ifsc,
          account_number: req.accountNumber,
        },
        contact: {
          name: req.employeeName,
          type: "employee",
        },
      },
      queue_if_low_balance: true,
      reference_id: req.idempotencyKey,
      narration: req.narration.slice(0, 30),
    };

    try {
      const response = await fetch("https://api.razorpay.com/v1/payouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authHeader}`,
          "X-Payout-Idempotency": req.idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDesc = data.error?.description || data.error?.message || "RazorpayX Payout API request failed";
        return {
          providerPayoutId: data.id || `pout_failed_${Date.now()}`,
          status: "failed",
          failureReason: errorDesc,
          rawResponse: data,
        };
      }

      // Map RazorpayX payout status to standardized status
      let standardStatus: "queued" | "processing" | "paid" | "failed" = "processing";
      if (data.status === "processed") standardStatus = "paid";
      else if (data.status === "queued") standardStatus = "queued";
      else if (data.status === "pending" || data.status === "processing") standardStatus = "processing";
      else if (data.status === "reversed" || data.status === "rejected" || data.status === "failed") standardStatus = "failed";

      return {
        providerPayoutId: data.id,
        status: standardStatus,
        failureReason: data.status_details?.description,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        providerPayoutId: `pout_err_${Date.now()}`,
        status: "failed",
        failureReason: err.message || "Network error contacting RazorpayX API",
      };
    }
  }

  public async getPayoutStatus(providerPayoutId: string): Promise<PayoutResult> {
    if (this.isSandbox || providerPayoutId.startsWith("pout_sim_")) {
      return {
        providerPayoutId,
        status: "paid",
        rawResponse: { simulated: true },
      };
    }

    const keyId = process.env.RAZORPAYX_KEY_ID;
    const keySecret = process.env.RAZORPAYX_KEY_SECRET;
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1/payouts/${providerPayoutId}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        providerPayoutId,
        status: "failed",
        failureReason: data.error?.description || "Failed to retrieve status",
      };
    }

    let standardStatus: "queued" | "processing" | "paid" | "failed" = "processing";
    if (data.status === "processed") standardStatus = "paid";
    else if (data.status === "queued") standardStatus = "queued";
    else if (data.status === "pending" || data.status === "processing") standardStatus = "processing";
    else if (data.status === "reversed" || data.status === "rejected" || data.status === "failed") standardStatus = "failed";

    return {
      providerPayoutId: data.id,
      status: standardStatus,
      failureReason: data.status_details?.description,
      rawResponse: data,
    };
  }

  public verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    try {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
      return crypto.timingSafeEqual(Buffer.from(expectedSignature, "utf8"), Buffer.from(signature, "utf8"));
    } catch {
      return false;
    }
  }
}

// Export singleton provider instance
export const payoutProvider: PayoutProvider = new RazorpayXPayoutProvider();


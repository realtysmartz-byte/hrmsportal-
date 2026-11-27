import nodemailer from "nodemailer";

export interface SmtpConfig {
  host?: string | null;
  port?: number | null;
  secure?: boolean | null;
  user?: string | null;
  pass?: string | null;
  from?: string | null;
}

export interface ActiveSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function getSmtpConfig(): ActiveSmtpConfig {
  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER || "info@realtysmartz.in";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || `Realty Smartz HRMS <${user}>`;

  return { host, port, secure, user, pass, from };
}

function splitEmails(raw: string | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Admin inbox — default realtysmartz@gmail.com */
export function getAdminNotifyEmails(): string[] {
  return splitEmails(process.env.ADMIN_NOTIFY_EMAIL, ["realtysmartz@gmail.com"]);
}

/** HR inbox — default hr@realtysmartz.in */
export function getHrNotifyEmails(): string[] {
  return splitEmails(process.env.HR_NOTIFY_EMAIL, ["hr@realtysmartz.in"]);
}

/** Admin + HR (unique), used as CC on employee activity mails */
export function getStaffNotifyEmails(): string[] {
  return [...new Set([...getAdminNotifyEmails(), ...getHrNotifyEmails()])];
}

function uniqueEmails(list: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const e = item?.trim();
    if (!e) continue;
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Employee only in To. Admin/HR/manager go in BCC so addresses stay private
 * (CC would expose staff emails to the employee in most mail clients).
 */
function employeeWithStaffBcc(
  employeeEmail: string,
  extra?: (string | null | undefined)[]
): { to: string[]; bcc: string[] } {
  const to = uniqueEmails([employeeEmail]);
  const staff = getStaffNotifyEmails();
  const bcc = uniqueEmails([...staff, ...(extra ?? [])]).filter(
    (e) => !to.some((t) => t.toLowerCase() === e.toLowerCase())
  );
  return { to, bcc };
}

export function isSmtpConfigured(): boolean {
  const cfg = getSmtpConfig();
  return Boolean(cfg.host && cfg.user && cfg.pass);
}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let cachedTransporterKey = "";

function getTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return null;

  const key = `${cfg.host}|${cfg.port}|${cfg.secure}|${cfg.user}|${cfg.pass}`;
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;
  cachedTransporter?.close();

  cachedTransporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    rateDelta: 2000,
    rateLimit: 1,
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    // Hostinger TLS options
    tls: {
      rejectUnauthorized: false,
    },
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

export type MailPayload = {
  to: string | string[];
  /** Never put staff here — use bcc so employee cannot see Admin/HR addresses */
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Strips basic HTML tags to create clean plain-text fallback
 * (Spam filters heavily penalize HTML without text fallback)
 */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** Modern Realty Smartz Portal design tokens for clean corporate email */
const BRAND = "#2563EB"; // Blue accent for links/buttons
const BRAND_LINE = "#E5E7EB"; // Light clean border line
const INK = "#111827"; // Dark heading and primary text
const MUTED = "#4B5563"; // Secondary text
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function appBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL;
  if (url && !url.includes("localhost")) return url.replace(/\/$/, "");
  return "https://rshrms.in";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Two-column clean key-value rows in normal email styling (clean, border-based, no card box) */
export function detailsTable(rows: [string, string][]): string {
  const tr = rows
    .map(
      ([label, value], i) => `<tr>
          <td style="padding:8px 12px 8px 0;font-size:13px;color:#4B5563;font-weight:500;width:34%;border-bottom:1px solid #E5E7EB;vertical-align:top;font-family:${FONT};">${escapeHtml(label)}</td>
          <td style="padding:8px 0 8px 12px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #E5E7EB;vertical-align:top;font-family:${FONT};">${escapeHtml(String(value))}</td>
        </tr>`
    )
    .join("");
  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:14px 0 16px 0;border-top:1px solid #E5E7EB;border-collapse:collapse;">${tr}</table>`;
}

/**
 * Standard corporate business email layout.
 * Clean, standard white background, no outer grey box, no nested cards, natural text flow.
 */
function layout(args: {
  title: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
  body: string;
  actionButton?: { text: string; url: string; color?: string };
}) {
  const buttonColor = args.actionButton?.color || "#2563EB";
  const buttonHtml = args.actionButton
      ? `<table border="0" cellspacing="0" cellpadding="0" style="margin:22px 0 8px 0;">
        <tr>
          <td style="background-color:${buttonColor};border-radius:4px;">
            <a href="${args.actionButton.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 22px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:13px;font-family:${FONT};border-radius:4px;">${escapeHtml(args.actionButton.text)}</a>
          </td>
        </tr>
      </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FFFFFF;font-family:${FONT};color:#1F2937;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#FFFFFF;padding:24px 16px;">
    <tr>
      <td align="left">
        <div style="max-width:580px;margin:0 auto;text-align:left;">
          <!-- Corporate header line -->
          <div style="padding-bottom:14px;border-bottom:1px solid #E5E7EB;margin-bottom:20px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align:middle;">
                  <span style="font-size:16px;font-weight:700;color:#111827;letter-spacing:-0.2px;font-family:${FONT};">Realty Smartz</span>
                  <span style="display:inline-block;margin:0 6px;color:#9CA3AF;">&bull;</span>
                  <span style="font-size:13px;font-weight:600;color:#2563EB;font-family:${FONT};">HRMS</span>
                </td>
                <td align="right" style="vertical-align:middle;font-size:12px;color:#6B7280;font-family:${FONT};">
                  Internal Notification
                </td>
              </tr>
            </table>
          </div>

          <!-- Main title -->
          <h1 style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#111827;line-height:1.35;letter-spacing:-0.2px;font-family:${FONT};">${escapeHtml(args.title)}</h1>

          <!-- Body content -->
          <div style="font-size:14px;line-height:1.6;color:#374151;font-family:${FONT};">${args.body}</div>

          ${buttonHtml}

          <!-- Normal corporate email sign-off -->
          <div style="margin-top:26px;padding-top:18px;border-top:1px solid #E5E7EB;font-size:13px;line-height:1.6;color:#4B5563;font-family:${FONT};">
            <p style="margin:0 0 4px 0;">Warm regards,</p>
            <p style="margin:0;font-weight:700;color:#111827;font-family:${FONT};">HR Operations Team</p>
            <p style="margin:0;color:#4B5563;font-family:${FONT};">Realty Smartz Private Limited</p>
            <p style="margin:4px 0 0 0;font-size:12px;color:#9CA3AF;font-family:${FONT};">11th Floor, Spaze Palazo, Sector 69, Gurugram &bull; <a href="https://www.realtysmartz.in" target="_blank" style="color:#2563EB;text-decoration:none;">www.realtysmartz.in</a></p>
          </div>

          <!-- Subtle confidentiality note -->
          <div style="margin-top:20px;font-size:11px;line-height:1.5;color:#9CA3AF;font-family:${FONT};">
            This is an automated operational notification from Realty Smartz HRMS. Please do not reply directly to this email.
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends transactional email with spam-safe headers.
 * From must match authenticated Hostinger mailbox (SPF/DKIM).
 */
export async function sendMail(
  payload: MailPayload
): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransporter();
  const cfg = getSmtpConfig();

  if (!transporter) {
    console.info(
      "[email] SMTP not configured — skipped:",
      payload.subject,
      "→",
      payload.to
    );
    return {
      success: false,
      error: "SMTP service is not configured in backend environment.",
    };
  }

  const user = cfg.user || "info@realtysmartz.in";
  // From display name + address MUST use the authenticated mailbox domain
  const from = `Realty Smartz HRMS <${user}>`;
  const textContent = payload.text || stripHtmlToText(payload.html);

  try {
    const toList = Array.isArray(payload.to) ? payload.to : [payload.to];
    const ccList = payload.cc
      ? Array.isArray(payload.cc)
        ? payload.cc
        : [payload.cc]
      : [];
    const bccList = payload.bcc
      ? Array.isArray(payload.bcc)
        ? payload.bcc
        : [payload.bcc]
      : [];
    const to = toList.join(", ");
    const ccRaw = ccList.length ? ccList.join(", ") : undefined;
    const bccRaw = bccList.length ? bccList.join(", ") : undefined;

    const mailOptions = {
      from,
      sender: user,
      replyTo: user,
      to,
      ...(ccRaw ? { cc: ccRaw } : {}),
      ...(bccRaw ? { bcc: bccRaw } : {}),
      subject: payload.subject,
      html: payload.html,
      text: textContent,
      // Envelope MAIL FROM = authenticated user (helps SPF)
      envelope: {
        from: user,
        to: [...toList, ...ccList, ...bccList],
      },
      headers: {
        "List-Unsubscribe": `<mailto:${user}?subject=Unsubscribe%20HRMS>`,
        "X-Entity-Ref-ID": `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
      },
    };

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const activeTransporter = getTransporter();
        if (!activeTransporter) break;
        await activeTransporter.sendMail(mailOptions);
        console.info(
          "[email] Sent:",
          payload.subject,
          "| to:",
          to,
          bccRaw ? `| bcc: ${bccList.length} staff` : ""
        );
        return { success: true };
      } catch (sendErr: unknown) {
        const d =
          sendErr && typeof sendErr === "object"
            ? (sendErr as { code?: unknown; responseCode?: unknown })
            : {};
        const respCode = typeof d.responseCode === "number" ? d.responseCode : 0;
        const isTransient = respCode === 451 || respCode === 421 || d.code === "ECONNECTION" || d.code === "ETIMEDOUT";
        if (isTransient && attempt < maxAttempts) {
          cachedTransporter?.close();
          cachedTransporter = null;
          cachedTransporterKey = "";
          await new Promise((r) => setTimeout(r, attempt * 3000));
          continue;
        }
        throw sendErr;
      }
    }
    return { success: false, error: "SMTP transporter unavailable." };
  } catch (err: unknown) {
    const details =
      err && typeof err === "object"
        ? (err as { code?: unknown; responseCode?: unknown })
        : {};
    const code =
      typeof details.code === "string" ? details.code.slice(0, 40) : "UNKNOWN";
    const responseCode =
      typeof details.responseCode === "number" ? details.responseCode : null;
    console.error(
      `[email] Delivery failed (code: ${code}${responseCode == null ? "" : `, SMTP response: ${responseCode}`
      }).`
    );
    return {
      success: false,
      error:
        responseCode != null && responseCode >= 400 && responseCode < 500
          ? "Email provider temporarily refused delivery. Please retry later."
          : "Email delivery failed. Check the email service configuration.",
    };
  }
}

function formatInDate(value?: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * 1. Welcome Email on User / Employee Creation
 */
export async function notifyWelcomeEmployee(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  rawPassword: string;
  role: string;
  departmentName?: string | null;
  designationTitle?: string | null;
  dateOfJoining?: Date | string | null;
  loginUrl?: string;
}) {
  const loginUrl = args.loginUrl || `${appBaseUrl()}/login`;

  const dojFormatted = args.dateOfJoining
    ? new Date(args.dateOfJoining).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "Immediate";

  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 14px 0;">Welcome to Realty Smartz Private Limited. Your HRMS employee portal account is active. Here are your account credentials and details:</p>
    ${detailsTable([
    ["Employee Code", args.employeeCode],
    ["Work Email", args.employeeEmail],
    ["Login Password", args.rawPassword],
    ["Role", args.role],
    ["Department", args.departmentName || "General"],
    ["Designation", args.designationTitle || "—"],
    ["Date of Joining", dojFormatted],
  ])}
    <p style="margin:14px 0 0 0;font-size:13px;color:#6B7280;">Please sign in to the employee portal and change your password upon your first login.</p>
  `;

  const html = layout({
    title: "Welcome to Realty Smartz",
    body,
    actionButton: {
      text: "Open Employee Portal",
      url: loginUrl,
    },
  });

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail);

  return sendMail({
    to,
    bcc,
    subject: `Realty Smartz HRMS — Welcome ${args.employeeName} (${args.employeeCode})`,
    html,
  });
}

/**
 * 2. Punching Details / Check-In Notification (Anti-Spam & Clean)
 */
export async function notifyPunchDetails(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  checkInTime: Date;
  status: "PRESENT" | "LATE" | "HALF_DAY" | string;
  address?: string | null;
  withinGeofence: boolean;
  managerEmail?: string | null;
}) {
  const timeFormatted = args.checkInTime.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const dateFormatted = args.checkInTime.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const isHalfDay = args.status === "HALF_DAY";
  const isLate = args.status === "LATE" || isHalfDay;
  const geoText = args.withinGeofence
    ? "Verified Inside Office Geofence"
    : "Outside Office Geofence Boundary";

  const note = isHalfDay
    ? "Punch after 11:30 AM is marked as Half Day. Contact HR if pre-approved."
    : isLate
      ? "Standard check-in is before 10:00 AM. This punch is logged as Late."
      : "Have a productive day at Realty Smartz.";

  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your check-in has been successfully recorded on Realty Smartz HRMS.</p>
    ${detailsTable([
    ["Employee", `${args.employeeName} (${args.employeeCode})`],
    ["Date", dateFormatted],
    ["Check-In Time", timeFormatted],
    ["Attendance Status", args.status],
    ["Geofence", geoText],
    ["Location", args.address || "Office HQ"],
  ])}
    <p style="margin:12px 0 0 0;font-size:13px;color:#6B7280;">${note}</p>
  `;

  const html = layout({
    title: isHalfDay ? "Half Day Marked" : isLate ? "Late Check-In" : "Check-In Confirmed",
    body,
  });

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  const subject = isHalfDay
    ? `Attendance — Half Day | ${args.employeeName} (${timeFormatted})`
    : isLate
      ? `Attendance — Late Check-In | ${args.employeeName} (${timeFormatted})`
      : `Attendance — Check-In | ${args.employeeName} (${timeFormatted})`;

  return sendMail({
    to,
    bcc,
    subject,
    html,
  });
}

/**
 * 3. Check-Out Notification
 */
export async function notifyCheckOutDetails(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  checkOutTime: Date;
  totalHours?: number | string | null;
  address?: string | null;
  managerEmail?: string | null;
  /** Set when the employee clocked out before the end of their working day. */
  expectedOutTime?: string;
}) {
  const timeFormatted = args.checkOutTime.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const isEarly = Boolean(args.expectedOutTime);

  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your check-out has been recorded for the day.</p>
    ${detailsTable([
    ["Employee", `${args.employeeName} (${args.employeeCode})`],
    ["Check-Out Time", timeFormatted],
    ["Total Hours", `${args.totalHours ?? "—"} hrs`],
    ["Location", args.address || "Office HQ"],
    ...(isEarly
      ? ([["Note", `Early check-out before ${args.expectedOutTime}`]] as [string, string][])
      : []),
  ])}
  `;

  const html = layout({
    title: isEarly ? "Early Check-Out" : "Check-Out Confirmed",
    body,
  });

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: isEarly
      ? `Attendance — Early Check-Out | ${args.employeeName} (${timeFormatted})`
      : `Attendance — Check-Out | ${args.employeeName} (${timeFormatted})`,
    html,
  });
}

/**
 * 4. Backward-compatible Late Punch notifier
 */
export async function notifyLatePunch(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  checkInTime: Date;
  address?: string | null;
  withinGeofence: boolean;
  managerEmail?: string | null;
}) {
  return notifyPunchDetails({
    ...args,
    status: "LATE",
  });
}

/**
 * 5. Outside Geofence notification
 */
export async function notifyOutsideGeofence(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  checkInTime: Date;
  address?: string | null;
  managerEmail?: string | null;
}) {
  const time = args.checkInTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your check-in at <strong>${escapeHtml(time)}</strong> was marked outside the office geofence boundary.</p>
    ${detailsTable([
    ["Employee", `${args.employeeName} (${args.employeeCode})`],
    ["Check-In Time", time],
    ["Location", args.address || "Outside office boundary"],
  ])}
    <p style="margin:12px 0 0 0;font-size:13px;color:#6B7280;">Please ensure location services are enabled with precise GPS when punching attendance at the office.</p>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Attendance — Outside Geofence | ${args.employeeName}`,
    html: layout({
      title: "Outside Geofence Attendance",
      body,
    }),
  });
}

export async function notifyLeaveApplied(args: {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  managerEmail?: string | null;
}) {
  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your leave application has been submitted and is pending authorization.</p>
    ${detailsTable([
    ["Employee", args.employeeName],
    ["Work Email", args.employeeEmail],
    ["Leave Type", args.leaveType],
    ["From Date", args.startDate],
    ["To Date", args.endDate],
    ["Total Days", String(args.days)],
    ["Status", args.status],
    ["Reason", args.reason || "—"],
  ])}
    <p style="margin:12px 0 0 0;font-size:13px;color:#6B7280;">Important: Leave applications must be approved within 24 hours. Requests not approved within 24 hours will automatically be rejected by the system.</p>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Leave Application Submitted — ${args.employeeName} (${args.startDate} to ${args.endDate})`,
    html: layout({
      title: "Leave Request Submitted",
      body,
    }),
  });
}

export async function notifyLeaveManagerApproval(args: {
  employeeName: string;
  employeeEmail: string;
  managerName: string;
  managerNote?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
}) {
  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your leave request has been reviewed and approved by your reporting manager, <strong>${escapeHtml(args.managerName)}</strong>, and forwarded to HR for final sign-off.</p>
    ${detailsTable([
    ["Leave Type", args.leaveType],
    ["From Date", args.startDate],
    ["To Date", args.endDate],
    ["Total Days", String(args.days)],
    ["Manager Decision", "Approved"],
    ["Reporting Manager", args.managerName],
    ...(args.managerNote ? ([["Manager Remarks", args.managerNote]] as [string, string][]) : []),
    ["Current Status", "Pending HR Sign-Off"],
  ])}
    <p style="margin:12px 0 0 0;font-size:13px;color:#6B7280;">You will receive another notification once HR completes the final sign-off.</p>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail);

  return sendMail({
    to,
    bcc,
    subject: `Leave Manager Approved — ${args.employeeName} | ${args.leaveType}`,
    html: layout({
      title: "Leave Approved by Manager",
      body,
    }),
  });
}

export async function notifyLeaveDecision(args: {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  action: "APPROVED" | "REJECTED";
  note?: string | null;
  decisionBy?: string;
  managerEmail?: string | null;
}) {
  const isApproved = args.action === "APPROVED";
  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your leave request has been <strong>${isApproved ? "approved" : "rejected"}</strong>${args.decisionBy ? ` by ${escapeHtml(args.decisionBy)}` : ""}.</p>
    ${detailsTable([
    ["Leave Type", args.leaveType],
    ["From Date", args.startDate],
    ["To Date", args.endDate],
    ["Total Days", String(args.days)],
    ["Decision", isApproved ? "Approved" : "Rejected"],
    ...(args.note ? ([["Remarks / Note", args.note]] as [string, string][]) : []),
  ])}
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Leave ${args.action === "APPROVED" ? "Approved" : "Rejected"} — ${args.employeeName} | ${args.leaveType}`,
    html: layout({
      title: `Leave ${args.action === "APPROVED" ? "Approved" : "Rejected"}`,
      body,
    }),
  });
}

export async function notifyLeaveAutoRejected(args: {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  managerEmail?: string | null;
}) {
  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your leave request has been <strong>automatically rejected</strong> because it was not approved within the required 24-hour turnaround window.</p>
    ${detailsTable([
    ["Leave Type", args.leaveType],
    ["From Date", args.startDate],
    ["To Date", args.endDate],
    ["Total Days", String(args.days)],
    ["Reason Submitted", args.reason || "—"],
    ["Status", "Auto-Rejected (24-Hour Expiry)"],
  ])}
    <p style="margin:12px 0 0 0;font-size:13px;color:#6B7280;">Per company policy, leave applications must be authorized within 24 hours. If your leave is still required, please speak directly with your reporting manager or HR team and submit a new request if needed.</p>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Leave Auto-Rejected (24h Expiry) — ${args.employeeName} | ${args.leaveType}`,
    html: layout({
      title: "Leave Request Auto-Rejected",
      body,
    }),
  });
}

export async function notifyLeaveCancelled(args: {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
}) {
  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Your leave request has been cancelled.</p>
    ${detailsTable([
    ["Leave Type", args.leaveType],
    ["From Date", args.startDate],
    ["To Date", args.endDate],
    ["Total Days", String(args.days)],
    ["Status", "Cancelled"],
  ])}
  `;
  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail);
  return sendMail({
    to,
    bcc,
    subject: `Leave Cancelled — ${args.employeeName} (${args.startDate} to ${args.endDate})`,
    html: layout({
      title: "Leave Cancelled",
      body,
    }),
  });
}

/**
 * Status change: Active / Terminated / Resigned / Exit
 */
export async function notifyEmployeeStatusChange(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  previousStatus: string;
  newStatus: "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "TERMINATED" | "EXIT";
  departmentName?: string | null;
  designationTitle?: string | null;
  dateOfJoining?: Date | string | null;
  effectiveDate?: Date | string | null;
  note?: string | null;
}) {
  const effective = formatInDate(args.effectiveDate || new Date());
  const effectiveDateLabel =
    args.newStatus === "TERMINATED"
      ? "Termination Date"
      : args.newStatus === "RESIGNED"
        ? "Resignation Date"
        : args.newStatus === "EXIT"
          ? "Absconding Date"
          : "Effective Date";
  const meta: [string, string][] = [
    ["Employee", `${args.employeeName} (${args.employeeCode})`],
    ["Work Email", args.employeeEmail],
    ["Department", args.departmentName || "—"],
    ["Designation", args.designationTitle || "—"],
    ["Date of Joining", formatInDate(args.dateOfJoining)],
    ["Previous Status", args.previousStatus.replace("_", " ")],
    ["New Status", args.newStatus.replace("_", " ")],
    [effectiveDateLabel, effective],
  ];
  if (args.note) meta.push(["Note", args.note]);

  const configs: Record<
    string,
    { title: string; badge: string; intro: string; subject: string }
  > = {
    ACTIVE: {
      title: "Employee Activated",
      badge: "ACTIVE",
      intro: "Your account is active. You can sign in and mark attendance.",
      subject: `Employee Activated — ${args.employeeName} (${args.employeeCode})`,
    },
    TERMINATED: {
      title: "Employment Terminated",
      badge: "TERMINATED",
      intro: `Status set to Terminated effective ${effective}. Portal access is revoked until HR reactivates your account.`,
      subject: `Employee Terminated — ${args.employeeName} (${args.employeeCode})`,
    },
    RESIGNED: {
      title: "Resignation Recorded",
      badge: "RESIGNED",
      intro: `Status set to Resigned effective ${effective}. Portal access is revoked until HR reactivates your account.`,
      subject: `Employee Resigned — ${args.employeeName} (${args.employeeCode})`,
    },
    EXIT: {
      title: "Absconding Recorded",
      badge: "ABSCONDING",
      intro: `Status set to Absconding effective ${effective}. Portal access is revoked until HR reactivates your account.`,
      subject: `Employee Absconded — ${args.employeeName} (${args.employeeCode})`,
    },
    ON_LEAVE: {
      title: "On Leave",
      badge: "ON LEAVE",
      intro: `Status set to On Leave effective ${effective}.`,
      subject: `Employee On Leave — ${args.employeeName} (${args.employeeCode})`,
    },
  };

  const cfg = configs[args.newStatus] || configs.ACTIVE;
  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">${cfg.intro}</p>
    ${detailsTable(meta)}
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail);

  return sendMail({
    to,
    bcc,
    subject: cfg.subject,
    html: layout({
      title: cfg.title,
      body,
      actionButton:
        args.newStatus === "ACTIVE"
          ? { text: "Open Employee Portal", url: `${appBaseUrl()}/login` }
          : undefined,
    }),
  });
}

export async function notifyPolicyUpdate(args: {
  title: string;
  summary: string;
  recipientEmails: string[];
}) {
  if (args.recipientEmails.length === 0) return;
  const body = `
    <p style="margin:0 0 12px 0;">A company HR policy update has been published:</p>
    <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 8px 0;">${escapeHtml(args.title)}</p>
    <p style="margin:0;color:#4B5563;">${escapeHtml(args.summary)}</p>
  `;

  return sendMail({
    to: args.recipientEmails,
    subject: `HRMS Policy Update — ${args.title}`,
    html: layout({
      title: "Company Policy Update",
      body,
    }),
  });
}

/**
 * 6. Location Disabled / Denied Alert
 * Triggered when an employee attempts to check in or is active but device GPS / location is turned off or denied.
 */
export async function notifyLocationDisabledAlert(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  departmentName?: string | null;
  attemptTime: Date;
  reason?: string;
  deviceInfo?: string | null;
  managerEmail?: string | null;
}) {
  const timeFormatted = args.attemptTime.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateFormatted = args.attemptTime.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const body = `
    <p style="margin:0 0 12px 0;">Dear <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 12px 0;">Location services were detected as turned off or inaccessible during your attendance action.</p>
    ${detailsTable([
    ["Employee", `${args.employeeName} (${args.employeeCode})`],
    ["Work Email", args.employeeEmail],
    ["Department", args.departmentName || "—"],
    ["Date", dateFormatted],
    ["Time", `${timeFormatted} IST`],
    ["Reason", args.reason || "GPS / location permission off"],
  ])}
    <p style="margin:12px 0 0 0;font-size:13px;color:#6B7280;">Please ensure high-accuracy device GPS is enabled to complete attendance verification within the office geofence.</p>
  `;

  const html = layout({
    title: "Location Services Alert",
    body,
  });

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Attendance Alert — Location Services Disabled | ${args.employeeName}`,
    html,
  });
}

/**
 * 7. Test SMTP connection & send test email
 */
export async function testSmtpConnection(
  targetEmail: string
): Promise<{ success: boolean; message: string }> {
  const cfg = getSmtpConfig();
  if (!cfg.pass) {
    return {
      success: false,
      message: "SMTP is not configured in backend environment.",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      message: "Could not initialize SMTP transport.",
    };
  }

  try {
    await transporter.verify();
    const result = await sendMail({
      to: targetEmail,
      subject: "Realty Smartz HRMS — Email service verified",
      html: layout({
        title: "Email System Verified",
        body: `
          <p style="margin:0 0 10px 0;">Hostinger SMTP service is active and successfully configured for Realty Smartz HRMS.</p>
          <p style="margin:0;font-size:13px;color:#6B7280;">Welcome, attendance, leave, and status communications will be delivered in this clean corporate format.</p>
        `,
      }),
    });

    if (!result.success) {
      return {
        success: false,
        message: result.error || "Failed to deliver test email.",
      };
    }

    return {
      success: true,
      message: `Test email successfully sent to ${targetEmail}! Check inbox.`,
    };
  } catch (err: any) {
    console.error("[email] SMTP verification failed:", err);
    return {
      success: false,
      message: "SMTP connection or authentication failed. Please check server environment configuration.",
    };
  }
}

export async function getHrAndManagerEmails(
  prisma: {
    employee: {
      findMany: (args: {
        where: Record<string, unknown>;
        select: { email: true };
      }) => Promise<{ email: string }[]>;
      findUnique: (args: {
        where: { id: string };
        select: {
          email: true;
          firstName: true;
          lastName: true;
          employeeCode: true;
          manager: { select: { email: true } } | true;
        };
      }) => Promise<{
        email: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        manager: { email: string } | null;
      } | null>;
    };
  },
  employeeId: string
) {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      manager: { select: { email: true } },
    },
  });
  return emp;
}

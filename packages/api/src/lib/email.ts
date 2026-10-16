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
    maxConnections: 3,
    maxMessages: 100,
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

/** ID-card brand colours (same as employee ID card UI) */
const BRAND = "#1F5F7A";
const BRAND_LIGHT = "#7CC0E4";
const FONT = "Arial, Helvetica, sans-serif";

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

/** Two-column rows styled like ID-card info lines */
export function detailsTable(rows: [string, string][]): string {
  const tr = rows
    .map(
      ([label, value], i) => `<tr>
          <td style="padding:9px 0;font-size:13px;color:#1F2937;width:42%;font-weight:700;${i ? "border-top:1px solid #D7E8F2;" : ""}">${escapeHtml(label)}</td>
          <td style="padding:9px 0;font-size:13px;color:#111827;font-weight:600;${i ? "border-top:1px solid #D7E8F2;" : ""}">${escapeHtml(String(value))}</td>
        </tr>`
    )
    .join("");
  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 4px 0;border-collapse:collapse;">${tr}</table>`;
}

/**
 * ID-card style email shell (no signature block).
 * System fonts only — no external CSS/fonts (spam-safe).
 */
function layout(args: {
  title: string;
  badge?: string;
  badgeColor?: string;
  body: string;
  actionButton?: { text: string; url: string };
}) {
  const logo = `${appBaseUrl()}/logo.png`;
  const color = args.badgeColor || BRAND;

  const badgeHtml = args.badge
    ? `<span style="display:inline-block;padding:5px 12px;background:#E8F4FA;color:${color};border:1px solid #B8D9EA;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;font-family:${FONT};">${escapeHtml(args.badge)}</span>`
    : "";

  const buttonHtml = args.actionButton
    ? `<table border="0" cellspacing="0" cellpadding="0" style="margin:20px 0 4px 0;"><tr><td style="background:${BRAND};border-radius:8px;">
        <a href="${args.actionButton.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;font-family:${FONT};">${escapeHtml(args.actionButton.text)}</a>
      </td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF4F8;font-family:${FONT};color:#1F2937;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#EEF4F8;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- ID-card shell -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:420px;background-color:#FFFFFF;border-radius:22px;border:1px solid #D5E4EE;overflow:hidden;">
          <tr>
            <td style="height:5px;background:${BRAND};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Brand row (matches ID card) -->
          <tr>
            <td style="padding:20px 24px 8px 24px;background-color:#FAFCFE;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logo}" width="36" height="36" alt="Realty Smartz" style="display:block;border:0;" />
                  </td>
                  <td style="vertical-align:middle;padding-left:10px;">
                    <div style="font-size:12px;font-weight:800;letter-spacing:0.6px;color:${BRAND};font-family:${FONT};">REALTY SMARTZ</div>
                    <div style="font-size:11px;font-weight:600;color:${BRAND_LIGHT};letter-spacing:1px;font-family:${FONT};">HRMS</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <div style="width:3px;height:36px;background:${BRAND_LIGHT};border-radius:2px;font-size:0;">&nbsp;</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 24px 8px 24px;">
              ${badgeHtml}
              <h1 style="margin:12px 0 10px 0;font-size:20px;font-weight:700;color:#111827;line-height:1.3;font-family:${FONT};">${escapeHtml(args.title)}</h1>
              <div style="font-size:14px;line-height:1.6;color:#374151;font-family:${FONT};">${args.body}</div>
              ${buttonHtml}
            </td>
          </tr>

          <!-- Minimal company footer — no signature -->
          <tr>
            <td style="padding:16px 24px 22px 24px;border-top:1px solid #E3EEF6;">
              <div style="font-size:12px;font-weight:700;color:${BRAND};font-family:${FONT};">Realty Smartz Private Limited</div>
              <div style="font-size:11px;color:#6B7280;margin-top:4px;line-height:1.5;font-family:${FONT};">
                www.realtysmartz.in &nbsp;|&nbsp; info@realtysmartz.in<br />
                11th Floor, Spaze Palazo, Sector 69, Gurugram
              </div>
            </td>
          </tr>
        </table>

        <div style="max-width:420px;font-size:11px;color:#9CA3AF;line-height:1.5;padding:14px 8px 0 8px;text-align:center;font-family:${FONT};">
          Official HRMS notification from Realty Smartz. Please do not reply to this message.
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

    await transporter.sendMail({
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
    });
    console.info(
      "[email] Sent:",
      payload.subject,
      "| to:",
      to,
      bccRaw ? `| bcc: ${bccList.length} staff` : ""
    );
    return { success: true };
  } catch (err: any) {
    console.error("[email] send failed:", err);
    return { success: false, error: err?.message || String(err) };
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
    <p style="margin:0 0 12px 0;">Hi <strong>${escapeHtml(args.employeeName)}</strong>,</p>
    <p style="margin:0 0 14px 0;">Your Realty Smartz HRMS account is ready. Keep this employee card for your records:</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;margin:0 0 14px 0;">
      <tr>
        <td style="padding:16px 18px;">
          <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:10px;">${escapeHtml(args.employeeName)}</div>
          ${detailsTable([
            ["Employee Code", args.employeeCode],
            ["Work Email", args.employeeEmail],
            ["Login Password", args.rawPassword],
            ["Role", args.role],
            ["Department", args.departmentName || "General"],
            ["Designation", args.designationTitle || "—"],
            ["Date of Joining", dojFormatted],
          ])}
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#4B5563;">Please change your password after first login.</p>
  `;

  const html = layout({
    title: "Welcome to Realty Smartz",
    badge: "NEW EMPLOYEE",
    badgeColor: BRAND,
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

  const badge = isHalfDay ? "HALF DAY" : isLate ? "LATE" : "CHECK-IN";
  const note = isHalfDay
    ? "Punch after 11:30 AM is marked as Half Day. Contact HR if pre-approved."
    : isLate
      ? "Standard check-in is before 10:00 AM. This punch is logged as Late."
      : "Have a productive day at Realty Smartz.";

  const body = `
    <p style="margin:0 0 12px 0;">Hi <strong>${escapeHtml(args.employeeName)}</strong>, your check-in is recorded.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        ${detailsTable([
          ["Employee", `${args.employeeName} (${args.employeeCode})`],
          ["Date", dateFormatted],
          ["Time", timeFormatted],
          ["Status", args.status],
          ["Geofence", geoText],
          ["Location", args.address || "Office"],
        ])}
      </td></tr>
    </table>
    <p style="margin:12px 0 0 0;font-size:13px;color:#4B5563;">${note}</p>
  `;

  const html = layout({
    title: isHalfDay ? "Half Day Marked" : isLate ? "Late Check-In" : "Check-In Confirmed",
    badge,
    badgeColor: isLate ? "#B45309" : BRAND,
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
    cc,
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
    <p style="margin:0 0 12px 0;">Hi <strong>${escapeHtml(args.employeeName)}</strong>, your check-out is recorded.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        ${detailsTable([
          ["Employee", `${args.employeeName} (${args.employeeCode})`],
          ["Check-Out", timeFormatted],
          ["Total Hours", `${args.totalHours ?? "—"} hrs`],
          ["Location", args.address || "Office"],
          ...(isEarly
            ? ([["Note", `Early check-out before ${args.expectedOutTime}`]] as [string, string][])
            : []),
        ])}
      </td></tr>
    </table>
  `;

  const html = layout({
    title: isEarly ? "Early Check-Out" : "Check-Out Confirmed",
    badge: isEarly ? "EARLY" : "CHECK-OUT",
    badgeColor: isEarly ? "#B45309" : BRAND,
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
    <p style="margin:0 0 12px 0;">Hi <strong>${escapeHtml(args.employeeName)}</strong>, check-in at <strong>${escapeHtml(time)}</strong> was outside the office geofence.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        ${detailsTable([
          ["Employee", `${args.employeeName} (${args.employeeCode})`],
          ["Time", time],
          ["Location", args.address || "Outside office boundary"],
        ])}
      </td></tr>
    </table>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Attendance — Outside Geofence | ${args.employeeName}`,
    html: layout({
      title: "Outside Geofence",
      badge: "GEOFENCE",
      badgeColor: BRAND,
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
    <p style="margin:0 0 12px 0;">Leave request from <strong>${escapeHtml(args.employeeName)}</strong>.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        ${detailsTable([
          ["Employee", args.employeeName],
          ["Email", args.employeeEmail],
          ["Leave type", args.leaveType],
          ["From", args.startDate],
          ["To", args.endDate],
          ["Days", String(args.days)],
          ["Status", args.status],
          ["Reason", args.reason || "—"],
        ])}
      </td></tr>
    </table>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Leave ${args.status} — ${args.employeeName} (${args.startDate} to ${args.endDate})`,
    html: layout({
      title: "Leave Request Submitted",
      badge: args.status,
      badgeColor: BRAND,
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
}) {
  const body = `
    <p style="margin:0 0 12px 0;">Hi <strong>${escapeHtml(args.employeeName)}</strong>, your leave was <strong>${args.action === "APPROVED" ? "approved" : "rejected"}</strong>.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        ${detailsTable([
          ["Leave type", args.leaveType],
          ["From", args.startDate],
          ["To", args.endDate],
          ["Days", String(args.days)],
          ...(args.note ? ([["Note", args.note]] as [string, string][]) : []),
        ])}
      </td></tr>
    </table>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail);

  return sendMail({
    to,
    bcc,
    subject: `Leave ${args.action} — ${args.employeeName} | ${args.leaveType}`,
    html: layout({
      title: `Leave ${args.action === "APPROVED" ? "Approved" : "Rejected"}`,
      badge: args.action,
      badgeColor: BRAND,
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
    <p style="margin:0 0 12px 0;"><strong>${escapeHtml(args.employeeName)}</strong> cancelled a leave request.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        ${detailsTable([
          ["Leave type", args.leaveType],
          ["From", args.startDate],
          ["To", args.endDate],
          ["Days", String(args.days)],
        ])}
      </td></tr>
    </table>
  `;
  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail);
  return sendMail({
    to,
    bcc,
    subject: `Leave Cancelled — ${args.employeeName} (${args.startDate} to ${args.endDate})`,
    html: layout({
      title: "Leave Cancelled",
      badge: "CANCELLED",
      badgeColor: BRAND,
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
  const meta: [string, string][] = [
    ["Employee", `${args.employeeName} (${args.employeeCode})`],
    ["Work Email", args.employeeEmail],
    ["Department", args.departmentName || "—"],
    ["Designation", args.designationTitle || "—"],
    ["Date of Joining", formatInDate(args.dateOfJoining)],
    ["Previous Status", args.previousStatus.replace("_", " ")],
    ["New Status", args.newStatus.replace("_", " ")],
    ["Effective Date", effective],
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
      title: "Exit Recorded",
      badge: "EXIT",
      intro: `Status set to Exit effective ${effective}. Portal access is revoked until HR reactivates your account.`,
      subject: `Employee Exit — ${args.employeeName} (${args.employeeCode})`,
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
    <p style="margin:0 0 12px 0;">Hi <strong>${escapeHtml(args.employeeName)}</strong>, ${cfg.intro}</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:16px;font-weight:700;color:#111827;margin-bottom:10px;">${escapeHtml(args.employeeName)}</div>
        ${detailsTable(meta)}
      </td></tr>
    </table>
  `;

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail);

  return sendMail({
    to,
    bcc,
    subject: cfg.subject,
    html: layout({
      title: cfg.title,
      badge: cfg.badge,
      badgeColor: BRAND,
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
    <p>A company HR policy update was published:</p>
    <p style="font-size:16px;font-weight:700;color:#111827;">${args.title}</p>
    <p>${args.summary}</p>
  `;

  return sendMail({
    to: args.recipientEmails,
    subject: `HRMS Policy — ${args.title}`,
    html: layout({
      title: "Company Policy Update",
      badge: "POLICY",
      badgeColor: BRAND,
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
    <p style="margin:0 0 12px 0;">Location services were off during attendance for <strong>${escapeHtml(args.employeeName)}</strong>.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F7FBFD;border:1px solid #C5DCE8;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        ${detailsTable([
          ["Employee", `${args.employeeName} (${args.employeeCode})`],
          ["Email", args.employeeEmail],
          ["Department", args.departmentName || "—"],
          ["Date", dateFormatted],
          ["Time", `${timeFormatted} IST`],
          ["Reason", args.reason || "GPS / location permission off"],
        ])}
      </td></tr>
    </table>
    <p style="margin:12px 0 0 0;font-size:13px;color:#4B5563;">Turn on GPS to punch within the 200m office geofence.</p>
  `;

  const html = layout({
    title: "Location Services Off",
    badge: "LOCATION",
    badgeColor: BRAND,
    body,
  });

  const { to, bcc } = employeeWithStaffBcc(args.employeeEmail, [args.managerEmail]);

  return sendMail({
    to,
    bcc,
    subject: `Attendance — Location Off | ${args.employeeName} (${args.employeeCode})`,
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
        badge: "VERIFIED",
        badgeColor: BRAND,
        body: `
          <p style="margin:0 0 10px 0;">Hostinger SMTP is working for Realty Smartz HRMS.</p>
          <p style="margin:0;font-size:13px;color:#4B5563;">Welcome, attendance, leave, and status emails will use this ID-card style template.</p>
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

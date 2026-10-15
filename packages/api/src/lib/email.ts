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

export function getHrNotifyEmails(): string[] {
  const raw = process.env.HR_NOTIFY_EMAIL;
  if (!raw) return ["hr@realtysmartz.in"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
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

const BRAND = "#5D3EBC";
const FONT = "'Outfit','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function appBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL;
  if (url && !url.includes("localhost")) return url.replace(/\/$/, "");
  return "https://rshrms.in";
}

/** Two-column label/value card used inside email bodies */
export function detailsTable(rows: [string, string][]): string {
  const tr = rows
    .map(
      ([label, value], i) => `<tr>
          <td style="padding:10px 16px;font-size:13px;color:#6B7280;width:38%;${i ? "border-top:1px solid #EEF0F4;" : ""}">${label}</td>
          <td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;${i ? "border-top:1px solid #EEF0F4;" : ""}">${value}</td>
        </tr>`
    )
    .join("");
  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border:1px solid #EEF0F4;border-radius:10px;margin:20px 0;border-collapse:separate;">${tr}</table>`;
}

/**
 * Clean, inbox-friendly email layout: inline styles, table structure,
 * plain-text fallback is generated in sendMail.
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
    ? `<span style="display:inline-block;padding:4px 12px;background:${color}1A;color:${color};border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;">${args.badge}</span>`
    : "";

  const buttonHtml = args.actionButton
    ? `<table border="0" cellspacing="0" cellpadding="0" style="margin:24px 0 8px 0;"><tr><td style="background:${BRAND};border-radius:8px;">
        <a href="${args.actionButton.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 26px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;font-family:${FONT};">${args.actionButton.text}</a>
      </td></tr></table>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${args.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F5FA;font-family:${FONT};color:#1F2937;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F4F5FA;padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#FFFFFF;border-radius:14px;border:1px solid #E5E7EB;overflow:hidden;">
          <tr><td style="height:4px;background:${BRAND};font-size:0;line-height:0;">&nbsp;</td></tr>

          <tr>
            <td style="padding:22px 28px;border-bottom:1px solid #F0F1F5;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;"><img src="${logo}" width="34" height="34" alt="Realty Smartz" style="display:block;border:0;" /></td>
                  <td style="vertical-align:middle;padding-left:10px;">
                    <div style="font-size:16px;font-weight:600;color:#111827;line-height:1.2;">Realty Smartz</div>
                    <div style="font-size:11px;font-weight:500;color:${BRAND};letter-spacing:2px;">HRMS</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 8px 28px;">
              ${badgeHtml}
              <h1 style="margin:14px 0 14px 0;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">${args.title}</h1>
              <div style="font-size:14px;line-height:1.65;color:#374151;">${args.body}</div>
              ${buttonHtml}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 8px 28px;">
              <div style="background-color:#F7F5FD;border-radius:10px;padding:14px 16px;font-size:12px;color:#4B5563;line-height:1.6;">
                <div style="font-weight:600;color:#111827;margin-bottom:4px;">HR Policy Reminder</div>
                Weekly off: Tuesday &bull; Check-in before 10:00 AM (later is marked Late) &bull; Punch only within the office geofence
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 28px 26px 28px;">
              <div style="font-size:14px;color:#374151;">Warm regards,</div>
              <div style="font-size:14px;font-weight:600;color:#111827;margin:2px 0 14px 0;">HR Team</div>
              <table border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #F0F1F5;padding-top:14px;width:100%;">
                <tr>
                  <td style="width:46px;vertical-align:middle;padding-top:14px;"><img src="${logo}" width="40" height="40" alt="Realty Smartz" style="display:block;border:0;" /></td>
                  <td style="vertical-align:middle;padding:14px 0 0 10px;">
                    <div style="font-size:14px;font-weight:600;color:#111827;">Realty Smartz Private Limited</div>
                    <div style="font-size:12px;margin-top:2px;"><a href="https://realtysmartz.in" style="color:${BRAND};text-decoration:none;">realtysmartz.in</a> <span style="color:#D1D5DB;">|</span> <a href="mailto:info@realtysmartz.in" style="color:${BRAND};text-decoration:none;">info@realtysmartz.in</a></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="max-width:560px;font-size:11px;color:#9CA3AF;line-height:1.5;padding:14px 8px 0 8px;text-align:center;">
          This is an automated notification from Realty Smartz HRMS sent to registered employees.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends transactional email with anti-spam deliverability headers
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
  const from = cfg.from || `Realty Smartz HRMS <${user}>`;
  const domain = user.includes("@") ? user.split("@")[1] : "realtysmartz.in";
  const messageId = `<${Date.now()}.${Math.random()
    .toString(36)
    .substring(2, 9)}@${domain}>`;

  const textContent = payload.text || stripHtmlToText(payload.html);

  try {
    await transporter.sendMail({
      from,
      replyTo: user,
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      html: payload.html,
      text: textContent,
      headers: {
        "Message-ID": messageId,
        "X-Mailer": "Realty Smartz HRMS Mailer v2.0",
        "X-Auto-Response-Suppress": "All",
        "Auto-Submitted": "auto-generated",
        "Feedback-ID": `hrms-notification:${domain}`,
        "X-Entity-Ref-ID": messageId,
      },
    });
    console.info("[email] Successfully sent email to:", payload.to, "| Subject:", payload.subject);
    return { success: true };
  } catch (err: any) {
    console.error("[email] send failed:", err);
    return { success: false, error: err?.message || String(err) };
  }
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
    <p>Dear <strong>${args.employeeName}</strong>,</p>
    <p>Welcome to <strong>Realty Smartz Private Limited</strong>! Your employee account has been created successfully in our company HRMS Portal.</p>
    
    <div style="border:1px solid #EEF0F4;border-radius:10px;padding:14px 18px;margin:20px 0;">
      <h3 style="margin:0 0 12px 0;font-size:13px;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">Your Account Credentials</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size:13px;">
        <tr>
          <td width="35%" style="color:#6B7280;">Employee Code:</td>
          <td style="font-weight:700;color:#111827;">${args.employeeCode}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Official Email:</td>
          <td style="font-weight:700;color:#111827;">${args.employeeEmail}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Temporary Password:</td>
          <td style="font-family:monospace;background:#E2E8F0;padding:2px 8px;border-radius:4px;font-weight:700;color:#111827;display:inline-block;">${args.rawPassword}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Role / Access:</td>
          <td style="font-weight:600;color:#111827;">${args.role}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Department:</td>
          <td style="color:#111827;">${args.departmentName || "General"}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Designation:</td>
          <td style="color:#111827;">${args.designationTitle || "Specialist"}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Date of Joining:</td>
          <td style="color:#111827;">${dojFormatted}</td>
        </tr>
      </table>
    </div>

    <p style="margin:16px 0 8px 0;">Please log into the portal to complete your profile, submit onboarding documents, and mark your daily attendance:</p>
  `;

  const html = layout({
    title: `Welcome to Realty Smartz, ${args.employeeName}!`,
    badge: "ACCOUNT CREATED",
    badgeColor: "#10B981",
    body,
    actionButton: {
      text: "Log In to Employee Portal",
      url: loginUrl,
    },
  });

  const recipients = [args.employeeEmail, ...getHrNotifyEmails()];

  return sendMail({
    to: [...new Set(recipients)],
    subject: `Welcome to Realty Smartz — Your Portal Login & Employee Details (${args.employeeCode})`,
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

  const badge = isHalfDay ? "HALF DAY MARKED" : isLate ? "LATE PUNCH ALERT" : "ATTENDANCE VERIFIED";
  const badgeColor = isLate ? "#EF4444" : "#10B981";

  const body = `
    <p>Hi <strong>${args.employeeName}</strong>,</p>
    <p>Your daily check-in has been recorded in the Realty Smartz HRMS Portal:</p>

    <div style="border:1px solid #EEF0F4;border-radius:10px;padding:14px 18px;margin:20px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size:13px;">
        <tr>
          <td width="35%" style="color:#6B7280;">Employee:</td>
          <td style="font-weight:700;color:#111827;">${args.employeeName} (${args.employeeCode})</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Date & Time:</td>
          <td style="font-weight:700;color:#111827;">${dateFormatted} at ${timeFormatted}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Status:</td>
          <td style="font-weight:700;color:${isLate ? "#EF4444" : "#10B981"};">${args.status}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Geofence:</td>
          <td style="font-weight:600;color:${args.withinGeofence ? "#10B981" : "#EF4444"};">${geoText}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">GPS Location:</td>
          <td style="color:#111827;">${args.address || "Office Premise Coordinates"}</td>
        </tr>
      </table>
    </div>

    ${
      isHalfDay
        ? `<div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;border-radius:6px;color:#991B1B;font-size:13px;margin-bottom:16px;">
            <strong>Half Day Notice:</strong> You punched in after 11:30 AM, so today has been marked as a HALF DAY in your attendance. Please coordinate with HR if this was pre-approved.
          </div>`
        : isLate
        ? `<div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;border-radius:6px;color:#991B1B;font-size:13px;margin-bottom:16px;">
            <strong>Late Check-In Notice:</strong> Standard check-in time is before 10:00 AM. This punch has been logged as LATE in attendance audit logs. Please coordinate with HR if this was pre-approved.
          </div>`
        : `<p style="color:#10B981;font-weight:600;font-size:13px;">Have a productive workday at Realty Smartz!</p>`
    }
  `;

  const html = layout({
    title: isHalfDay ? "Half Day Marked" : isLate ? "Late Punch Recorded" : "Check-In Confirmed",
    badge,
    badgeColor,
    body,
  });

  const recipients = [args.employeeEmail, ...getHrNotifyEmails()];
  if (args.managerEmail) recipients.push(args.managerEmail);

  const subject = isHalfDay
    ? `⚠️ [Attendance Alert] Half Day Marked — ${args.employeeName} (${timeFormatted})`
    : isLate
    ? `⚠️ [Attendance Alert] Late Punch — ${args.employeeName} (${timeFormatted})`
    : `✅ [Attendance] Check-In Confirmed — ${args.employeeName} (${timeFormatted})`;

  return sendMail({
    to: [...new Set(recipients)],
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
    <p>Hi <strong>${args.employeeName}</strong>,</p>
    <p>Your check-out has been recorded successfully:</p>

    <div style="border:1px solid #EEF0F4;border-radius:10px;padding:14px 18px;margin:20px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size:13px;">
        <tr>
          <td width="35%" style="color:#6B7280;">Check-Out Time:</td>
          <td style="font-weight:700;color:#111827;">${timeFormatted}</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Total Hours:</td>
          <td style="font-weight:700;color:#10B981;">${args.totalHours ?? "—"} hrs</td>
        </tr>
        <tr>
          <td style="color:#6B7280;">Check-Out Location:</td>
          <td style="color:#111827;">${args.address || "Office Premise"}</td>
        </tr>
      </table>
    </div>
    ${
      isEarly
        ? `<div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;border-radius:6px;color:#991B1B;font-size:13px;margin-bottom:16px;">
            <strong>Early Clock-Out Notice:</strong> You clocked out at ${timeFormatted}, before the end of your working day (${args.expectedOutTime}). Please coordinate with HR if this was pre-approved.
          </div>`
        : ""
    }
  `;

  const html = layout({
    title: isEarly ? "Early Clock-Out Recorded" : "Check-Out Confirmed",
    badge: isEarly ? "EARLY CLOCK-OUT" : "WORKDAY COMPLETED",
    badgeColor: isEarly ? "#EF4444" : "#6366F1",
    body,
  });

  const recipients = [args.employeeEmail, ...getHrNotifyEmails()];
  if (args.managerEmail) recipients.push(args.managerEmail);

  return sendMail({
    to: [...new Set(recipients)],
    subject: isEarly
      ? `⚠️ [Attendance Alert] Early Clock-Out — ${args.employeeName} (${timeFormatted})`
      : `[Attendance] Check-Out Recorded — ${args.employeeName} (${timeFormatted})`,
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
    <p>Hi <strong>${args.employeeName}</strong>,</p>
    <p>Your check-in at <strong>${time}</strong> was recorded <strong>outside the official office geofence</strong>.</p>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:13px;color:#991B1B;">
      <strong>Location Recorded:</strong> ${args.address || "Outside designated office boundaries"}
    </div>
    <p>Company attendance policy requires all employees to mark attendance within company premise boundaries unless assigned to off-site field duty.</p>
  `;

  const recipients = [args.employeeEmail, ...getHrNotifyEmails()];
  if (args.managerEmail) recipients.push(args.managerEmail);

  return sendMail({
    to: [...new Set(recipients)],
    subject: `⚠️ [HRMS Alert] Outside Geofence Punch — ${args.employeeName}`,
    html: layout({
      title: "Outside Geofence Punch Recorded",
      badge: "GEOFENCE VIOLATION",
      badgeColor: "#EF4444",
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
    <p>Leave request submitted by <strong>${args.employeeName}</strong>.</p>
    ${detailsTable([
      ["Leave type", args.leaveType],
      ["Dates", `${args.startDate} &rarr; ${args.endDate}`],
      ["Days", `${args.days} (Tuesday weekly off excluded)`],
      ["Status", args.status],
      ["Reason", args.reason],
    ])}
  `;

  const recipients = [args.employeeEmail, ...getHrNotifyEmails()];
  if (args.managerEmail) recipients.push(args.managerEmail);

  return sendMail({
    to: [...new Set(recipients)],
    subject: `[HRMS] Leave ${args.status.toLowerCase()} — ${args.employeeName}`,
    html: layout({
      title: "Leave Request Submitted",
      badge: args.status,
      badgeColor: "#F59E0B",
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
    <p>Hi <strong>${args.employeeName}</strong>,</p>
    <p>Your leave request has been <strong>${args.action === "APPROVED" ? "approved" : "rejected"}</strong>.</p>
    ${detailsTable([
      ["Leave type", args.leaveType],
      ["Dates", `${args.startDate} &rarr; ${args.endDate}`],
      ["Days", String(args.days)],
      ...(args.note ? ([["Note", args.note]] as [string, string][]) : []),
    ])}
  `;

  return sendMail({
    to: args.employeeEmail,
    subject: `[HRMS] Leave ${args.action} — ${args.leaveType}`,
    html: layout({
      title: `Leave Request ${args.action === "APPROVED" ? "Approved" : "Rejected"}`,
      badge: args.action,
      badgeColor: args.action === "APPROVED" ? "#10B981" : "#EF4444",
      body,
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
    subject: `[HRMS Policy Update] ${args.title}`,
    html: layout({
      title: "Company Policy Update",
      badge: "POLICY NOTICE",
      badgeColor: "#3B82F6",
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
    <p>Dear HR Operations & Management,</p>
    <p>A mandatory attendance security violation occurred on the Realty Smartz HRMS Portal:</p>

    <div style="background:#FEF2F2;border:1px solid #FECACA;border-left:4px solid #EF4444;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <h3 style="margin:0 0 12px 0;font-size:13px;color:#991B1B;text-transform:uppercase;letter-spacing:0.5px;">Location Tracking Disabled Notice</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size:13px;">
        <tr>
          <td width="35%" style="color:#7F1D1D;">Employee:</td>
          <td style="font-weight:700;color:#991B1B;">${args.employeeName} (${args.employeeCode})</td>
        </tr>
        <tr>
          <td style="color:#7F1D1D;">Official Email:</td>
          <td style="color:#1E293B;">${args.employeeEmail}</td>
        </tr>
        <tr>
          <td style="color:#7F1D1D;">Department:</td>
          <td style="color:#1E293B;">${args.departmentName || "General Operations"}</td>
        </tr>
        <tr>
          <td style="color:#7F1D1D;">Incident Timestamp:</td>
          <td style="font-weight:700;color:#111827;">${dateFormatted} at ${timeFormatted} (IST)</td>
        </tr>
        <tr>
          <td style="color:#7F1D1D;">Reason / Event:</td>
          <td style="font-weight:600;color:#B91C1C;">${args.reason || "Device GPS Location Disabled / Permission Denied"}</td>
        </tr>
        ${
          args.deviceInfo
            ? `<tr>
                <td style="color:#7F1D1D;">Device / Browser:</td>
                <td style="color:#6B7280;font-size:11px;">${args.deviceInfo}</td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <p style="font-size:13px;color:#334155;line-height:1.5;">
      Under Realty Smartz HR Attendance Policy, all employees are required to keep GPS Location Services enabled during attendance punching and duty hours for 200m geofence verification.
      The employee has been blocked from punching until GPS location is turned back on.
    </p>
  `;

  const html = layout({
    title: "Location Tracking Disabled Alert",
    badge: "GPS SERVICE DISABLED",
    badgeColor: "#EF4444",
    body,
  });

  const recipients = [...getHrNotifyEmails(), args.employeeEmail];
  if (args.managerEmail) recipients.push(args.managerEmail);

  return sendMail({
    to: [...new Set(recipients)],
    subject: `🚨 [HRMS Alert] Location Services Disabled — ${args.employeeName} (${args.employeeCode})`,
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
      subject: "✅ [Realty Smartz] Email Notification System Verified",
      html: layout({
        title: "Email System Verified",
        badge: "VERIFIED",
        badgeColor: "#10B981",
        body: `
          <p>Your outgoing email service is operational and verified.</p>
          <p>All automated emails (new employee welcome credentials, daily check-in details, and late punch alerts) are active and delivered directly to employee inboxes.</p>
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

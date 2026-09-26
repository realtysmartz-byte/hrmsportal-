import nodemailer from "nodemailer";

export interface SmtpConfig {
  host?: string | null;
  port?: number | null;
  secure?: boolean | null;
  user?: string | null;
  pass?: string | null;
  from?: string | null;
}

let runtimeSmtpConfig: SmtpConfig = {};

export interface ActiveSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function setRuntimeSmtpConfig(config: SmtpConfig) {
  runtimeSmtpConfig = { ...runtimeSmtpConfig, ...config };
}

export function getSmtpConfig(): ActiveSmtpConfig {
  const host =
    runtimeSmtpConfig.host || process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = Number(
    runtimeSmtpConfig.port || process.env.SMTP_PORT || 465
  );
  const secure =
    runtimeSmtpConfig.secure !== undefined && runtimeSmtpConfig.secure !== null
      ? Boolean(runtimeSmtpConfig.secure)
      : process.env.SMTP_SECURE === "true" || port === 465;
  const user =
    runtimeSmtpConfig.user || process.env.SMTP_USER || "info@realtysmartz.in";
  const pass = runtimeSmtpConfig.pass || process.env.SMTP_PASS || "";
  const from =
    runtimeSmtpConfig.from ||
    process.env.SMTP_FROM ||
    `Realty Smartz HRMS <${user}>`;

  return { host, port, secure, user, pass, from };
}

export function isSmtpConfigured(): boolean {
  const cfg = getSmtpConfig();
  return Boolean(cfg.host && cfg.user && cfg.pass);
}

function getTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return null;

  return nodemailer.createTransport({
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

/**
 * Anti-Spam Certified Email Layout
 * Designed specifically for high inbox placement (Gmail, Outlook, Apple Mail):
 * 1. Clean inline table structure with exact CSS
 * 2. Proper text-to-code ratio
 * 3. Authentic corporate sender footer with address and contact
 * 4. No external render-blocking fonts or spam-trigger words
 */
function layout(args: {
  title: string;
  badge?: string;
  badgeColor?: string;
  body: string;
  actionButton?: { text: string; url: string };
}) {
  const badgeHtml = args.badge
    ? `<span style="display:inline-block;padding:4px 10px;background:${
        args.badgeColor || "#0F172A"
      };color:#ffffff;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px;">${
        args.badge
      }</span>`
    : "";

  const buttonHtml = args.actionButton
    ? `<div style="margin:24px 0 12px 0;">
        <a href="${args.actionButton.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;background:#FF5A5F;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.2px;box-shadow:0 2px 4px rgba(255,90,95,0.25);">
          ${args.actionButton.text} &rarr;
        </a>
      </div>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${args.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F8FAFC;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);overflow:hidden;">
          <!-- Top Brand Header -->
          <tr>
            <td style="background-color:#0F172A;padding:24px 28px;border-bottom:3px solid #FF5A5F;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="color:#FF5A5F;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">REALTY SMARTZ</div>
                    <div style="color:#FFFFFF;font-size:18px;font-weight:700;margin-top:2px;">Human Resource Management System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding:32px 28px;">
              ${badgeHtml}
              <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:800;color:#0F172A;line-height:1.3;">
                ${args.title}
              </h1>
              <div style="font-size:14px;line-height:1.6;color:#334155;">
                ${args.body}
              </div>
              ${buttonHtml}
            </td>
          </tr>

          <!-- Essential Policies Card -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <div style="background-color:#F1F5F9;border-left:4px solid #0F172A;border-radius:8px;padding:14px 16px;font-size:12px;color:#475569;line-height:1.5;">
                <strong style="color:#0F172A;">Important HR Policy Reminder:</strong><br />
                &bull; <strong>Weekly Off:</strong> Tuesday (Mon, Wed, Thu, Fri, Sat, Sun are active working days)<br />
                &bull; <strong>Office Check-in:</strong> Before 10:00 AM (Check-in at or after 10:00 AM is logged as Late)<br />
                &bull; <strong>Premise Verification:</strong> Attendance must be punched within company office geofence
              </div>
            </td>
          </tr>

          <!-- Corporate Footer (Anti-Spam CAN-SPAM Compliant) -->
          <tr>
            <td style="background-color:#F8FAFC;padding:20px 28px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;line-height:1.5;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <strong>Realty Smartz Private Limited</strong> &bull; HR & Operations<br />
                    Official Portal: <a href="https://realtysmartz.in" style="color:#FF5A5F;text-decoration:none;">realtysmartz.in</a> &bull; Support: <a href="mailto:info@realtysmartz.in" style="color:#64748B;">info@realtysmartz.in</a><br />
                    This is an automated operational notification sent to registered employees.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
      error:
        "SMTP not configured. Please add SMTP_PASS in .env or configure in Admin Portal -> Settings.",
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
  const loginUrl =
    args.loginUrl ||
    process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/login`
      : "http://localhost:3000/login";

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
    
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <h3 style="margin:0 0 12px 0;font-size:13px;color:#0F172A;text-transform:uppercase;letter-spacing:0.5px;">Your Account Credentials</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size:13px;">
        <tr>
          <td width="35%" style="color:#64748B;">Employee Code:</td>
          <td style="font-weight:700;color:#0F172A;">${args.employeeCode}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Official Email:</td>
          <td style="font-weight:700;color:#0F172A;">${args.employeeEmail}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Temporary Password:</td>
          <td style="font-family:monospace;background:#E2E8F0;padding:2px 8px;border-radius:4px;font-weight:700;color:#0F172A;display:inline-block;">${args.rawPassword}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Role / Access:</td>
          <td style="font-weight:600;color:#0F172A;">${args.role}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Department:</td>
          <td style="color:#0F172A;">${args.departmentName || "General"}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Designation:</td>
          <td style="color:#0F172A;">${args.designationTitle || "Specialist"}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Date of Joining:</td>
          <td style="color:#0F172A;">${dojFormatted}</td>
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

  const recipients = [args.employeeEmail];
  if (process.env.HR_NOTIFY_EMAIL) recipients.push(process.env.HR_NOTIFY_EMAIL);

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
  status: "PRESENT" | "LATE";
  address?: string | null;
  withinGeofence: boolean;
  managerEmail?: string | null;
}) {
  const timeFormatted = args.checkInTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const dateFormatted = args.checkInTime.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const isLate = args.status === "LATE";
  const geoText = args.withinGeofence
    ? "Verified Inside Office Geofence"
    : "Outside Office Geofence Boundary";

  const badge = isLate ? "LATE PUNCH ALERT" : "ATTENDANCE VERIFIED";
  const badgeColor = isLate ? "#EF4444" : "#10B981";

  const body = `
    <p>Hi <strong>${args.employeeName}</strong>,</p>
    <p>Your daily check-in has been recorded in the Realty Smartz HRMS Portal:</p>

    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size:13px;">
        <tr>
          <td width="35%" style="color:#64748B;">Employee:</td>
          <td style="font-weight:700;color:#0F172A;">${args.employeeName} (${args.employeeCode})</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Date & Time:</td>
          <td style="font-weight:700;color:#0F172A;">${dateFormatted} at ${timeFormatted}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Status:</td>
          <td style="font-weight:700;color:${isLate ? "#EF4444" : "#10B981"};">${args.status}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Geofence:</td>
          <td style="font-weight:600;color:${args.withinGeofence ? "#10B981" : "#EF4444"};">${geoText}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">GPS Location:</td>
          <td style="color:#0F172A;">${args.address || "Office Premise Coordinates"}</td>
        </tr>
      </table>
    </div>

    ${
      isLate
        ? `<div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;border-radius:6px;color:#991B1B;font-size:13px;margin-bottom:16px;">
            <strong>Late Check-In Notice:</strong> Standard check-in time is before 10:00 AM. This punch has been logged as LATE in attendance audit logs. Please coordinate with HR if this was pre-approved.
          </div>`
        : `<p style="color:#10B981;font-weight:600;font-size:13px;">Have a productive workday at Realty Smartz!</p>`
    }
  `;

  const html = layout({
    title: isLate ? "Late Punch Recorded" : "Check-In Confirmed",
    badge,
    badgeColor,
    body,
  });

  const recipients = [args.employeeEmail];
  if (args.managerEmail) recipients.push(args.managerEmail);
  if (process.env.HR_NOTIFY_EMAIL) recipients.push(process.env.HR_NOTIFY_EMAIL);

  const subject = isLate
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
}) {
  const timeFormatted = args.checkOutTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const body = `
    <p>Hi <strong>${args.employeeName}</strong>,</p>
    <p>Your check-out has been recorded successfully:</p>

    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px 20px;margin:20px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size:13px;">
        <tr>
          <td width="35%" style="color:#64748B;">Check-Out Time:</td>
          <td style="font-weight:700;color:#0F172A;">${timeFormatted}</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Total Hours:</td>
          <td style="font-weight:700;color:#10B981;">${args.totalHours ?? "—"} hrs</td>
        </tr>
        <tr>
          <td style="color:#64748B;">Check-Out Location:</td>
          <td style="color:#0F172A;">${args.address || "Office Premise"}</td>
        </tr>
      </table>
    </div>
  `;

  const html = layout({
    title: "Check-Out Confirmed",
    badge: "WORKDAY COMPLETED",
    badgeColor: "#6366F1",
    body,
  });

  return sendMail({
    to: args.employeeEmail,
    subject: `[Attendance] Check-Out Recorded — ${args.employeeName} (${timeFormatted})`,
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

  const recipients = [args.employeeEmail];
  if (args.managerEmail) recipients.push(args.managerEmail);
  if (process.env.HR_NOTIFY_EMAIL) recipients.push(process.env.HR_NOTIFY_EMAIL);

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
    <ul>
      <li>Type: <strong>${args.leaveType}</strong></li>
      <li>Dates: ${args.startDate} &rarr; ${args.endDate}</li>
      <li>Days: <strong>${args.days}</strong> (working days; Tuesday weekly off excluded)</li>
      <li>Status: <strong>${args.status}</strong></li>
      <li>Reason: ${args.reason}</li>
    </ul>
  `;

  const recipients = [args.employeeEmail];
  if (args.managerEmail) recipients.push(args.managerEmail);
  if (process.env.HR_NOTIFY_EMAIL) recipients.push(process.env.HR_NOTIFY_EMAIL);

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
    <p>Your leave request has been <strong>${args.action}</strong>.</p>
    <ul>
      <li>Type: <strong>${args.leaveType}</strong></li>
      <li>Dates: ${args.startDate} &rarr; ${args.endDate}</li>
      <li>Days: <strong>${args.days}</strong></li>
      ${args.note ? `<li>HR / Manager Note: <em>${args.note}</em></li>` : ""}
    </ul>
  `;

  return sendMail({
    to: args.employeeEmail,
    subject: `[HRMS] Leave ${args.action} — ${args.leaveType}`,
    html: layout({
      title: `Leave Request ${args.action}`,
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
    <p style="font-size:16px;font-weight:700;color:#0F172A;">${args.title}</p>
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
 * 6. Test SMTP connection & send test email
 */
export async function testSmtpConnection(
  targetEmail: string
): Promise<{ success: boolean; message: string }> {
  const cfg = getSmtpConfig();
  if (!cfg.pass) {
    return {
      success: false,
      message:
        "SMTP Password is missing. Please provide SMTP_PASS for info@realtysmartz.in",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      message: "Could not initialize SMTP transport with current settings.",
    };
  }

  try {
    await transporter.verify();
    const result = await sendMail({
      to: targetEmail,
      subject: "✅ [Realty Smartz] SMTP Connection Test Successful",
      html: layout({
        title: "SMTP Connection Verified!",
        badge: "TEST PASSED",
        badgeColor: "#10B981",
        body: `
          <p>Congratulations! Your outgoing email service for <strong>${cfg.user}</strong> via <strong>${cfg.host}:${cfg.port}</strong> is working properly.</p>
          <p>All system emails (new employee welcome credentials, daily check-in details, and late punch alerts) will now be sent automatically to staff and HR.</p>
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
    return {
      success: false,
      message: err?.message || String(err),
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

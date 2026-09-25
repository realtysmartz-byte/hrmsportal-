import nodemailer from "nodemailer";

type MailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendMail(payload: MailPayload): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.info(
      "[email] SMTP not configured — skipped:",
      payload.subject,
      "→",
      payload.to
    );
    return false;
  }

  const from =
    process.env.SMTP_FROM ||
    `Realty Smartz Private Limited HRMS <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({
      from,
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#f7f8fa;padding:24px;color:#1a1d23">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e4e7ec;overflow:hidden">
    <div style="background:#2b3a67;color:#fff;padding:16px 20px;font-weight:700">${title}</div>
    <div style="padding:20px;line-height:1.5;font-size:14px">${body}</div>
    <div style="padding:12px 20px;font-size:11px;color:#667085;border-top:1px solid #f0f2f5">
      Realty Smartz Private Limited · HRMS Portal · Weekly off: Tuesday · Sat/Sun are working days
    </div>
  </div>
</body></html>`;
}

export async function notifyLatePunch(args: {
  employeeName: string;
  employeeEmail: string;
  employeeCode: string;
  checkInTime: Date;
  address?: string | null;
  withinGeofence: boolean;
  managerEmail?: string | null;
}) {
  const time = args.checkInTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const geo = args.withinGeofence
    ? "Inside office geofence"
    : "Outside office geofence";
  const body = `
    <p>Hi ${args.employeeName},</p>
    <p>Your check-in today was marked <strong>LATE</strong> at <strong>${time}</strong>.</p>
    <ul>
      <li>Employee code: ${args.employeeCode}</li>
      <li>Location: ${args.address || "—"}</li>
      <li>Geofence: ${geo}</li>
    </ul>
    <p><strong>Policy reminder:</strong> Regular check-in is before 10:00 AM. Late punches are recorded for attendance compliance.</p>
  `;
  const html = layout("Late punch alert", body);
  const recipients = [args.employeeEmail];
  if (args.managerEmail) recipients.push(args.managerEmail);
  if (process.env.HR_NOTIFY_EMAIL) recipients.push(process.env.HR_NOTIFY_EMAIL);

  await sendMail({
    to: [...new Set(recipients)],
    subject: `[HRMS] Late punch — ${args.employeeName}`,
    html,
    text: `Late punch for ${args.employeeName} at ${time}. ${geo}`,
  });
}

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
  });
  const body = `
    <p>Hi ${args.employeeName},</p>
    <p>Your check-in at <strong>${time}</strong> was recorded <strong>outside the office geofence</strong>.</p>
    <ul>
      <li>Employee code: ${args.employeeCode}</li>
      <li>Location: ${args.address || "—"}</li>
    </ul>
    <p><strong>Policy:</strong> Attendance should be punched from the company office location unless approved for remote/field work.</p>
  `;
  const recipients = [args.employeeEmail];
  if (args.managerEmail) recipients.push(args.managerEmail);
  if (process.env.HR_NOTIFY_EMAIL) recipients.push(process.env.HR_NOTIFY_EMAIL);

  await sendMail({
    to: [...new Set(recipients)],
    subject: `[HRMS] Outside geofence punch — ${args.employeeName}`,
    html: layout("Outside geofence", body),
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
      <li>Type: ${args.leaveType}</li>
      <li>Dates: ${args.startDate} → ${args.endDate}</li>
      <li>Days: ${args.days} (working days; Tuesday weekly off excluded)</li>
      <li>Status: ${args.status}</li>
      <li>Reason: ${args.reason}</li>
    </ul>
  `;
  const recipients = [args.employeeEmail];
  if (args.managerEmail) recipients.push(args.managerEmail);
  if (process.env.HR_NOTIFY_EMAIL) recipients.push(process.env.HR_NOTIFY_EMAIL);

  await sendMail({
    to: [...new Set(recipients)],
    subject: `[HRMS] Leave ${args.status.toLowerCase()} — ${args.employeeName}`,
    html: layout("Leave request", body),
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
    <p>Hi ${args.employeeName},</p>
    <p>Your leave request has been <strong>${args.action}</strong>.</p>
    <ul>
      <li>Type: ${args.leaveType}</li>
      <li>Dates: ${args.startDate} → ${args.endDate}</li>
      <li>Days: ${args.days}</li>
      ${args.note ? `<li>Note: ${args.note}</li>` : ""}
    </ul>
    <p><strong>Policy:</strong> Approved leave auto-marks attendance as ON_LEAVE for working days in the range.</p>
  `;
  await sendMail({
    to: args.employeeEmail,
    subject: `[HRMS] Leave ${args.action.toLowerCase()} — ${args.leaveType}`,
    html: layout(`Leave ${args.action.toLowerCase()}`, body),
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
    <p><strong>${args.title}</strong></p>
    <p>${args.summary}</p>
    <p>Current attendance policies:</p>
    <ul>
      <li>Weekly off: <strong>Tuesday</strong> (Sat/Sun are working days)</li>
      <li>Late punch: check-in at or after 10:00 AM</li>
      <li>Location: tracked every 30 minutes while signed into Employee Portal</li>
    </ul>
  `;
  await sendMail({
    to: args.recipientEmails,
    subject: `[HRMS] Policy update — ${args.title}`,
    html: layout("Policy update", body),
  });
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

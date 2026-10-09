import crypto from "crypto";
import type { PrismaClient } from "@realty-smartz/db";
import {
  startOfDayUTC,
  getISTDateParts,
  TIMEZONE_IST,
} from "@realty-smartz/shared";
import { ensureAutoPunchOut } from "./attendance-auto";

export interface GoogleSheetConfig {
  spreadsheetId?: string | null;
  serviceAccountEmail?: string | null;
  privateKey?: string | null;
  webhookUrl?: string | null;
}

export interface DailyReportRow {
  srNo: number;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  date: string;
  status: string;
  checkInTime: string;
  checkInLocation: string;
  geofenceStatus: string;
  checkOutTime: string;
  checkOutLocation: string;
  totalHours: string;
  notes: string;
}

/**
 * Format time in 12-hour IST format (e.g. "09:30 AM")
 */
function formatTime12(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    timeZone: TIMEZONE_IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Gather daily attendance report rows for all active/on-leave employees for a target date
 */
export async function generateDailyAttendanceData(
  prisma: PrismaClient,
  targetDate: Date
): Promise<{ dateStr: string; formattedDate: string; rows: DailyReportRow[]; rawValues: (string | number)[][] }> {
  // First ensure any pending unclosed logs are auto-punched out to 7:00 PM IST
  await ensureAutoPunchOut(prisma);

  const ist = getISTDateParts(targetDate);
  const dateStr = `${ist.year}-${String(ist.month).padStart(2, "0")}-${String(ist.day).padStart(2, "0")}`;
  const formattedDate = targetDate.toLocaleDateString("en-IN", {
    timeZone: TIMEZONE_IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const dayStart = startOfDayUTC(targetDate);


  // 1. Fetch all active or on-leave employees
  const employees = await prisma.employee.findMany({
    where: {
      status: { in: ["ACTIVE", "ON_LEAVE"] },
    },
    include: {
      department: { select: { name: true } },
      designation: { select: { title: true } },
    },
    orderBy: { employeeCode: "asc" },
  });

  // 2. Fetch attendance logs for targetDate
  const logs = await prisma.attendanceLog.findMany({
    where: {
      date: dayStart,
      employeeId: { in: employees.map((e) => e.id) },
    },
  });

  const logMap = new Map(logs.map((l) => [l.employeeId, l]));

  const headers = [
    "Sr No",
    "Employee Code",
    "Employee Name",
    "Department",
    "Designation",
    "Date",
    "Status",
    "Punch-In Time",
    "Punch-In Location",
    "Geofence Status",
    "Punch-Out Time",
    "Punch-Out Location",
    "Total Hours",
    "Notes",
  ];

  const rows: DailyReportRow[] = employees.map((emp, index) => {
    const log = logMap.get(emp.id);

    let status = log?.status ?? "ABSENT";
    if (emp.status === "ON_LEAVE" && !log) {
      status = "ON_LEAVE";
    }

    const checkInTime = formatTime12(log?.checkInTime);
    const checkOutTime = formatTime12(log?.checkOutTime);

    let checkInLoc = "—";
    if (log?.checkInAddress) {
      checkInLoc = log.checkInAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited");
    } else if (log?.checkInLat && log?.checkInLng) {
      checkInLoc = `${log.checkInLat.toFixed(5)}, ${log.checkInLng.toFixed(5)}`;
    }

    let checkOutLoc = "—";
    if (log?.checkOutAddress) {
      checkOutLoc = log.checkOutAddress.replace(/sunbreeze/gi, "REALTY SMARTZ PVT LTD");
    } else if (log?.checkOutLat && log?.checkOutLng) {
      checkOutLoc = `${log.checkOutLat.toFixed(5)}, ${log.checkOutLng.toFixed(5)}`;
    } else if (log?.checkOutTime && checkInLoc !== "—") {
      checkOutLoc = checkInLoc;
    }

    // Clean up any legacy auto text so "auto fetch" or "Auto checkout" never appears in Google Sheet
    if (
      checkOutLoc.toLowerCase().includes("auto checkout") ||
      checkOutLoc.toLowerCase().includes("auto fetch")
    ) {
      checkOutLoc = checkInLoc !== "—" ? checkInLoc : "REALTY SMARTZ PVT LTD";
    }

    const geofenceStatus = log?.checkInTime
      ? log.withinGeofence
        ? "Inside Office"
        : "Outside Geofence"
      : "—";

    const totalHours = log?.totalHours ? `${log.totalHours} hrs` : "—";
    let notes = log?.notes || "";
    notes = notes
      .replace(/Auto checked out at 07:00 PM IST \(Shift End\)/gi, "")
      .replace(/Auto checkout[^\s·]*/gi, "")
      .replace(/Auto fetch[^\s·]*/gi, "")
      .replace(/·\s*·/g, "·")
      .trim();
    if (notes.startsWith("·")) notes = notes.replace(/^·\s*/, "");
    if (notes.endsWith("·")) notes = notes.replace(/\s*·$/, "");

    return {
      srNo: index + 1,
      employeeCode: emp.employeeCode,
      name: [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Employee",
      department: emp.department?.name ?? "General",
      designation: emp.designation?.title ?? "Specialist",
      date: dateStr,
      status,
      checkInTime,
      checkInLocation: checkInLoc,
      geofenceStatus,
      checkOutTime,
      checkOutLocation: checkOutLoc,
      totalHours,
      notes,
    };
  });

  const rawValues = [
    headers,
    ...rows.map((r) => [
      r.srNo,
      r.employeeCode,
      r.name,
      r.department,
      r.designation,
      r.date,
      r.status,
      r.checkInTime,
      r.checkInLocation,
      r.geofenceStatus,
      r.checkOutTime,
      r.checkOutLocation,
      r.totalHours,
      r.notes,
    ]),
  ];

  return { dateStr, formattedDate, rows, rawValues };
}

/**
 * Exchange Google Service Account credentials for an OAuth2 Access Token
 */
export async function getGoogleServiceAccountAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat,
  };

  const base64UrlEncode = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(claimSet)}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsignedToken);
  const formattedKey = privateKey.replace(/\\n/g, "\n");
  const signature = sign
    .sign(formattedKey, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Google Auth failed (${res.status}): Make sure your Service Account Email and Private Key are correct. Details: ${errText}`
    );
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Sync daily attendance report to Google Sheet
 * Handles:
 * 1. Checking if sheet tab for dateStr exists
 * 2. Creating new tab with dateStr if missing
 * 3. Writing headers and formatted rows
 */
export async function syncReportToGoogleSheet(
  config: GoogleSheetConfig,
  reportData: {
    dateStr: string;
    formattedDate: string;
    rows: DailyReportRow[];
    rawValues: (string | number)[][];
  }
): Promise<{ success: boolean; sheetTitle: string; rowCount: number }> {
  const { dateStr, rawValues, rows } = reportData;

  // Option A: Google Apps Script Webhook (if provided and preferred)
  if (config.webhookUrl) {
    const webhookRes = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateStr,
        sheetTitle: dateStr,
        rawValues,
        rowCount: rows.length,
      }),
    });

    const responseText = await webhookRes.text();
    if (
      !webhookRes.ok ||
      responseText.includes("Script function not found") ||
      responseText.includes("<!DOCTYPE html>")
    ) {
      console.error(
        "[google-sheets] Webhook sync failed:",
        webhookRes.status,
        responseText.slice(0, 300)
      );
      if (responseText.includes("Script function not found")) {
        throw new Error(
          "Google Apps Script is missing the 'doPost' function. Please update your script in Extensions > Apps Script with the provided code and deploy as a Web App."
        );
      }
      throw new Error(
        `Google Sheets Webhook responded with error status ${webhookRes.status}.`
      );
    }

    return {
      success: true,
      sheetTitle: dateStr,
      rowCount: rows.length,
    };
  }

  // Option B: Official Google Sheets API v4 with Service Account
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!spreadsheetId) {
    throw new Error(
      "Google Spreadsheet is not configured in backend environment."
    );
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google Service Account credentials are not configured in backend environment."
    );
  }

  // 1. Get Access Token
  const accessToken = await getGoogleServiceAccountAccessToken(
    clientEmail,
    privateKey
  );

  // 2. Fetch Spreadsheet Metadata to check if tab already exists
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    console.error("[google-sheets] Access failed:", metaRes.status, await metaRes.text());
    throw new Error(
      `Cannot access Google Spreadsheet (${metaRes.status}). Please check backend configuration.`
    );
  }

  const meta = (await metaRes.json()) as {
    sheets: { properties: { sheetId: number; title: string } }[];
  };

  const existingSheet = meta.sheets?.find(
    (s) => s.properties.title === dateStr
  );

  let sheetId = existingSheet?.properties.sheetId;

  // 3. If tab does not exist, create a new tab for this date
  if (!existingSheet) {
    const addSheetRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: dateStr,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        }),
      }
    );

    if (!addSheetRes.ok) {
      console.error("[google-sheets] Failed to create new tab:", addSheetRes.status, await addSheetRes.text());
      throw new Error(`Failed to create new date tab for ${dateStr}. Please check Google Sheets permissions.`);
    }

    const addSheetData = (await addSheetRes.json()) as {
      replies?: { addSheet?: { properties?: { sheetId?: number } } }[];
    };
    sheetId = addSheetData.replies?.[0]?.addSheet?.properties?.sheetId;
  }

  // 4. Overwrite/Write data to the date tab
  const range = `'${dateStr}'!A1:N${rawValues.length}`;
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values: rawValues,
      }),
    }
  );

  if (!writeRes.ok) {
    console.error("[google-sheets] Failed to write values:", writeRes.status, await writeRes.text());
    throw new Error(`Failed to write attendance records into tab ${dateStr}.`);
  }

  // 5. Apply header styling & auto-fit columns if sheetId is known
  if (typeof sheetId === "number") {
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              // Style Header Row (Coral background, white bold text)
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 14,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.1, green: 0.11, blue: 0.15 }, // Dark obsidian #181C26
                      textFormat: {
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                        bold: true,
                        fontSize: 10,
                      },
                      horizontalAlignment: "CENTER",
                    },
                  },
                  fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                },
              },
              // Auto-resize dimensions
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId,
                    dimension: "COLUMNS",
                    startIndex: 0,
                    endIndex: 14,
                  },
                },
              },
            ],
          }),
        }
      );
    } catch (e) {
      // Non-critical styling failure, values are already saved
      console.warn("[google-sheets] formatting warning:", e);
    }
  }

  return {
    success: true,
    sheetTitle: dateStr,
    rowCount: rows.length,
  };
}

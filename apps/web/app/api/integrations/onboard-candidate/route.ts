import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const HRMS_SECRET_KEY = process.env.HRMS_SECRET_KEY || "rs_onboarding_secret_2026";
const DEFAULT_EMPLOYEE_PASSWORD = "Realty@123";
const EMPLOYEE_CODE_PREFIX = "RS-";

// Strict email regex matching RFC-5322 subset without pathological backtracking
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-hrms-api-key, Authorization",
};

/**
 * Timing-safe string comparison to protect against side-channel timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Strips dangerous injection characters, control chars, and caps max length
 */
function sanitizeString(val: unknown, maxLen = 255): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/[<>'"&]/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim()
    .slice(0, maxLen);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

async function getNextEmployeeCode(): Promise<string> {
  const rows = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: EMPLOYEE_CODE_PREFIX } },
    select: { employeeCode: true },
  });

  let max = 0;
  const re = new RegExp(`^${EMPLOYEE_CODE_PREFIX}(\\d+)$`, "i");
  for (const row of rows) {
    const match = re.exec(row.employeeCode);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }

  const nextNum = max + 1;
  const width = Math.max(4, String(nextNum).length);
  return `${EMPLOYEE_CODE_PREFIX}${String(nextNum).padStart(width, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Secret Key Header with Timing-Safe comparison
    const apiKey = req.headers.get("x-hrms-api-key") || "";
    if (!safeCompare(apiKey, HRMS_SECRET_KEY)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid HRMS API key" },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Parse and Validate Incoming Candidate Data
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      department = "Sales",
      designation = "Sales Executive",
      dateOfJoining,
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      emergencyContactName,
      emergencyContactPhone,
      password: providedPassword,
      profilePhotoUrl,
      organizationId,
    } = body;

    if (!email || !firstName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: firstName and email are required." },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase().slice(0, 255);
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format provided." },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanFirstName = sanitizeString(firstName, 100);
    const cleanLastName = sanitizeString(lastName, 100);
    const cleanPhone = sanitizeString(phone, 20);

    if (!cleanFirstName) {
      return NextResponse.json(
        { success: false, error: "First name cannot be empty or contain only invalid characters." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Resolve Organization
    const targetOrgId = organizationId || "org_default_realty";
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ id: targetOrgId }, { slug: targetOrgId }, { id: "org_default_realty" }],
      },
    });
    const finalOrgId = org?.id || "org_default_realty";

    // 4. Prevent Duplicates (Check if email already exists in HRMS)
    const existing = await prisma.employee.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "An employee with this email already exists in HRMS." },
        { status: 409, headers: corsHeaders }
      );
    }

    // 5. Generate Auto-Incremental Employee Code (e.g. RS-0001, RS-0002)
    const employeeCode = await getNextEmployeeCode();

    // 6. Default Password: Realty@123
    const rawPassword = providedPassword || DEFAULT_EMPLOYEE_PASSWORD;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 7. Resolve / Upsert Department
    let departmentId: string | null = null;
    const departmentName = String(department || "Sales").trim();
    if (departmentName) {
      const existingDept = await prisma.department.findFirst({
        where: {
          organizationId: finalOrgId,
          name: { equals: departmentName, mode: "insensitive" },
        },
      });
      if (existingDept) {
        departmentId = existingDept.id;
      } else {
        const createdDept = await prisma.department.create({
          data: {
            organizationId: finalOrgId,
            name: departmentName,
          },
        });
        departmentId = createdDept.id;
      }
    }

    // 8. Resolve / Upsert Designation
    let designationId: string | null = null;
    const designationTitle = String(designation || "Sales Executive").trim();
    if (designationTitle) {
      const existingDesig = await prisma.designation.findFirst({
        where: {
          organizationId: finalOrgId,
          title: { equals: designationTitle, mode: "insensitive" },
        },
      });
      if (existingDesig) {
        designationId = existingDesig.id;
      } else {
        const createdDesig = await prisma.designation.create({
          data: {
            organizationId: finalOrgId,
            title: designationTitle,
          },
        });
        designationId = createdDesig.id;
      }
    }

    // 9. Create Employee Record in HRMS
    const newEmployee = await prisma.employee.create({
      data: {
        organizationId: finalOrgId,
        employeeCode,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        phone: cleanPhone || null,
        passwordHash: hashedPassword, // Hashed Realty@123
        role: "EMPLOYEE",
        status: "ACTIVE",
        departmentId,
        designationId,
        dateOfJoining: dateOfJoining && !isNaN(new Date(dateOfJoining).getTime()) ? new Date(dateOfJoining) : new Date(),
        dateOfBirth: dateOfBirth && !isNaN(new Date(dateOfBirth).getTime()) ? new Date(dateOfBirth) : null,
        gender: gender ? sanitizeString(gender, 20).toUpperCase() : null,
        bloodGroup: bloodGroup ? sanitizeString(bloodGroup, 10) : null,
        address: address ? sanitizeString(address, 500) : null,
        emergencyContactName: emergencyContactName ? sanitizeString(emergencyContactName, 100) : null,
        emergencyContactPhone: emergencyContactPhone ? sanitizeString(emergencyContactPhone, 20) : null,
        profilePhotoUrl: profilePhotoUrl && typeof profilePhotoUrl === "string" && profilePhotoUrl.startsWith("http") ? profilePhotoUrl.slice(0, 1000) : null,
      },
    });

    // 10. Automatically provision default Leave Balances
    const currentYear = new Date().getFullYear();
    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        OR: [{ organizationId: finalOrgId }, { organizationId: null }],
      },
    });
    if (leaveTypes.length > 0) {
      await prisma.leaveBalance
        .createMany({
          data: leaveTypes.map((lt) => ({
            employeeId: newEmployee.id,
            leaveTypeId: lt.id,
            year: currentYear,
            allotted: lt.annualQuota,
            used: 0,
            remaining: lt.annualQuota,
          })),
          skipDuplicates: true,
        })
        .catch((err) => {
          console.warn("[OnboardCandidate] Failed to provision default leave balances:", err);
        });
    }

    // 11. Return 200 OK Response
    return NextResponse.json(
      {
        success: true,
        message: "Candidate onboarded successfully into Realty Smartz HRMS",
        employee: {
          id: newEmployee.id,
          employeeCode: newEmployee.employeeCode,
          firstName: newEmployee.firstName,
          lastName: newEmployee.lastName,
          email: newEmployee.email,
          phone: newEmployee.phone,
          department: departmentName,
          designation: designationTitle,
          status: newEmployee.status,
          defaultPassword: rawPassword,
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: unknown) {
    console.error("HRMS Onboard API Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

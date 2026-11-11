import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Upload rate limiter: Max 30 uploads per user per 10-minute window
const userUploadCounts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate Limiting Check
    const userId = session.user.id || session.user.email || "anonymous";
    const now = Date.now();
    const userLimit = userUploadCounts.get(userId);

    if (userLimit && now < userLimit.resetAt) {
      if (userLimit.count >= 30) {
        return NextResponse.json(
          { error: "Upload rate limit exceeded. Please wait a few minutes before uploading again." },
          { status: 429 }
        );
      }
      userLimit.count += 1;
    } else {
      userUploadCounts.set(userId, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPG, PNG, WebP, SVG, or GIF image." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Clean extension
    const ext = path.extname(file.name) || (file.type === "image/png" ? ".png" : ".jpg");
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"].includes(ext.toLowerCase())
      ? ext.toLowerCase()
      : ".png";

    // Security Check: Sanitize SVG files to prevent stored Cross-Site Scripting (XSS)
    let finalBuffer = buffer;
    if (safeExt === ".svg") {
      const svgText = buffer.toString("utf-8");
      const maliciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<foreignobject\b/gi,
        /javascript\s*:/gi,
        /\bon\w+\s*=/gi, // catches onload=, onerror=, onclick=, etc.
      ];

      for (const pattern of maliciousPatterns) {
        if (pattern.test(svgText)) {
          return NextResponse.json(
            { error: "Malicious script or unsafe code detected in SVG file. Upload rejected." },
            { status: 400 }
          );
        }
      }
    }

    const orgId = session.user.organizationId || "realty";
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const filename = `${orgId}-${uniqueSuffix}${safeExt}`;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;
    return NextResponse.json({ url: publicUrl, filename });
  } catch (err: any) {
    console.error("[api/upload] Error uploading file:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload file." },
      { status: 500 }
    );
  }
}


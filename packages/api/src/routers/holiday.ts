import { TRPCError } from "@trpc/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { protectedProcedure, router } from "../trpc";
import {
  canManageHolidays,
  createHolidaySchema,
  announceHolidaysSchema,
  updateHolidaySchema,
  TIMEZONE_IST,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export interface HolidayItem {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  dayName: string;
  type: "PUBLIC" | "RESTRICTED" | "COMPANY";
  description?: string | null;
}

const DEFAULT_HOLIDAYS: HolidayItem[] = [];

function getHolidaysFilePath(): string {
  const candidates = [
    path.join(process.cwd(), "data", "holidays.json"),
    path.join(process.cwd(), "apps", "web", "data", "holidays.json"),
    path.join(process.cwd(), "..", "apps", "web", "data", "holidays.json"),
    path.join(process.cwd(), "..", "..", "apps", "web", "data", "holidays.json"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  const defaultPath = path.join(process.cwd(), "data", "holidays.json");
  const dir = path.dirname(defaultPath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }
  return defaultPath;
}

function calculateDayName(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function getTodayIST(): string {
  const d = new Date();
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE_IST });
}

function readHolidays(): HolidayItem[] {
  const filePath = getHolidaysFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => a.date.localeCompare(b.date));
      }
    }
  } catch (err) {
    console.error("Failed to read holidays from file:", err);
  }
  return DEFAULT_HOLIDAYS;
}

function writeHolidays(items: HolidayItem[]): void {
  const filePath = getHolidaysFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2), "utf-8");
}

let tableEnsured = false;
async function ensurePayrollHolidaysTable(prisma: any): Promise<void> {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS payroll_holidays (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'PUBLIC',
        description TEXT,
        organization_id TEXT NOT NULL DEFAULT 'org_default_realty',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    try {
      await prisma.$executeRawUnsafe("ALTER TABLE payroll_holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PUBLIC'");
      await prisma.$executeRawUnsafe("ALTER TABLE payroll_holidays ADD COLUMN IF NOT EXISTS description TEXT");
      await prisma.$executeRawUnsafe("ALTER TABLE payroll_holidays ADD COLUMN IF NOT EXISTS organization_id TEXT NOT NULL DEFAULT 'org_default_realty'");
    } catch { }
    tableEnsured = true;
  } catch (err) {
    console.warn("[holiday] Could not ensure payroll_holidays table:", err);
  }
}

export async function getHolidaysForOrg(prisma: any, orgId: string): Promise<HolidayItem[]> {
  await ensurePayrollHolidaysTable(prisma);
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT id, to_char(date, 'YYYY-MM-DD') as date, name, type, description FROM payroll_holidays WHERE organization_id = $1 ORDER BY date ASC",
      orgId
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r: any) => ({
        id: r.id || `hol-${r.date}`,
        name: r.name,
        date: r.date,
        dayName: calculateDayName(r.date),
        type: (r.type as any) ?? "PUBLIC",
        description: r.description ?? null,
      }));
    }
  } catch (err) {
    console.error("[holiday] Failed to read holidays for org:", orgId, err);
  }

  // Fallback to legacy file ONLY for org_default_realty if table query was empty
  if (orgId === "org_default_realty") {
    return readHolidays();
  }

  return [];
}

export const holidayRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          year: z.number().int().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const holidays = await getHolidaysForOrg(ctx.prisma, orgId);
      if (input?.year) {
        return holidays.filter((h) => h.date.startsWith(`${input.year}-`));
      }
      return holidays;
    }),

  upcoming: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(8),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 8;
      const today = getTodayIST();
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const all = await getHolidaysForOrg(ctx.prisma, orgId);

      // Only return upcoming holidays (today or future dates), sorted chronologically ascending
      const future = all
        .filter((h) => h.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));

      return future.slice(0, limit);
    }),

  create: protectedProcedure
    .input(createHolidaySchema)
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canManageHolidays(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only HR & Admins can manage company holidays.",
        });
      }

      const orgId = ctx.session.user.organizationId || "org_default_realty";
      await ensurePayrollHolidaysTable(ctx.prisma);
      const dayName = calculateDayName(input.date);
      const id = `hol-${input.date}-${Date.now().toString(36)}`;

      const newHoliday: HolidayItem = {
        id,
        name: input.name,
        date: input.date,
        dayName,
        type: input.type,
        description: input.description ?? null,
      };

      if (orgId === "org_default_realty") {
        const all = readHolidays();
        all.push(newHoliday);
        writeHolidays(all);
      }

      try {
        await ctx.prisma.$executeRawUnsafe(
          `INSERT INTO payroll_holidays (id, date, name, type, description, organization_id) 
           VALUES ($1, $2::date, $3, $4, $5, $6) 
           ON CONFLICT (date, organization_id) DO UPDATE SET 
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             description = EXCLUDED.description`,
          newHoliday.id,
          newHoliday.date,
          newHoliday.name,
          newHoliday.type,
          newHoliday.description,
          orgId
        );
      } catch (err) {
        console.warn("[holiday] DB sync error on create:", err);
      }

      return newHoliday;
    }),

  announceMany: protectedProcedure
    .input(announceHolidaysSchema)
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canManageHolidays(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only HR & Admins can manage company holidays.",
        });
      }

      const orgId = ctx.session.user.organizationId || "org_default_realty";
      await ensurePayrollHolidaysTable(ctx.prisma);
      const createdItems: HolidayItem[] = [];

      for (const dateStr of input.dates) {
        const dayName = calculateDayName(dateStr);
        const item: HolidayItem = {
          id: `hol-${dateStr}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          name: input.name,
          date: dateStr,
          dayName,
          type: input.type,
          description: input.description ?? null,
        };
        createdItems.push(item);
      }

      if (orgId === "org_default_realty") {
        const all = readHolidays();
        all.push(...createdItems);
        writeHolidays(all);
      }

      try {
        for (const item of createdItems) {
          await ctx.prisma.$executeRawUnsafe(
            `INSERT INTO payroll_holidays (id, date, name, type, description, organization_id) 
             VALUES ($1, $2::date, $3, $4, $5, $6) 
             ON CONFLICT (date, organization_id) DO UPDATE SET 
               name = EXCLUDED.name, 
               type = EXCLUDED.type, 
               description = EXCLUDED.description`,
            item.id,
            item.date,
            item.name,
            item.type,
            item.description,
            orgId
          );
        }
      } catch (err) {
        console.warn("[holiday] DB sync error on announceMany:", err);
      }

      return createdItems;
    }),

  update: protectedProcedure
    .input(updateHolidaySchema)
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canManageHolidays(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only HR & Admins can manage company holidays.",
        });
      }

      const orgId = ctx.session.user.organizationId || "org_default_realty";
      await ensurePayrollHolidaysTable(ctx.prisma);

      const currentRows = (await ctx.prisma.$queryRawUnsafe(
        "SELECT id, to_char(date, 'YYYY-MM-DD') as date, name, type, description FROM payroll_holidays WHERE id = $1 AND organization_id = $2",
        input.id,
        orgId
      )) as any[];

      if (!currentRows || currentRows.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Holiday not found.",
        });
      }

      const existing = currentRows[0];
      const newDate = input.date ?? existing.date;
      const dayName = input.date ? calculateDayName(newDate) : calculateDayName(existing.date);

      const updated: HolidayItem = {
        id: existing.id,
        name: input.name ?? existing.name,
        date: newDate,
        dayName,
        type: input.type ?? existing.type ?? "PUBLIC",
        description: input.description !== undefined ? input.description : existing.description,
      };

      try {
        await ctx.prisma.$executeRawUnsafe(
          `UPDATE payroll_holidays 
           SET name = $1, date = $2::date, type = $3, description = $4 
           WHERE id = $5 AND organization_id = $6`,
          updated.name,
          updated.date,
          updated.type,
          updated.description,
          updated.id,
          orgId
        );
      } catch (err) {
        console.warn("[holiday] DB sync error on update:", err);
      }

      if (orgId === "org_default_realty") {
        const all = readHolidays();
        const idx = all.findIndex((h) => h.id === input.id);
        if (idx >= 0) {
          all[idx] = updated;
          writeHolidays(all);
        }
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canManageHolidays(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only HR & Admins can manage company holidays.",
        });
      }

      const orgId = ctx.session.user.organizationId || "org_default_realty";
      await ensurePayrollHolidaysTable(ctx.prisma);
      const dateMatch = input.id.match(/(\d{4}-\d{2}-\d{2})/);
      const targetDate = dateMatch ? dateMatch[1] : null;

      // 1. Delete from PostgreSQL database scoped to organization_id
      try {
        if (targetDate) {
          await ctx.prisma.$executeRawUnsafe(
            "DELETE FROM payroll_holidays WHERE (id = $1 OR date::date = $2::date) AND organization_id = $3",
            input.id,
            targetDate,
            orgId
          );
        } else {
          await ctx.prisma.$executeRawUnsafe(
            "DELETE FROM payroll_holidays WHERE id = $1 AND organization_id = $2",
            input.id,
            orgId
          );
        }
      } catch (err) {
        console.warn("[holiday] DB sync error on delete:", err);
      }

      // 2. Remove from JSON file cache ONLY for org_default_realty
      if (orgId === "org_default_realty") {
        const all = readHolidays();
        const filtered = all.filter(
          (h) => h.id !== input.id && (!targetDate || h.date !== targetDate)
        );
        writeHolidays(filtered);
      }

      return { success: true, id: input.id };
    }),
});

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

  // Fallback to preferred path
  const defaultPath = path.join(process.cwd(), "data", "holidays.json");
  const dir = path.dirname(defaultPath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore directory creation failure
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

  // Save empty defaults if file not present
  writeHolidays(DEFAULT_HOLIDAYS);
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

async function syncAndReadHolidays(prisma: any): Promise<HolidayItem[]> {
  const fromFile = readHolidays();
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT id, to_char(date, 'YYYY-MM-DD') as date, name FROM payroll_holidays ORDER BY date ASC"
    );
      if (Array.isArray(rows)) {
        // Build unified list where PostgreSQL is the primary store
        const items: HolidayItem[] = rows.map((r: any) => {
          const matchingFile = fromFile.find((f) => f.id === r.id || f.date === r.date);
          return {
            id: r.id || `hol-${r.date}`,
            name: r.name,
            date: r.date,
            dayName: calculateDayName(r.date),
            type: matchingFile?.type ?? "PUBLIC",
            description: matchingFile?.description ?? null,
          };
        });

        const sorted = items.sort((a, b) => a.date.localeCompare(b.date));
        writeHolidays(sorted);
        return sorted;
      }
    } catch (err) {
      // If payroll_holidays table query fails, fallback to file
    }
    return fromFile.sort((a, b) => a.date.localeCompare(b.date));
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
        const holidays = await syncAndReadHolidays(ctx.prisma);
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
        const all = await syncAndReadHolidays(ctx.prisma);

        // 1. Future & today's holidays (ascending chronologically)
        const future = all
          .filter((h) => h.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date));

        // 2. Recent holidays within the last 35 days (e.g. this month, newest first)
        const pastThreshold = new Date();
        pastThreshold.setDate(pastThreshold.getDate() - 35);
        const pastThresholdStr = pastThreshold.toLocaleDateString("en-CA", {
          timeZone: TIMEZONE_IST,
        });

        const recentPast = all
          .filter((h) => h.date < today && h.date >= pastThresholdStr)
          .sort((a, b) => b.date.localeCompare(a.date));

        // Prefer future holidays first; if future count < limit, backfill with recent
        const combined = [...future];
        for (const r of recentPast) {
          if (combined.length >= limit) break;
          combined.push(r);
        }

        // If still empty and there are any holidays at all, show latest ones
        if (combined.length === 0 && all.length > 0) {
          return all.slice(0, limit);
        }

        return combined.slice(0, limit);
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

        const all = readHolidays();
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

        all.push(newHoliday);
        writeHolidays(all);

        try {
          await ctx.prisma.$executeRawUnsafe(
            "INSERT INTO payroll_holidays (id, date, name) VALUES ($1, $2::date, $3) ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name",
            newHoliday.id,
            newHoliday.date,
            newHoliday.name
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

        const all = readHolidays();
        const createdItems: HolidayItem[] = [];

        for (const dateStr of input.dates) {
          const dayName = calculateDayName(dateStr);
          const existingIdx = all.findIndex((h) => h.date === dateStr && h.name.toLowerCase() === input.name.toLowerCase());
          if (existingIdx >= 0) {
            all[existingIdx] = {
              ...all[existingIdx],
              name: input.name,
              type: input.type,
              description: input.description ?? all[existingIdx].description,
            };
            createdItems.push(all[existingIdx]);
          } else {
            const item: HolidayItem = {
              id: `hol-${dateStr}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
              name: input.name,
              date: dateStr,
              dayName,
              type: input.type,
              description: input.description ?? null,
            };
            all.push(item);
            createdItems.push(item);
          }
        }

        writeHolidays(all);

        try {
          for (const item of createdItems) {
            await ctx.prisma.$executeRawUnsafe(
              "INSERT INTO payroll_holidays (id, date, name) VALUES ($1, $2::date, $3) ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name",
              item.id,
              item.date,
              item.name
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

        const all = readHolidays();
        const idx = all.findIndex((h) => h.id === input.id);
        if (idx === -1) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Holiday not found.",
          });
        }

        const existing = all[idx];
        const newDate = input.date ?? existing.date;
        const dayName = input.date ? calculateDayName(newDate) : existing.dayName;

        const updated: HolidayItem = {
          ...existing,
          name: input.name ?? existing.name,
          date: newDate,
          dayName,
          type: input.type ?? existing.type,
          description: input.description !== undefined ? input.description : existing.description,
        };

        all[idx] = updated;
        writeHolidays(all);

        try {
          await ctx.prisma.$executeRawUnsafe(
            "UPDATE payroll_holidays SET name = $1, date = $2::date WHERE id = $3",
            updated.name,
            updated.date,
            updated.id
          );
        } catch (err) {
          console.warn("[holiday] DB sync error on update:", err);
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

        // 1. Delete from PostgreSQL database (by ID, or date contained in ID)
        try {
          await ctx.prisma.$executeRawUnsafe(
            "DELETE FROM payroll_holidays WHERE id = $1",
            input.id
          );

              const dateMatch = input.id.match(/(\d{4}-\d{2}-\d{2})/);
              if (dateMatch) {
                await ctx.prisma.$executeRawUnsafe(
            "DELETE FROM payroll_holidays WHERE date = $1::date",
                  dateMatch[1]
                );
              }
            } catch (err) {
              console.warn("[holiday] DB sync error on delete:", err);
            }

            // 2. Remove from JSON file cache
            const all = readHolidays();
            const dateMatch = input.id.match(/(\d{4}-\d{2}-\d{2})/);
            const filtered = all.filter(
              (h) => h.id !== input.id && (!dateMatch || h.date !== dateMatch[1])
            );
            writeHolidays(filtered);

            return { success: true, id: input.id };
          }),
  });

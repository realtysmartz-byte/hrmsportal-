import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { protectedProcedure, hrAdminProcedure, router } from "../trpc";
import type { Role } from "@realty-smartz/shared";

export const organizationRouter = router({
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const org = await ctx.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            employees: true,
            departments: true,
            designations: true,
          },
        },
      },
    });

    if (!org) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
    }

    return org;
  }),

  updateCurrent: hrAdminProcedure
    .input(
      z.object({
        name: z.string().min(2, "Company name must be at least 2 characters"),
        customDomain: z.string().trim().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #7c3aed)").optional(),
        supportEmail: z.string().email().nullable().optional(),
        loginHeading: z.string().nullable().optional(),
        loginSubheading: z.string().nullable().optional(),
        loginBannerUrl: z.string().nullable().optional(),
        tagline: z.string().nullable().optional(),
        testimonialQuote: z.string().nullable().optional(),
        testimonialAuthor: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";

      const updated = await ctx.prisma.organization.update({
        where: { id: orgId },
        data: {
          name: input.name,
          customDomain: input.customDomain || null,
          logoUrl: input.logoUrl || null,
          brandColor: input.brandColor || "#7c3aed",
          supportEmail: input.supportEmail || null,
          loginHeading: input.loginHeading !== undefined ? (input.loginHeading || null) : undefined,
          loginSubheading: input.loginSubheading !== undefined ? (input.loginSubheading || null) : undefined,
          loginBannerUrl: input.loginBannerUrl !== undefined ? (input.loginBannerUrl || null) : undefined,
          tagline: input.tagline !== undefined ? (input.tagline || null) : undefined,
          testimonialQuote: input.testimonialQuote !== undefined ? (input.testimonialQuote || null) : undefined,
          testimonialAuthor: input.testimonialAuthor !== undefined ? (input.testimonialAuthor || null) : undefined,
        },
      });

      return updated;
    }),

  listAll: hrAdminProcedure.query(async ({ ctx }) => {
    // Strictly ONLY Platform Super Admin (Realty Smartz master tenant) can list all tenant organizations
    const isPlatformSuperAdmin =
      ctx.session.user.role === "ADMIN" &&
      (ctx.session.user.organizationId === "org_default_realty" || !ctx.session.user.organizationId);
    if (!isPlatformSuperAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied. Only Platform Super Admin can view multi-tenant organization directory.",
      });
    }

    const orgs = await ctx.prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
        settings: {
          select: {
            officeName: true,
          },
        },
      },
    });

    return orgs;
  }),

  create: hrAdminProcedure
    .input(
      z.object({
        name: z.string().min(2, "Company name is required"),
        slug: z
          .string()
          .min(2, "Slug must be at least 2 characters")
          .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and dashes"),
        customDomain: z.string().trim().nullable().optional(),
        brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#7c3aed"),
        supportEmail: z.string().email().optional(),
        adminFirstName: z.string().min(1, "Admin first name is required"),
        adminLastName: z.string().min(1, "Admin last name is required"),
        adminEmail: z.string().email("Valid admin email is required"),
        adminPassword: z.string().min(6, "Password must be at least 6 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isPlatformSuperAdmin =
        ctx.session.user.role === "ADMIN" &&
        (ctx.session.user.organizationId === "org_default_realty" || !ctx.session.user.organizationId);
      if (!isPlatformSuperAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied. Only Platform Super Admin can create new tenant organizations.",
        });
      }

      // 1. Check if slug or domain is already taken
      const existingSlug = await ctx.prisma.organization.findUnique({
        where: { slug: input.slug },
      });
      if (existingSlug) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `The company code "${input.slug}" is already in use. Please choose another.`,
        });
      }

      if (input.customDomain) {
        const existingDomain = await ctx.prisma.organization.findUnique({
          where: { customDomain: input.customDomain.toLowerCase() },
        });
        if (existingDomain) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The custom domain "${input.customDomain}" is already in use.`,
          });
        }
      }

      const passwordHash = await bcrypt.hash(input.adminPassword, 10);

      // 2. Create organization and default admin in a single transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: input.name,
            slug: input.slug.toLowerCase(),
            customDomain: input.customDomain?.toLowerCase() || null,
            brandColor: input.brandColor,
            supportEmail: input.supportEmail || input.adminEmail,
            isActive: true,
          },
        });

        // Create default company settings for the new organization
        await tx.companySettings.create({
          data: {
            id: `cs_${org.id}`,
            organizationId: org.id,
            officeName: `${input.name} HQ`,
            officeLat: 28.40039,
            officeLng: 77.03883,
            geofenceRadiusM: 200,
            weeklyOffDay: 0, // Sunday default
          },
        });

        // Create initial Admin employee for the new organization
        const adminEmp = await tx.employee.create({
          data: {
            organizationId: org.id,
            employeeCode: `${input.slug.toUpperCase().slice(0, 3)}-0001`,
            firstName: input.adminFirstName,
            lastName: input.adminLastName,
            email: input.adminEmail.toLowerCase().trim(),
            passwordHash,
            role: "ADMIN" as Role,
            status: "ACTIVE",
          },
        });

        return { org, adminEmp };
      });

      return {
        success: true,
        organization: result.org,
        adminUser: {
          id: result.adminEmp.id,
          email: result.adminEmp.email,
          employeeCode: result.adminEmp.employeeCode,
        },
      };
    }),
});


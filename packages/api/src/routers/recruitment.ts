import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createJobSchema,
  updateJobSchema,
  createCandidateSchema,
  updateCandidateStageSchema,
  addCandidateNoteSchema,
  scheduleInterviewSchema,
  interviewFeedbackSchema,
  referCandidateSchema,
  canAccessAdminPortal,
  PIPELINE_STAGES,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";

async function notifyInterviewer(email: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("[email:stub]", { to: email, subject, body });
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Realty Smartz Private Limited HRMS <noreply@realtysmartz.com>",
        to: email,
        subject,
        text: `${body}\n\nRealty Smartz Private Limited`,
      }),
    });
  } catch (err) {
    console.error("[email:failed]", err);
  }
}

function validateResumeUrl(url: string | null | undefined) {
  if (!url) return;
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid resume file format",
      });
    }
    const mime = match[1].toLowerCase();
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(mime)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only PDF, PNG, and JPG files are accepted for resumes",
      });
    }
    if (url.length > 7 * 1024 * 1024) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Resume exceeds 5MB size limit",
      });
    }
  } else if (!url.startsWith("https://")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Resume URL must be a valid HTTPS URL or data URL",
    });
  }
}

export const recruitmentRouter = router({
  jobList: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["OPEN", "ON_HOLD", "CLOSED"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.jobPosting.findMany({
        where: input?.status ? { status: input.status } : undefined,
        include: {
          department: true,
          postedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { candidates: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  jobById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      const isAdmin = canAccessAdminPortal(role);

      const job = await ctx.prisma.jobPosting.findUnique({
        where: { id: input.id },
        include: {
          department: true,
          postedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          candidates: isAdmin
            ? {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                  currentStage: true,
                  source: true,
                  appliedAt: true,
                  referredBy: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                  _count: { select: { interviews: true } },
                },
                orderBy: { appliedAt: "desc" },
              }
            : false,
        },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      type CandidateSummary = {
        id: string;
        fullName: string;
        email: string;
        phone: string;
        currentStage: string;
        source: string;
        appliedAt: Date;
        referredBy: { id: string; firstName: string; lastName: string } | null;
        _count: { interviews: number };
      };
      return {
        ...job,
        candidates: ((job as unknown as { candidates?: CandidateSummary[] }).candidates ?? []) as CandidateSummary[],
      };
    }),

  createJob: hrAdminProcedure
    .input(createJobSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.jobPosting.create({
        data: {
          title: input.title,
          departmentId: input.departmentId || null,
          description: input.description,
          requirements: input.requirements,
          location: input.location,
          employmentType: input.employmentType,
          postedById: ctx.session.user.id,
        },
      });
    }),

  updateJob: hrAdminProcedure
    .input(updateJobSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.jobPosting.update({
        where: { id },
        data: {
          ...data,
          departmentId: data.departmentId === undefined ? undefined : data.departmentId || null,
          closedAt: data.status === "CLOSED" ? new Date() : data.status === "OPEN" ? null : undefined,
        },
      });
    }),

  createCandidate: hrAdminProcedure
    .input(createCandidateSchema)
    .mutation(async ({ ctx, input }) => {
      validateResumeUrl(input.resumeUrl);
      const created = await ctx.prisma.candidate.create({
        data: {
          jobPostingId: input.jobPostingId,
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          resumeUrl: input.resumeUrl || null,
          source: input.source,
          referredById: input.referredById || null,
        },
        include: {
          jobPosting: { select: { title: true } },
          referredBy: { select: { firstName: true, lastName: true } },
        },
      });

      void (async () => {
        try {
          const { formatNewCandidateTelegramMessage, sendTelegramNotification } = await import(
            "../lib/telegram"
          );
          const msg = formatNewCandidateTelegramMessage({
            candidateName: created.fullName,
            jobTitle: created.jobPosting?.title || "Open Role",
            email: created.email,
            phone: created.phone,
            source: created.source,
            referredBy: created.referredBy
              ? `${created.referredBy.firstName} ${created.referredBy.lastName}`
              : null,
          });
          await sendTelegramNotification(
            ctx.prisma,
            "HR_LIFECYCLE",
            "notifyCandidate",
            msg
          );
        } catch (err) {
          console.error("[recruitment:candidate] telegram alert failed:", err);
        }
      })();

      return created;
    }),

  referCandidate: protectedProcedure
    .input(referCandidateSchema)
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.jobPosting.findUnique({
        where: { id: input.jobPostingId },
      });
      if (!job || job.status !== "OPEN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Job posting is not open",
        });
      }
      validateResumeUrl(input.resumeUrl);
      const created = await ctx.prisma.candidate.create({
        data: {
          jobPostingId: input.jobPostingId,
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          resumeUrl: input.resumeUrl || null,
          source: "REFERRAL",
          referredById: ctx.session.user.id,
        },
        include: {
          jobPosting: { select: { title: true } },
          referredBy: { select: { firstName: true, lastName: true } },
        },
      });

      void (async () => {
        try {
          const { formatNewCandidateTelegramMessage, sendTelegramNotification } = await import(
            "../lib/telegram"
          );
          const msg = formatNewCandidateTelegramMessage({
            candidateName: created.fullName,
            jobTitle: created.jobPosting?.title || job.title,
            email: created.email,
            phone: created.phone,
            source: "EMPLOYEE REFERRAL",
            referredBy: created.referredBy
              ? `${created.referredBy.firstName} ${created.referredBy.lastName}`
              : null,
          });
          await sendTelegramNotification(
            ctx.prisma,
            "HR_LIFECYCLE",
            "notifyCandidate",
            msg
          );
        } catch (err) {
          console.error("[recruitment:referral] telegram alert failed:", err);
        }
      })();

      return created;
    }),

  candidateById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canAccessAdminPortal(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const candidate = await ctx.prisma.candidate.findUnique({
        where: { id: input.id },
        include: {
          jobPosting: true,
          referredBy: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          },
          interviews: {
            include: {
              interviewer: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
            orderBy: { scheduledAt: "asc" },
          },
          notes: {
            include: {
              author: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!candidate) throw new TRPCError({ code: "NOT_FOUND" });
      return candidate;
    }),

  updateStage: hrAdminProcedure
    .input(updateCandidateStageSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.candidate.update({
        where: { id: input.id },
        data: { currentStage: input.currentStage },
      });
    }),

  addNote: hrAdminProcedure
    .input(addCandidateNoteSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.candidateNote.create({
        data: {
          candidateId: input.candidateId,
          authorId: ctx.session.user.id,
          content: input.content,
        },
      });
    }),

  scheduleInterview: hrAdminProcedure
    .input(scheduleInterviewSchema)
    .mutation(async ({ ctx, input }) => {
      const interviewer = await ctx.prisma.employee.findUnique({
        where: { id: input.interviewerId },
      });
      if (!interviewer) throw new TRPCError({ code: "NOT_FOUND" });

      const candidate = await ctx.prisma.candidate.findUnique({
        where: { id: input.candidateId },
      });
      if (!candidate) throw new TRPCError({ code: "NOT_FOUND" });

      const round = await ctx.prisma.interviewRound.create({
        data: {
          candidateId: input.candidateId,
          roundName: input.roundName,
          interviewerId: input.interviewerId,
          scheduledAt: input.scheduledAt,
        },
      });

      await ctx.prisma.candidate.update({
        where: { id: input.candidateId },
        data: { currentStage: "INTERVIEW" },
      });

      await notifyInterviewer(
        interviewer.email,
        `Interview scheduled: ${input.roundName}`,
        `You are scheduled to interview ${candidate.fullName} for "${input.roundName}" on ${input.scheduledAt.toLocaleString()}.\nOpen Employee Portal → dashboard for details.`
      );

      return round;
    }),

  myInterviews: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.interviewRound.findMany({
      where: { interviewerId: ctx.session.user.id },
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            jobPosting: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    });
  }),

  submitFeedback: protectedProcedure
    .input(interviewFeedbackSchema)
    .mutation(async ({ ctx, input }) => {
      const round = await ctx.prisma.interviewRound.findUnique({
        where: { id: input.id },
      });
      if (!round) throw new TRPCError({ code: "NOT_FOUND" });
      if (round.interviewerId !== ctx.session.user.id) {
        const role = ctx.session.user.role as Role;
        if (!canAccessAdminPortal(role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return ctx.prisma.interviewRound.update({
        where: { id: input.id },
        data: {
          feedback: input.feedback,
          rating: input.rating,
          status: input.status,
        },
      });
    }),

  pipelineStages: protectedProcedure.query(() => PIPELINE_STAGES),
});

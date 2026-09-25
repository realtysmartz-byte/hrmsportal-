import { z } from "zod";

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
] as const;

export const JOB_STATUSES = ["OPEN", "ON_HOLD", "CLOSED"] as const;

export const PIPELINE_STAGES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;

export const CANDIDATE_SOURCES = [
  "DIRECT",
  "REFERRAL",
  "JOB_BOARD",
  "LINKEDIN",
  "OTHER",
] as const;

export const createJobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  departmentId: z.string().max(100).optional().nullable(),
  description: z.string().trim().min(1).max(10000),
  requirements: z.string().trim().min(1).max(10000),
  location: z.string().trim().max(100).default("Gurugram"),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
});

export const updateJobSchema = createJobSchema.partial().extend({
  id: z.string().min(1).max(100),
  status: z.enum(JOB_STATUSES).optional(),
});

export const createCandidateSchema = z.object({
  jobPostingId: z.string().min(1).max(100),
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(30),
  resumeUrl: z.string().trim().max(8000000).optional().nullable().or(z.literal("")),
  source: z.enum(CANDIDATE_SOURCES).default("DIRECT"),
  referredById: z.string().max(100).optional().nullable(),
});

export const updateCandidateStageSchema = z.object({
  id: z.string().min(1).max(100),
  currentStage: z.enum(PIPELINE_STAGES),
});

export const addCandidateNoteSchema = z.object({
  candidateId: z.string().min(1).max(100),
  content: z.string().trim().min(1).max(2000),
});

export const scheduleInterviewSchema = z.object({
  candidateId: z.string().min(1).max(100),
  roundName: z.string().trim().min(1).max(100),
  interviewerId: z.string().min(1).max(100),
  scheduledAt: z.coerce.date(),
});

export const interviewFeedbackSchema = z.object({
  id: z.string().min(1).max(100),
  feedback: z.string().trim().min(1).max(5000),
  rating: z.number().int().min(1).max(5),
  status: z.enum(["COMPLETED", "NO_SHOW", "CANCELLED"]).default("COMPLETED"),
});

export const referCandidateSchema = z.object({
  jobPostingId: z.string().min(1).max(100),
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(30),
  resumeUrl: z.string().trim().max(8000000).optional().nullable().or(z.literal("")),
});

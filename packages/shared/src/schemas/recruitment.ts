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
  title: z.string().min(1).max(200),
  departmentId: z.string().optional().nullable(),
  description: z.string().min(1),
  requirements: z.string().min(1),
  location: z.string().default("Gurugram"),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
});

export const updateJobSchema = createJobSchema.partial().extend({
  id: z.string(),
  status: z.enum(JOB_STATUSES).optional(),
});

export const createCandidateSchema = z.object({
  jobPostingId: z.string(),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  resumeUrl: z.string().url().optional().nullable().or(z.literal("")),
  source: z.enum(CANDIDATE_SOURCES).default("DIRECT"),
  referredById: z.string().optional().nullable(),
});

export const updateCandidateStageSchema = z.object({
  id: z.string(),
  currentStage: z.enum(PIPELINE_STAGES),
});

export const addCandidateNoteSchema = z.object({
  candidateId: z.string(),
  content: z.string().min(1).max(2000),
});

export const scheduleInterviewSchema = z.object({
  candidateId: z.string(),
  roundName: z.string().min(1),
  interviewerId: z.string(),
  scheduledAt: z.coerce.date(),
});

export const interviewFeedbackSchema = z.object({
  id: z.string(),
  feedback: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  status: z.enum(["COMPLETED", "NO_SHOW", "CANCELLED"]).default("COMPLETED"),
});

export const referCandidateSchema = z.object({
  jobPostingId: z.string(),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  resumeUrl: z.string().url().optional().nullable().or(z.literal("")),
});

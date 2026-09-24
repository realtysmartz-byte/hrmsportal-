import { z } from "zod";
import {
  CYCLE_TYPES,
  CYCLE_STATUSES,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
  REVIEW_TYPES,
} from "../constants";

export const createPerformanceCycleSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  cycleType: z.enum(CYCLE_TYPES).default("APPRAISAL"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const updatePerformanceCycleSchema = z.object({
  id: z.string(),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const createGoalSchema = z.object({
  cycleId: z.string(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional().nullable(),
  category: z.enum(GOAL_CATEGORIES).default("INDIVIDUAL"),
  targetValue: z.string().optional().nullable(),
  keyResults: z
    .array(
      z.object({
        description: z.string().min(2, "Key result description required"),
      })
    )
    .optional(),
});

export const updateGoalSchema = z.object({
  id: z.string(),
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  category: z.enum(GOAL_CATEGORIES).optional(),
  targetValue: z.string().optional().nullable(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  status: z.enum(GOAL_STATUSES).optional(),
});

export const createKeyResultSchema = z.object({
  goalId: z.string(),
  description: z.string().min(2, "Description must be at least 2 characters"),
});

export const updateKeyResultSchema = z.object({
  id: z.string(),
  description: z.string().min(2).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  completed: z.boolean().optional(),
});

export const submitReviewSchema = z.object({
  cycleId: z.string(),
  employeeId: z.string(),
  reviewType: z.enum(REVIEW_TYPES),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  strengths: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
});

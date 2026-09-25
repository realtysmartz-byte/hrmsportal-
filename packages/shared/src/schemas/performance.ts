import { z } from "zod";
import {
  CYCLE_TYPES,
  CYCLE_STATUSES,
  GOAL_CATEGORIES,
  GOAL_STATUSES,
  REVIEW_TYPES,
} from "../constants";

export const createPerformanceCycleSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(200),
  cycleType: z.enum(CYCLE_TYPES).default("APPRAISAL"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const updatePerformanceCycleSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const createGoalSchema = z.object({
  cycleId: z.string().min(1).max(100),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(GOAL_CATEGORIES).default("INDIVIDUAL"),
  targetValue: z.string().trim().max(100).optional().nullable(),
  keyResults: z
    .array(
      z.object({
        description: z.string().trim().min(2, "Key result description required").max(500),
      })
    )
    .optional(),
});

export const updateGoalSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.enum(GOAL_CATEGORIES).optional(),
  targetValue: z.string().trim().max(100).optional().nullable(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  status: z.enum(GOAL_STATUSES).optional(),
});

export const createKeyResultSchema = z.object({
  goalId: z.string().min(1).max(100),
  description: z.string().trim().min(2, "Description must be at least 2 characters").max(500),
});

export const updateKeyResultSchema = z.object({
  id: z.string().min(1).max(100),
  description: z.string().trim().min(2).max(500).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  completed: z.boolean().optional(),
});

export const submitReviewSchema = z.object({
  cycleId: z.string().min(1).max(100),
  employeeId: z.string().min(1).max(100),
  reviewType: z.enum(REVIEW_TYPES),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  strengths: z.string().trim().max(3000).optional().nullable(),
  improvements: z.string().trim().max(3000).optional().nullable(),
  comments: z.string().trim().max(3000).optional().nullable(),
});

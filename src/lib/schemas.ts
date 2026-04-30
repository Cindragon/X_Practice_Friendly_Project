import { z } from "zod";

/**
 * Shared input validation schemas for HTTP endpoints. Keep them small and
 * close to the field semantics — pages and tests both import from here.
 */

const optionalUrl = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .max(2048)
  .or(z.literal(""))
  .nullable()
  .optional();

const optionalText = (max: number) =>
  z.string().max(max).or(z.literal("")).nullable().optional();

/** PATCH /api/users/me */
export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    bio: optionalText(160),
    avatarUrl: optionalUrl,
    bannerUrl: optionalUrl,
  })
  .strict();

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

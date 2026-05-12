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

/**
 * POST /api/posts
 *
 * A post can be one of three things:
 *   - top-level post     : content + (parentId=null, repostOfId=null)
 *   - reply              : content + parentId
 *   - repost             : repostOfId, content empty
 *
 * The route handler enforces the 280-char effective-length rule via
 * src/lib/post-text.ts — we only do shape validation here.
 */
const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid post id");

export const createPostSchema = z
  .object({
    content: z.string().max(10_000).optional().default(""),
    parentId: objectId.optional(),
    repostOfId: objectId.optional(),
  })
  .strict()
  .refine((d) => !(d.parentId && d.repostOfId), {
    message: "A post cannot be both a reply and a repost",
    path: ["repostOfId"],
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;

/** POST /api/drafts — much looser; drafts are work-in-progress. */
export const createDraftSchema = z
  .object({
    content: z.string().max(10_000).default(""),
  })
  .strict();

export type CreateDraftInput = z.infer<typeof createDraftSchema>;


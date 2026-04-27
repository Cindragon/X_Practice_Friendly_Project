/**
 * userID validation rules:
 *   - 3 to 15 characters
 *   - letters / digits / underscore only
 *   - must not start with a digit
 *
 * Used by both client and server, so it lives in a tiny standalone module.
 */

import { z } from "zod";

export const USER_ID_REGEX = /^[A-Za-z_][A-Za-z0-9_]{2,14}$/;

export const userIdSchema = z
  .string()
  .trim()
  .regex(
    USER_ID_REGEX,
    "userID must be 3–15 chars (letters, digits, underscore) and cannot start with a digit"
  );

export function isValidUserId(value: string): boolean {
  return USER_ID_REGEX.test(value);
}

import Link from "next/link";
import { clsx } from "clsx";

/**
 * Renders an @userID handle as a link to that user's profile.
 * Per spec, clicking any @handle anywhere in the app navigates to
 * /u/[userID]. Use this everywhere instead of hand-rolled <Link>s so
 * the styling and target stay consistent.
 */
export function UserHandle({
  userID,
  className,
  prefix = true,
}: {
  userID: string;
  className?: string;
  /** Show the leading "@". Default true. */
  prefix?: boolean;
}) {
  return (
    <Link
      href={`/u/${userID}`}
      className={clsx(
        "text-zinc-500 hover:text-sky-600 hover:underline",
        className
      )}
    >
      {prefix ? "@" : ""}
      {userID}
    </Link>
  );
}

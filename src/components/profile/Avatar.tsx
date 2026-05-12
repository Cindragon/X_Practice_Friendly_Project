import Image from "next/image";
import { clsx } from "clsx";

/**
 * Circular avatar with a graceful fallback (first letter of name) when
 * no image URL is available. Used on profile headers, sidebar, and
 * (later) post cards.
 */
export function Avatar({
  src,
  name,
  size = 128,
  className,
}: {
  src: string | null;
  name: string | null;
  size?: number;
  className?: string;
}) {
  const letter = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      style={{ width: size, height: size }}
      className={clsx(
        "relative overflow-hidden rounded-full border-4 border-white bg-zinc-200",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name ?? "avatar"}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-zinc-500">
          {letter}
        </div>
      )}
    </div>
  );
}

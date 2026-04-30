import { Sparkles } from "lucide-react";

/**
 * Friendly logo. We use a simple lucide icon with a tinted background so
 * the brand mark is recognizable but doesn't require shipping a custom SVG.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-full text-sky-500 transition hover:bg-zinc-100 ${className}`}
      aria-label="Friendly"
    >
      <Sparkles className="h-7 w-7" strokeWidth={2.25} />
    </div>
  );
}

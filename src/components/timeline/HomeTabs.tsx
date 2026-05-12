"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import type { FeedMode } from "@/lib/feed";

/**
 * All / Following toggle for the home timeline. The active mode is
 * encoded in the `?tab=` query string so a) server components can read
 * it, b) the URL is shareable, c) browser back/forward works.
 */
export function HomeTabs({ active }: { active: FeedMode }) {
  const router = useRouter();
  const params = useSearchParams();

  function go(tab: FeedMode) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
    next.delete("cursor"); // restart pagination when switching tabs
    router.push(`/?${next.toString()}`);
  }

  return (
    <div role="tablist" className="grid grid-cols-2 border-b border-zinc-200">
      <TabButton active={active === "all"} onClick={() => go("all")}>
        For you
      </TabButton>
      <TabButton
        active={active === "following"}
        onClick={() => go("following")}
      >
        Following
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "relative py-3 text-sm font-semibold transition hover:bg-zinc-50",
        active ? "text-zinc-900" : "text-zinc-500"
      )}
    >
      <span>{children}</span>
      {active && (
        <span className="absolute inset-x-1/4 bottom-0 h-1 rounded-full bg-sky-500" />
      )}
    </button>
  );
}

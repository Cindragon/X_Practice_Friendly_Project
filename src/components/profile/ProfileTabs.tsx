"use client";

import { useState } from "react";
import { clsx } from "clsx";

type Tab = "posts" | "likes";

/**
 * Posts / Likes tab switcher. The content for each tab is filled in by
 * the parent (Step 8 wires Posts, Step 11 wires Likes); for now both
 * panels are placeholders so the visual shell is complete.
 */
export function ProfileTabs({
  postsSlot,
  likesSlot,
}: {
  postsSlot: React.ReactNode;
  likesSlot: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("posts");

  return (
    <div>
      <div
        role="tablist"
        className="grid grid-cols-2 border-b border-zinc-200 text-sm font-semibold"
      >
        <TabButton active={tab === "posts"} onClick={() => setTab("posts")}>
          Posts
        </TabButton>
        <TabButton active={tab === "likes"} onClick={() => setTab("likes")}>
          Likes
        </TabButton>
      </div>

      <div role="tabpanel">
        {tab === "posts" ? postsSlot : likesSlot}
      </div>
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
        "relative py-3 transition hover:bg-zinc-50",
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

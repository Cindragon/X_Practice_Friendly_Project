"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { signOutAction } from "@/app/actions";

type UserCardProps = {
  name: string;
  userID: string;
  avatarUrl: string | null;
};

/**
 * Bottom-of-sidebar user card. Click anywhere on the row to open a small
 * popup with a Logout option. Esc / outside-click dismisses the popup.
 */
export function UserCard({ name, userID, avatarUrl }: UserCardProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-black/10">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-2xl px-5 py-3 text-left text-sm font-bold text-zinc-900 transition hover:bg-zinc-50"
            >
              <LogOut className="h-5 w-5" />
              Log out @{userID}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-full p-3 transition hover:bg-zinc-100"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-sm font-bold text-zinc-700">
          {avatarUrl ? (
            // Plain <img> intentionally — avatars come from arbitrary OAuth
            // CDNs and configuring next/image remotePatterns for each is
            // overkill for the sidebar.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="hidden min-w-0 flex-1 text-left xl:block">
          <p className="truncate text-sm font-bold text-zinc-900">{name}</p>
          <p className="truncate text-sm text-zinc-500">@{userID}</p>
        </div>
        <MoreHorizontal className="hidden h-5 w-5 text-zinc-500 xl:block" />
      </button>
    </div>
  );
}

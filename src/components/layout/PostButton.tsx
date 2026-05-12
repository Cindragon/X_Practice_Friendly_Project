"use client";

import { useState } from "react";
import { PostComposerModal } from "@/components/composer/PostComposerModal";

/**
 * Sidebar Post button — opens the composer modal. Lives in the sidebar
 * so it's reachable from every page in the (app) shell.
 */
export function PostButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-full bg-sky-500 px-4 py-3 text-base font-bold text-white transition hover:bg-sky-600 xl:py-4"
      >
        <span className="xl:inline">Post</span>
      </button>

      {open && <PostComposerModal onClose={() => setOpen(false)} />}
    </>
  );
}

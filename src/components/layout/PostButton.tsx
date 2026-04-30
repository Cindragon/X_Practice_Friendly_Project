"use client";

/**
 * Sidebar Post button — bright filled style per spec. Wiring to a Post
 * composer modal arrives in Step 7; for now it's a placeholder.
 */
export function PostButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Composer modal lands in Step 7.
        alert("Post composer coming in Step 7");
      }}
      className="mt-4 w-full rounded-full bg-sky-500 px-4 py-3 text-base font-bold text-white transition hover:bg-sky-600 xl:py-4"
    >
      <span className="xl:inline">Post</span>
    </button>
  );
}

/**
 * Friendly placeholder shown inside each profile tab until the post
 * feed (Step 8) and likes feed (Step 11) are implemented.
 */
export function EmptyTab({ message }: { message: string }) {
  return (
    <div className="p-10 text-center text-sm text-zinc-500">{message}</div>
  );
}

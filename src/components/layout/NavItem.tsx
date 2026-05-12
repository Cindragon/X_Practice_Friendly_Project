"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  /**
   * A pre-rendered icon element (e.g. <Home className="h-7 w-7" />).
   *
   * We accept a node — not a `LucideIcon` component reference — because
   * server → client component boundaries can serialise JSX elements but
   * NOT raw component functions. Next.js 16 enforces this strictly.
   */
  icon: ReactNode;
  /** Match the route exactly instead of by prefix (used for "/" home). */
  exact?: boolean;
};

/**
 * Sidebar navigation row — icon + label, fills the rail width on desktop.
 * Active route is bolded; inactive rows highlight on hover (X-style).
 */
export function NavItem({ href, label, icon, exact = false }: NavItemProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-full px-4 py-3 text-xl transition",
        "text-zinc-900 hover:bg-zinc-100",
        active && "font-bold"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden xl:inline">{label}</span>
    </Link>
  );
}

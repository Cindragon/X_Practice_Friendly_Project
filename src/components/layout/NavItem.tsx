"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Match the route exactly instead of by prefix (used for "/" home). */
  exact?: boolean;
};

/**
 * Sidebar navigation row — icon + label, fills the rail width on desktop.
 * Active route is bolded; inactive rows highlight on hover (X-style).
 */
export function NavItem({ href, label, Icon, exact = false }: NavItemProps) {
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
      <Icon
        className="h-7 w-7 shrink-0"
        strokeWidth={active ? 2.5 : 2}
        aria-hidden
      />
      <span className="hidden xl:inline">{label}</span>
    </Link>
  );
}

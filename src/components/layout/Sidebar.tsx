import Link from "next/link";
import { Home, User } from "lucide-react";
import { Logo } from "./Logo";
import { NavItem } from "./NavItem";
import { PostButton } from "./PostButton";
import { UserCard } from "./UserCard";

type SidebarProps = {
  user: {
    name: string;
    userID: string;
    avatarUrl: string | null;
  };
};

/**
 * Left sidebar. Sticky, full-height. Collapses icon-only on smaller widths
 * (< xl) and shows labels on wide screens, mirroring x.com's responsive rail.
 */
export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col justify-between px-2 py-2 xl:w-64 xl:px-4">
      <div className="flex flex-col">
        <Link href="/" aria-label="Friendly home" className="self-start">
          <Logo />
        </Link>

        <nav className="mt-2 flex flex-col gap-1">
          <NavItem
            href="/"
            label="Home"
            icon={<Home className="h-7 w-7" aria-hidden />}
            exact
          />
          <NavItem
            href="/profile"
            label="Profile"
            icon={<User className="h-7 w-7" aria-hidden />}
          />
        </nav>

        <PostButton />
      </div>

      <UserCard
        name={user.name}
        userID={user.userID}
        avatarUrl={user.avatarUrl}
      />
    </aside>
  );
}

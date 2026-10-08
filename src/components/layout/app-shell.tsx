import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/sign-in/actions";
import { can, ROLE_LABELS, type StaffRole } from "@/domain/access";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { GLOBAL_NAV, type NavHospital } from "./nav-items";
import { NavLinks } from "./nav-links";

interface ShellUser {
  readonly fullName: string;
  readonly role: StaffRole;
  readonly organizationName: string;
}

function UserBlock({ user }: { user: ShellUser }) {
  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
        <p className="truncate text-xs text-muted">
          {ROLE_LABELS[user.role]} · {user.organizationName}
        </p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="secondary" size="sm" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}

export function AppShell({
  user,
  hospitals,
  children,
}: {
  user: ShellUser;
  hospitals: readonly NavHospital[];
  children: ReactNode;
}) {
  const items = GLOBAL_NAV.filter((i) => can(user.role, i.permission) || (i.permission === "view_audit" && hospitals.some((h) => h.role === "manager")));
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr] print:block">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-card lg:flex">
        <Link href="/hospitals" className="flex items-center gap-3 px-5 pt-6 pb-5">
          <Image src="/brand/rg-mark-color.png" alt="" width={36} height={36} priority />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-wide text-brand-orange-ink uppercase">Respiratory Gate</span>
            <span className="block text-xs text-muted">Respiratory Care Value</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <Suspense>
            <NavLinks items={items} hospitals={hospitals} />
          </Suspense>
        </nav>
        <div className="space-y-4 border-t border-line p-4">
          <UserBlock user={user} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card/95 px-4 py-2 backdrop-blur lg:hidden">
          <Link href="/hospitals" className="flex items-center gap-2">
            <Image src="/brand/rg-mark-color.png" alt="" width={28} height={28} priority />
            <span className="text-sm font-bold tracking-wide text-brand-orange-ink uppercase">Respiratory Gate</span>
          </Link>
          <Suspense>
            <MobileNav items={items} hospitals={hospitals} footer={<UserBlock user={user} />} />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <div className="mt-1 max-w-3xl text-sm text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

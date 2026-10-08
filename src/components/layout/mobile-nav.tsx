"use client";

import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { NavHospital, NavItem } from "./nav-items";
import { NavLinks } from "./nav-links";

export function MobileNav({ items, hospitals, footer }: { items: readonly NavItem[]; hospitals: readonly NavHospital[]; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X /> : <Menu />}
      </Button>
      {open ? (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-line bg-card px-4 pt-3 pb-4 shadow-lg"
        >
          <nav aria-label="Main">
            <NavLinks items={items} hospitals={hospitals} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="mt-4 border-t border-line pt-4">{footer}</div>
        </div>
      ) : null}
    </>
  );
}

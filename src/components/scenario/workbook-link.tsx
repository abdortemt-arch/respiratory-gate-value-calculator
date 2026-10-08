"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/** /hospitals/<id>/workbook for the current page. */
export function useWorkbookBase(): string {
  const pathname = usePathname();
  return /^(\/hospitals\/[^/]+\/workbook)/.exec(pathname)?.[1] ?? "/hospitals";
}

/**
 * Link within the current hospital's Workbook Value Model, e.g. to="inputs#icu_beds",
 * to="value-bridge", to="?occ=0.8" (overview with a query) or to="" (overview).
 */
export function WorkbookLink({ to, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { to: string }) {
  const base = useWorkbookBase();
  const href = to === "" || to.startsWith("?") || to.startsWith("#") ? `${base}${to}` : `${base}/${to}`;
  return <Link href={href} {...props} />;
}

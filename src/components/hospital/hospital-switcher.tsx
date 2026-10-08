"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/field";

/** Switch to the same page of another hospital (falls back to the section's index page). */
export function HospitalSwitcher({ currentId, hospitals }: { currentId: string; hospitals: readonly { id: string; name: string; active: boolean }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  if (hospitals.length < 2) return null;
  return (
    <Select
      aria-label="Switch hospital"
      value={currentId}
      className="h-8 w-auto max-w-56 text-xs"
      onChange={(e) => {
        const rest = pathname.split(`/hospitals/${currentId}`)[1] ?? "";
        const parts = rest.split("/").filter(Boolean);
        // Keep the section (e.g. /pricing or /workbook/revenue), not record ids or months.
        const keep = parts[0] === "workbook" ? parts.slice(0, 2) : parts.slice(0, 1);
        router.push(`/hospitals/${e.target.value}${keep.length ? `/${keep.join("/")}` : ""}`);
      }}
    >
      {hospitals.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
          {h.active ? "" : " (inactive)"}
        </option>
      ))}
    </Select>
  );
}

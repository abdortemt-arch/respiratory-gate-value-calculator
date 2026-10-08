"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { monthLabel, type Month } from "@/domain/hospital";
import { Select } from "@/components/ui/field";

/** Selects the month shown on a page (?month=YYYY-MM). */
export function MonthPicker({ months, value, label = "Month", param = "month" }: { months: readonly Month[]; value: Month; label?: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = months.includes(value) ? months : [value, ...months];
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <span className="font-medium">{label}</span>
      <Select
        value={value}
        className="h-9 w-auto"
        onChange={(e) => {
          const q = new URLSearchParams(searchParams.toString());
          q.set(param, e.target.value);
          router.push(`${pathname}?${q.toString()}`);
        }}
      >
        {[...options].sort().reverse().map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </Select>
    </label>
  );
}

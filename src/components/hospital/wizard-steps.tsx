import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export const WIZARD_STEPS = [
  { id: "hospital", label: "Hospital" },
  { id: "departments", label: "Departments" },
  { id: "services", label: "Services" },
  { id: "pricing", label: "Prices" },
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

/** Onboarding progress: Hospital → Departments → Services → Prices. */
export function WizardSteps({ current, hospitalId }: { current: WizardStep; hospitalId?: string }) {
  const index = WIZARD_STEPS.findIndex((s) => s.id === current);
  return (
    <ol aria-label="Onboarding steps" className="no-print mb-6 flex flex-wrap items-center gap-2 text-sm">
      {WIZARD_STEPS.map((s, i) => {
        const done = i < index;
        const active = i === index;
        const content = (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1",
              active ? "border-brand-orange bg-brand-orange-50 font-semibold text-brand-orange-ink" : done ? "border-brand-blue-100 bg-brand-blue-50 text-brand-blue-700" : "border-line bg-card text-muted",
            )}
          >
            <span className="figure inline-flex size-5 items-center justify-center rounded-full bg-card text-xs">{done ? <Check aria-hidden className="size-3.5" /> : i + 1}</span>
            {s.label}
          </span>
        );
        return (
          <li key={s.id} aria-current={active ? "step" : undefined}>
            {done && hospitalId && s.id !== "hospital" ? <Link href={`/hospitals/${hospitalId}/setup/${s.id}`}>{content}</Link> : content}
          </li>
        );
      })}
    </ol>
  );
}

import { ShieldCheck } from "lucide-react";
import { GUARDRAILS, type GuardrailId } from "@/domain/copy/guardrails";

/** Financial safety rules from the workbook's Read Me, shown next to the figures they govern. */
export function Guardrails({ ids, className }: { ids: readonly GuardrailId[]; className?: string }) {
  const rules = GUARDRAILS.filter((g) => ids.includes(g.id));
  return (
    <aside aria-label="Financial guardrails" className={className}>
      <ul className="grid gap-3 md:grid-cols-2">
        {rules.map((r) => (
          <li key={r.id} className="flex gap-2.5 rounded-xl border border-line bg-card p-3.5 text-sm">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-blue" />
            <span>
              <span className="font-semibold text-ink">{r.title}.</span> <span className="text-ink-soft">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

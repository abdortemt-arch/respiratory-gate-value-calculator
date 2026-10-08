import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  info: { icon: Info, className: "border-brand-blue-100 bg-brand-blue-50 text-brand-blue-900" },
  caution: { icon: AlertTriangle, className: "border-caution-200 bg-caution-50 text-caution" },
  danger: { icon: XCircle, className: "border-danger/20 bg-danger-50 text-danger" },
  positive: { icon: CheckCircle2, className: "border-positive/20 bg-positive-50 text-positive" },
} as const;

type AlertProps = Omit<ComponentProps<"div">, "title"> & { tone?: keyof typeof TONES; title?: ReactNode };

export function Alert({ tone = "info", title, className, children, ...props }: AlertProps) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", toneClass, className)} {...props}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink-soft [&_a]:font-medium [&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}

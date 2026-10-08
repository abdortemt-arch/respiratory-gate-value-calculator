"use client";

import { useRouter } from "next/navigation";
import { HOSPITAL_TYPES } from "@/domain/hospital";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { ActionForm, Checkbox, type Result } from "./forms";

export interface HospitalFormValues {
  readonly name: string;
  readonly code: string;
  readonly type: string | null;
  readonly totalBeds: number | null;
  readonly location: string | null;
  readonly notes: string | null;
  readonly active: boolean;
}

/** Step 1 of onboarding, and the hospital details form in Settings. */
export function HospitalForm({
  action,
  initial,
  mode,
  disabled = false,
}: {
  action: (form: FormData) => Promise<Result>;
  initial?: HospitalFormValues;
  mode: "create" | "edit";
  disabled?: boolean;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={action}
      resetOnSuccess={false}
      success={mode === "edit" ? "Hospital details saved." : undefined}
      onDone={(r) => {
        if (mode === "create" && r.id) router.push(`/hospitals/${r.id}/setup/departments`);
      }}
    >
      {(pending) => (
        <fieldset disabled={disabled || pending} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="h-name">Hospital name</Label>
            <Input id="h-name" name="name" required minLength={2} maxLength={160} defaultValue={initial?.name} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-code">Code</Label>
            <Input id="h-code" name="code" required maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{0,19}" defaultValue={initial?.code} className="uppercase" autoComplete="off" />
            <FieldHint>Short identifier, e.g. HOSP-A. Letters, digits, - and _.</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-type">Hospital type</Label>
            <Select id="h-type" name="hospitalType" defaultValue={initial?.type ?? ""}>
              <option value="">Not specified</option>
              {Object.entries(HOSPITAL_TYPES).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-beds">Total beds</Label>
            <Input id="h-beds" name="totalBeds" inputMode="numeric" defaultValue={initial?.totalBeds ?? ""} className="figure" placeholder="Unknown" />
            <FieldHint>Whole hospital. Leave blank if unknown — department beds are used instead.</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-location">Location</Label>
            <Input id="h-location" name="location" maxLength={200} defaultValue={initial?.location ?? ""} placeholder="City, governorate" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="h-notes">Notes</Label>
            <textarea
              id="h-notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={initial?.notes ?? ""}
              className="w-full rounded-lg border border-line-strong bg-card px-3 py-2 text-sm text-ink focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
            />
          </div>
          {mode === "create" ? (
            <div className="sm:col-span-2">
              <input type="hidden" name="active" value="off" />
              <Checkbox name="active" value="on" defaultChecked label="Active (records new monthly data)" />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit">{mode === "create" ? (pending ? "Creating…" : "Create hospital and continue") : pending ? "Saving…" : "Save details"}</Button>
          </div>
        </fieldset>
      )}
    </ActionForm>
  );
}

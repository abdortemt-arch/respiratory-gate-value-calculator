"use client";

import { useState } from "react";
import { BILLING_UNITS, describePriceVersion, isOneOf, type BillingUnit } from "@/domain/hospital";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { ActionForm, type Result } from "./forms";

export interface PricedService {
  readonly id: string;
  readonly name: string;
  /** Billing unit of the latest version, used as the default. */
  readonly billingUnit: BillingUnit | null;
}

/** Add an effective-dated price: it applies from the chosen month until the next version. */
export function PriceForm({
  services,
  currency,
  defaultMonth,
  action,
  initialServiceId,
}: {
  services: readonly PricedService[];
  currency: string;
  defaultMonth: string;
  action: (form: FormData) => Promise<Result>;
  initialServiceId?: string;
}) {
  const [serviceId, setServiceId] = useState(initialServiceId ?? services[0]?.id ?? "");
  const [unit, setUnit] = useState<BillingUnit>(services.find((s) => s.id === serviceId)?.billingUnit ?? "per_procedure");
  if (services.length === 0) return <p className="text-sm text-muted">Add services first, then record their prices.</p>;
  return (
    <ActionForm
      action={action}
      resetOnSuccess={false}
      success={(_, f) => {
        const name = services.find((s) => s.id === f.get("hospitalServiceId"))?.name ?? "Service";
        const u = String(f.get("billingUnit"));
        return `Saved: ${name} ${describePriceVersion({
          amount: Number(String(f.get("amount")).replace(/[,\s]/g, "")),
          currency: String(f.get("currency") || currency).toUpperCase(),
          billingUnit: isOneOf(BILLING_UNITS, u) ? u : "custom",
          effectiveFrom: String(f.get("effectiveFrom")),
        })}.`;
      }}
      className="rounded-xl border border-line bg-surface/60 p-4"
    >
      {(pending) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_9rem_6rem_minmax(0,1.2fr)_11rem]">
            <div className="space-y-1.5">
              <Label htmlFor="price-service">Service</Label>
              <Select
                id="price-service"
                name="hospitalServiceId"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  const u = services.find((s) => s.id === e.target.value)?.billingUnit;
                  if (u) setUnit(u);
                }}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-amount">{unit === "percentage" ? "Percentage" : "Price"}</Label>
              <Input id="price-amount" name="amount" required inputMode="decimal" className="figure text-right" placeholder={unit === "percentage" ? "e.g. 12" : "e.g. 1500"} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-currency">Currency</Label>
              <Input id="price-currency" name="currency" defaultValue={currency} maxLength={3} className="uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-unit">Billing unit</Label>
              <Select id="price-unit" name="billingUnit" value={unit} onChange={(e) => setUnit(e.target.value as BillingUnit)}>
                {Object.entries(BILLING_UNITS).map(([v, u]) => (
                  <option key={v} value={v}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-from">Effective from</Label>
              <Input id="price-from" name="effectiveFrom" type="month" required defaultValue={defaultMonth} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-notes">Notes</Label>
              <Input id="price-notes" name="notes" maxLength={1000} placeholder="e.g. Contract renewal 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-reason">Reason (for corrections)</Label>
              <Input id="price-reason" name="changeReason" maxLength={500} placeholder="Required if it changes a finalized month" />
            </div>
          </div>
          <FieldHint>
            A new price never overwrites history: it applies from the first day of this month until the next price. Months before
            it keep their own prices.
          </FieldHint>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add price"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

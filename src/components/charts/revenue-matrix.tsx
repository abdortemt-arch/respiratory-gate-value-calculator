"use client";

import { useState } from "react";
import type { RevenueMatrix as Matrix, RevenuePeriod } from "@/domain/calculations/revenue";
import { formatEgp, formatEgpCompact, formatNumber, formatPercent } from "@/domain/format";
import { cn } from "@/lib/cn";
import { Segmented } from "@/components/ui/segmented";
import { MissingInputs } from "@/components/metrics/quantity";
import { CHART } from "./chart-tokens";

const PERIODS: readonly { value: RevenuePeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

/**
 * Occupancy × package price grid (workbook Revenue!B17:E35). Cells are shaded
 * on one blue ramp by magnitude; the selected scenario is ringed in orange.
 * Clicking a cell selects that occupancy and price.
 */
export function RevenueMatrix({
  matrix,
  selected,
  onSelect,
}: {
  matrix: Matrix;
  selected: { occupancyRate: number; packagePrice: number };
  onSelect: (occupancyRate: number, packagePrice: number) => void;
}) {
  const [period, setPeriod] = useState<RevenuePeriod>("annual");
  if (matrix.kind === "missing") {
    return (
      <div className="rounded-xl border border-caution-200 bg-caution-50 p-4 text-sm">
        <p className="font-semibold text-caution">Data required</p>
        <MissingInputs keys={matrix.required} />
      </div>
    );
  }
  const all = matrix.rows.flatMap((r) => r[period]);
  const max = Math.max(...all, 1);
  const unit = period === "daily" ? "EGP / day" : period === "monthly" ? `EGP / month (${matrix.daysPerMonth}-day month)` : `EGP / year (${matrix.daysPerYear} days)`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS} />
        <p className="text-xs text-muted">{unit}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[19rem] border-separate border-spacing-[3px] text-sm">
          <caption className="sr-only">Gross ICU package potential by occupancy and package price, {unit}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1.5 text-left text-xs font-medium text-muted">
                Occupancy
              </th>
              <th scope="col" className="hidden px-2 py-1.5 text-right text-xs font-medium text-muted sm:table-cell">
                Occupied beds
              </th>
              {matrix.prices.map((p) => (
                <th key={p} scope="col" className="px-1 py-1.5 text-right text-xs font-medium text-muted sm:px-2">
                  {formatEgp(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.occupancy}>
                <th scope="row" className="px-2 py-2 text-left font-semibold text-ink">
                  {formatPercent(row.occupancy)}
                  <span className="figure block text-xs font-normal text-muted sm:hidden">{formatNumber(row.occupiedBeds)} beds</span>
                </th>
                <td className="figure hidden px-2 py-2 text-right text-ink-soft sm:table-cell">{formatNumber(row.occupiedBeds)}</td>
                {row[period].map((v, i) => {
                  const price = matrix.prices[i];
                  const isSelected = row.occupancy === selected.occupancyRate && price === selected.packagePrice;
                  const strength = 6 + Math.round((v / max) * 30);
                  return (
                    <td key={price} className="p-0">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        title={`${formatPercent(row.occupancy)} occupancy × ${formatEgp(price)}: ${formatEgp(v)}`}
                        onClick={() => onSelect(row.occupancy, price)}
                        className={cn(
                          "figure w-full rounded-md px-1.5 py-2 text-right text-ink transition-shadow hover:ring-2 hover:ring-brand-blue/40 sm:px-2",
                          isSelected && "font-semibold ring-[3px] ring-brand-orange hover:ring-brand-orange",
                        )}
                        style={{ background: `color-mix(in oklab, ${CHART.revenue} ${strength}%, white)` }}
                      >
                        <span className="hidden sm:inline">{formatEgp(v)}</span>
                        {/* Unit is stated above the grid; phones show 8.76M. */}
                        <span className="whitespace-nowrap sm:hidden">{formatEgpCompact(v).replace("EGP ", "")}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Occupied beds = {formatNumber(matrix.beds)} ICU beds × occupancy. Select a cell to use it as the scenario. Darker = larger.
      </p>
    </div>
  );
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildReferenceDataSql,
  buildWorkbookTemplatesSql,
  REFERENCE_DATA_MIGRATION,
  WORKBOOK_TEMPLATES_MIGRATION,
} from "../../scripts/db/reference-data";

describe("reference-data migration", () => {
  it("matches the input catalog (run `pnpm db:reference-data`, or add a new migration once deployed)", () => {
    const onDisk = readFileSync(fileURLToPath(new URL(`../../${REFERENCE_DATA_MIGRATION}`, import.meta.url)), "utf8");
    expect(onDisk).toBe(buildReferenceDataSql());
  });

  it("workbook template migration matches the input catalog", () => {
    const onDisk = readFileSync(fileURLToPath(new URL(`../../${WORKBOOK_TEMPLATES_MIGRATION}`, import.meta.url)), "utf8");
    expect(onDisk).toBe(buildWorkbookTemplatesSql());
  });
});

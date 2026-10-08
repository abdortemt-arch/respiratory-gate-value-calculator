import { redirectToWorkbook } from "../_lib/workbook-redirect";

export default function Page({ searchParams }: PageProps<"/reports">) {
  return redirectToWorkbook("/report", searchParams);
}

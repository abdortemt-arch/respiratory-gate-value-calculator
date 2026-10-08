import { redirectToWorkbook } from "../_lib/workbook-redirect";

export default function Page({ searchParams }: PageProps<"/revenue">) {
  return redirectToWorkbook("/revenue", searchParams);
}

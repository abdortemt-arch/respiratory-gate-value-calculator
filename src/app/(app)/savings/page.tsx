import { redirectToWorkbook } from "../_lib/workbook-redirect";

export default function Page({ searchParams }: PageProps<"/savings">) {
  return redirectToWorkbook("/savings", searchParams);
}

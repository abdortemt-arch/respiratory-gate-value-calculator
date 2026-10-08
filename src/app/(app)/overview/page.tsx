import { redirectToWorkbook } from "../_lib/workbook-redirect";

export default function Page({ searchParams }: PageProps<"/overview">) {
  return redirectToWorkbook("", searchParams);
}

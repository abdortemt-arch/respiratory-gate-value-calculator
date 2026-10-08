import { redirectToWorkbook } from "../_lib/workbook-redirect";

export default function Page({ searchParams }: PageProps<"/inputs">) {
  return redirectToWorkbook("/inputs", searchParams);
}

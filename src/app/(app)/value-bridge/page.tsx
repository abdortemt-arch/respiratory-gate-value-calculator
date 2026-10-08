import { redirectToWorkbook } from "../_lib/workbook-redirect";

export default function Page({ searchParams }: PageProps<"/value-bridge">) {
  return redirectToWorkbook("/value-bridge", searchParams);
}

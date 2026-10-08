import { PageHeader } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/session";

export default async function Page() {
  await requireUser("export_reports");
  return <PageHeader title="Reports" description="Coming in the next milestone." />;
}

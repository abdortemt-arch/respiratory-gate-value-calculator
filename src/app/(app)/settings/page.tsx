import { PageHeader } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/session";

export default async function Page() {
  await requireUser("view_dashboards");
  return <PageHeader title="Settings" description="Coming in the next milestone." />;
}

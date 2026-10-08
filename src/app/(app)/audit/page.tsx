import { PageHeader } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/session";

export default async function Page() {
  await requireUser("view_audit");
  return <PageHeader title="Audit" description="Coming in the next milestone." />;
}

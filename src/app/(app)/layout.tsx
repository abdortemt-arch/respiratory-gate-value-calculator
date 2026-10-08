import { completeness } from "@/domain/calculations/completeness";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/session";
import { loadWorkspace } from "@/server/data/workspace";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const workspace = await loadWorkspace(user);
  return (
    <AppShell user={user} completeness={completeness(workspace.values).model}>
      {children}
    </AppShell>
  );
}

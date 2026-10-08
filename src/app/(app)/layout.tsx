import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/session";
import { loadHospitalsWithRoles } from "@/server/hospitals/access";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const hospitals = await loadHospitalsWithRoles(user);
  return (
    <AppShell
      user={user}
      hospitals={hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        code: h.code,
        active: h.active,
        workbookModelEnabled: h.workbookModelEnabled,
        role: h.role,
      }))}
    >
      {children}
    </AppShell>
  );
}

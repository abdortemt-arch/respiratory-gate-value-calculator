import Image from "next/image";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/brand/rg-logo-color.png" alt="Respiratory Gate" width={120} height={139} priority />
          <p className="mt-4 text-sm font-medium text-ink-soft">Respiratory Care Value Platform</p>
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-muted">
          Internal use. Operational and financial service-line data only — never enter patient information.
        </p>
      </div>
    </main>
  );
}

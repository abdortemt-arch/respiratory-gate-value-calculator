import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Respiratory Gate", template: "%s · Respiratory Gate" },
  description: "Respiratory Care management and financial value platform.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#12678d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

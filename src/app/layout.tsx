import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Respiratory Gate — Respiratory Care Value Platform",
  description: "Respiratory Care management and financial value platform.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

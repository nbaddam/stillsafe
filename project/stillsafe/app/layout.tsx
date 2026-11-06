import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "StillSafe — understand your stillbirth risk",
  description: "A private, evidence-based stillbirth risk check for pregnant people. Not medical advice.",
};
export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

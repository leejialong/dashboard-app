import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified Inbox",
  description: "Multi-account email dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

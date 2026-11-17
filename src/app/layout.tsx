import type { Metadata } from "next";
import "./globals.css";
import { PRODUCT_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Stop wasting ad spend. Get more leads and sales for the same budget.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}

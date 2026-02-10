import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Film Studio OS",
  description: "Shot management and production dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-200 min-h-screen">{children}</body>
    </html>
  );
}

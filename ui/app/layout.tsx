import type { Metadata } from "next";
import "./globals.css";
import "@xterm/xterm/css/xterm.css";

export const metadata: Metadata = {
  title: "AI 影视工作室 OS",
  description: "镜头管理与制作仪表盘",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-950 text-slate-200 min-h-screen">{children}</body>
    </html>
  );
}

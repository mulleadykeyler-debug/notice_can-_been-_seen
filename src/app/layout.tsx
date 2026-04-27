import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schedule App",
  description: "日程管理应用",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}

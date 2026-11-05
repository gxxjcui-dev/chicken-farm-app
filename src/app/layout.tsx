import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "鸡棚数据管理系统",
  description: "肉鸡养殖日常数据记录与监控",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl px-3 py-4 pb-20 sm:px-6">{children}</main>
      </body>
    </html>
  );
}

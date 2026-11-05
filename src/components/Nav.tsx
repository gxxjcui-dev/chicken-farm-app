"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "仪表盘", icon: "📊" },
  { href: "/batches", label: "批次管理", icon: "🐣" },
  { href: "/records", label: "每日录入", icon: "📝" },
  { href: "/alerts", label: "告警列表", icon: "🔔" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <>
      {/* 顶部标题栏 */}
      <header className="bg-green-700 text-white shadow">
        <div className="mx-auto max-w-5xl px-3 py-3 sm:px-6">
          <h1 className="text-lg font-bold">🐔 鸡棚数据管理系统</h1>
          <p className="text-xs text-green-100">肉鸡养殖日常数据记录与监控</p>
        </div>
      </header>
      {/* 手机端底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white sm:hidden">
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-2 text-xs ${
                  active ? "text-green-700 font-semibold" : "text-gray-500"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {/* 桌面端顶部导航 */}
      <nav className="hidden border-b border-gray-200 bg-white sm:block">
        <div className="mx-auto flex max-w-5xl gap-1 px-6">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-3 text-sm border-b-2 ${
                  active
                    ? "border-green-600 text-green-700 font-semibold"
                    : "border-transparent text-gray-600 hover:text-green-700"
                }`}
              >
                {item.icon} {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

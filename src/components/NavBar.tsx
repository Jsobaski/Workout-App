"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "📅" },
  { href: "/trends", label: "Trends", icon: "📈" },
  { href: "/measurements", label: "Measure", icon: "📏" },
  { href: "/muscles", label: "Muscles", icon: "💪" },
  { href: "/badges", label: "Badges", icon: "🏅" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-black/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b">
      <div className="mx-auto flex max-w-2xl justify-around sm:justify-start sm:gap-6 sm:px-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 sm:flex-none flex-col sm:flex-row items-center gap-0.5 sm:gap-2 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                active
                  ? "text-emerald-400"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className="text-lg sm:text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

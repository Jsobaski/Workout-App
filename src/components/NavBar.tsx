"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const TABS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/",
    label: "Today",
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    href: "/trends",
    label: "Trends",
    icon: (
      <svg {...iconProps}>
        <path d="M3 17l5.5-5.5 4 4L21 7M15 7h6v6" />
      </svg>
    ),
  },
  {
    href: "/measurements",
    label: "Measure",
    icon: (
      <svg {...iconProps}>
        <rect x="2.5" y="8.5" width="19" height="7" rx="2" />
        <path d="M7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v4" />
      </svg>
    ),
  },
  {
    href: "/muscles",
    label: "Muscles",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="5.5" r="2.5" />
        <path d="M6.5 21v-7L4 9.5M17.5 21v-7L20 9.5M8 9.5h8M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

// A floating, frosted tab bar. Colours use the emerald scale, so holiday and custom themes recolour it.
export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-4 left-1/2 z-40 w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around rounded-full border border-white/10 bg-neutral-900/80 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[10.5px] font-semibold transition-colors ${
                active ? "bg-emerald-400/15 text-emerald-400" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

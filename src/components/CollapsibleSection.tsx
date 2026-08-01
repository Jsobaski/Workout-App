"use client";

import { ReactNode, useState } from "react";

export default function CollapsibleSection({
  title,
  right,
  defaultOpen = true,
  children,
}: {
  title: string;
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/60">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 text-base font-semibold text-neutral-100">
          <span
            className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          {title}
        </span>
        {right}
      </button>
      {open && <div className="border-t border-neutral-800 p-4">{children}</div>}
    </section>
  );
}

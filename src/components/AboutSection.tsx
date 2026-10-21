"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// Build info, so it's easy to tell which version a device is running.
export default function AboutSection() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  const build = process.env.NEXT_PUBLIC_BUILD_ID;
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME;
  // Formatted in the viewer's locale/timezone on the client only (null while server rendering).
  const lastUpdated = useSyncExternalStore(
    noopSubscribe,
    () =>
      builtAt
        ? new Date(builtAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })
        : "Unknown",
    () => null
  );
  const rows: [string, string][] = [
    ["Version", version ? `v${version}` : "Unknown"],
    ["Build", build && build !== "local" ? build : "Local development"],
    ["Last updated", lastUpdated ?? "…"],
  ];
  return (
    <dl className="divide-y divide-neutral-800 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="text-neutral-500">{label}</dt>
          <dd className="min-w-0 text-right font-medium text-neutral-200">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

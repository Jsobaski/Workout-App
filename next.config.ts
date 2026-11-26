import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Short commit hash of this build: Vercel's commit SHA when deployed, otherwise the local git HEAD.
function buildId(): string {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "local";
  } catch {
    return "local";
  }
}

const nextConfig: NextConfig = {
  // Shown in Settings > About and at the top of the muscle export, so it's easy to tell which build produced what.
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "",
  },
  async redirects() {
    // Badges moved into the Trends screen.
    return [{ source: "/badges", destination: "/trends", permanent: false }];
  },
};

export default nextConfig;

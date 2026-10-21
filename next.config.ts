import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shown in Settings > About so it's easy to tell which build a device is running.
  env: {
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "",
  },
  async redirects() {
    // Badges moved into the Trends screen.
    return [{ source: "/badges", destination: "/trends", permanent: false }];
  },
};

export default nextConfig;

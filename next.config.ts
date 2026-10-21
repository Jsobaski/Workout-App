import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shown in Settings so it's easy to tell which build a device is running.
  env: { NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7) },
  async redirects() {
    // Badges moved into the Trends screen.
    return [{ source: "/badges", destination: "/trends", permanent: false }];
  },
};

export default nextConfig;

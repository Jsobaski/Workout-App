import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Badges moved into the Trends screen.
    return [{ source: "/badges", destination: "/trends", permanent: false }];
  },
};

export default nextConfig;

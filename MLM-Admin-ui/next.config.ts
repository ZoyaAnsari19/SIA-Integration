import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Proxy /api/v1 to the real API server when admin runs on same host (e.g. admin:3000, API:3006).
  // Set NEXT_PUBLIC_API_SERVER_ORIGIN=http://localhost:3006 (or API port) in .env.local
  // so upload and all API calls get the real response instead of {}.
  async rewrites() {
    const origin = process.env.NEXT_PUBLIC_API_SERVER_ORIGIN || process.env.API_SERVER_ORIGIN;
    if (!origin?.startsWith("http")) return [];
    return [{ source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",
  // Pin Turbopack root to this project to avoid picking an upper-level lockfile
  turbopack: {
    root: __dirname,
  },
  // Allow cross-origin requests from specific origins during development
  allowedDevOrigins: ["172.16.0.62"],
  // Optimize package imports for faster compilation
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    // Workaround for intermittent dev RSC manifest corruption in Next 15.x devtools
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;

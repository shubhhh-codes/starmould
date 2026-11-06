import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  compress: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    "10.182.97.120",
    "10.182.97.120:3000",
    "localhost",
  ],
  async redirects() {
    return [
      {
        source: "/customer",
        destination: "/customers",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;


import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  compress: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    "10.83.100.102",
    "10.83.100.102:3000",
    "localhost",
    "127.0.0.1",
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


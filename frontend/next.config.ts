import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "192.168.1.122",
    "192.168.1.122:3000",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
};

export default nextConfig;


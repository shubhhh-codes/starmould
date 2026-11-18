import type { NextConfig } from "next";
import os from "os";
import path from "path";

// Dynamically collect every non-loopback IPv4 address so allowedDevOrigins
// works on any LAN IP without manual changes when the IP rotates.
function getLocalIPs(): string[] {
  const origins: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        origins.push(iface.address);
        origins.push(`${iface.address}:3000`);
      }
    }
  }
  return origins;
}

const nextConfig: NextConfig = {
  compress: true,
  outputFileTracingIncludes: {
    '/api/backup': ['scripts/backup/native/**/*'],
    '/api/backup/generate': ['scripts/backup/native/**/*'],
    '/api/backup/cron': ['scripts/backup/native/**/*'],
    '/api/backup/cron/*': ['scripts/backup/native/**/*'],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ["localhost", ...getLocalIPs()],
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

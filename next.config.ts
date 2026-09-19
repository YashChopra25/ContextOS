import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ioredis uses Node sockets; load it with Node's require instead of bundling it.
  serverExternalPackages: ["ioredis"],
};

export default nextConfig;

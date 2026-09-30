import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // A lockfile higher up the disk would otherwise be taken as the workspace root.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;

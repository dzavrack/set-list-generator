import path from "node:path";
import type { NextConfig } from "next";

// Set when building for GitHub Pages, which serves the site from /<repo-name>/.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // A lockfile higher up the disk would otherwise be taken as the workspace root.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;

import type { NextConfig } from "next";

// Statisk export för GitHub Pages. SQLite/better-sqlite3 körs endast vid bygget
// (datat bakas in i statiska sidor) – ingen backend vid drift.
// basePath sätts till repots namn vid Pages-bygget via NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  // better-sqlite3 används vid build (statisk generering), inte vid drift.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;

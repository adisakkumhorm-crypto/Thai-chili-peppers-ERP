import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ['72.62.64.11', 'localhost'],
  // Pin the workspace root to this project. A stray lockfile in a parent
  // directory can otherwise make Next infer the wrong root.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig

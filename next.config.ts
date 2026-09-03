import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '72.62.64.11', 
    'localhost',
    'loves-tip-sponsors-pirates.trycloudflare.com',
    'erp.estimateoohub.cloud'
  ],
  // Pin the workspace root to this project. A stray lockfile in a parent
  // directory can otherwise make Next infer the wrong root.
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: '/auth/v1/:path*',
        destination: 'http://127.0.0.1:54321/auth/v1/:path*',
      },
      {
        source: '/rest/v1/:path*',
        destination: 'http://127.0.0.1:54321/rest/v1/:path*',
      },
      {
        source: '/storage/v1/:path*',
        destination: 'http://127.0.0.1:54321/storage/v1/:path*',
      },
      {
        source: '/realtime/v1/:path*',
        destination: 'http://127.0.0.1:54321/realtime/v1/:path*',
      }
    ]
  }
}

export default nextConfig

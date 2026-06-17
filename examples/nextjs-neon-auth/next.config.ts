import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@neondatabase/auth', '@neondatabase/auth-ui'],
};

export default nextConfig;

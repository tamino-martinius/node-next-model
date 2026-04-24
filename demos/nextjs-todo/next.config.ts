import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `better-sqlite3` is a native module — Next must not try to bundle it
  // for serverless. Treat it (and its transitive friends) as external.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;

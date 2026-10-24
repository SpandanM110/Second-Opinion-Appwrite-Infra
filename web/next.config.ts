import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The repo root has its own lockfile (seed + functions); this app is self-contained in web/.
  turbopack: { root: path.resolve(__dirname) },
};

export default config;

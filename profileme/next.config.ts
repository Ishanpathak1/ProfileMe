import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // WalletConnect/pino optional deps sometimes reference Node modules in browser.
  // These fallbacks silence warnings in some environments.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };
    // Prevent optional Node-only pretty printer from being bundled in the browser
    // Some deps (WalletConnect -> pino) reference it conditionally
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;

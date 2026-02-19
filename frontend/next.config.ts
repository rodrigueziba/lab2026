import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,             // Revisar cambios cada 1 segundo
      aggregateTimeout: 300,  // Esperar un poquito antes de reconstruir
    };
    return config;
  },
};

export default nextConfig;
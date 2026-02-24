import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Tus watchOptions (los dejo tal cual)
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };

    /**
     * FIX: evita que Next/Webpack aplique generator.filename a asset/inline
     * (que rompe con libs que usan data:... como Spark/wasm)
     */
    if (config.module?.generator?.asset?.filename) {
      // Mover filename a asset/resource (donde sí es válido)
      config.module.generator["asset/resource"] = {
        ...(config.module.generator["asset/resource"] || {}),
        filename: config.module.generator.asset.filename,
      };

      // Y sacarlo de "asset" para que no infecte a asset/inline
      delete config.module.generator.asset.filename;
    }

    return config;
  },
};

export default nextConfig;
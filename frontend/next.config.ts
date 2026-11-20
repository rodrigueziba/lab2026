import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Z107: ninguna función del servidor necesita leer en tiempo de ejecución los mp3 ni los archivos de mediapipe de
  // /public (/api/music y /api/music-list ahora se arman en el build). Sin esto, el trazado de archivos los metía en
  // el paquete de la función y Vercel la rechazaba por superar 250 MB.
  outputFileTracingExcludes: {
    "*": ["public/**/*.mp3", "public/alight/mediapipe/**"],
  },
  webpack: (config) => {
    // Enable async WASM for @mediapipe/tasks-vision
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Tus watchOptions (los dejo tal cual)
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node$": false,
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
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otra carpeta de build para correr una segunda copia en paralelo (pruebas sin login).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🛠️ FIX: Isola pacotes nativos de Node.js pesados para que o Turbopack não quebre seus utilitários internos
  serverExternalPackages: [
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "@sparticuz/chromium"
  ]
};

export default nextConfig;
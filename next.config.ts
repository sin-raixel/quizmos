import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Connects Tailwind CSS to Next.js (same setup as the portfolio).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

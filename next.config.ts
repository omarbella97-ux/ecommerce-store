import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // The admin area starts at its product list (which checks the role).
    return [{ source: "/admin", destination: "/admin/products", permanent: false }];
  },
  images: {
    // Temporary stock photography (Unsplash License) until own product shots exist.
    // The admin image validator (src/lib/admin-validation.ts) mirrors this pattern.
    remotePatterns: [new URL("https://images.unsplash.com/**")],
  },
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

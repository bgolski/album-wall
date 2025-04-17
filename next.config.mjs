/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // Enable static HTML export
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: {
    unoptimized: true,
  },
  // Add a trailing slash to improve path handling in GitHub Pages
  trailingSlash: true,
  // We need to disable outputFileTracing for static export
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "node_modules/@swc/core-linux-x64-gnu",
        "node_modules/@swc/core-linux-x64-musl",
        "node_modules/@esbuild/linux-x64",
      ],
    },
  },
};

export default nextConfig;

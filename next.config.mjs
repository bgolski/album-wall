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
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use environment variable to determine if we're doing static export
  ...(process.env.NEXT_STATIC_EXPORT === "true" ? { output: "export" } : {}),

  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: {
    unoptimized: true,
  },
  // Add a trailing slash to improve path handling in GitHub Pages
  trailingSlash: true,
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Booking API routes need a Node.js server; opt into the legacy export explicitly.
  ...(process.env.STATIC_EXPORT === "1" ? { output: "export" } : {}),
  images: {
    unoptimized: true
  },
  trailingSlash: true
};

module.exports = nextConfig;

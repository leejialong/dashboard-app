/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["playwright-core", "@browserbasehq/sdk"],
  },
};

module.exports = nextConfig;

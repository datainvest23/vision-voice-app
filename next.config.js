/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove or update experimental settings if not needed.
  // experimental: {
  //   serverMemoryTimeout: 120000,
  //   serverComponentsExternalPackages: [],
  // },
  webpack: (config) => {
    config.performance = {
      ...config.performance,
      maxEntrypointSize: 10 * 1024 * 1024,
      maxAssetSize: 10 * 1024 * 1024,
    };
    return config;
  },
};

module.exports = nextConfig;

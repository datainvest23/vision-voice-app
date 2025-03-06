/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add any specific config options here if needed
  
  // API configuration moved to correct location for Next.js 15+
  experimental: {
    serverMemoryTimeout: 120000, // 2 minutes (in milliseconds)
  },
  
  // Set up proper limits through server components config
  serverComponentsExternalPackages: [],
  
  // Configure response size limits
  webpack: (config) => {
    // Increase the buffer limit for the server
    config.performance = {
      ...config.performance,
      maxEntrypointSize: 10 * 1024 * 1024, // 10MB
      maxAssetSize: 10 * 1024 * 1024, // 10MB
    };
    return config;
  },
}

module.exports = nextConfig 
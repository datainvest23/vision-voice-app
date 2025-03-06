/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add any specific config options here if needed
  api: {
    // Increase the bodyParser limit and timeout
    bodyParser: {
      sizeLimit: '10mb',
    },
    // Configure response timeout
    responseLimit: {
      // Increase to 2 minutes (120 seconds)
      duration: 120,
    },
  },
  // Increase the serverRuntimeConfig timeout
  serverRuntimeConfig: {
    // Timeout in milliseconds
    apiTimeout: 120000, // 2 minutes
  },
}

module.exports = nextConfig 
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['res.cloudinary.com'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure Tesseract.js works in server-side environment
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        // Don't disable path for server-side - we need it for worker path resolution
      };
    }
    return config;
  },
  experimental: {
    // Externalize tesseract.js to avoid webpack bundling issues with worker paths
    // This allows tesseract.js to use real file system paths instead of webpack-internal paths
    serverComponentsExternalPackages: ['tesseract.js'],
    // Ensure Tesseract.js core/worker/WASM files are bundled for serverless functions
    outputFileTracingIncludes: {
      '/api/upload-trade': [
        './node_modules/tesseract.js-core/**/*',
        './node_modules/tesseract.js/dist/worker.min.js',
        './node_modules/tesseract.js/dist/worker.min.js.map',
        './node_modules/tesseract.js/src/worker-script/**/*',
      ],
    },
  },
}

module.exports = nextConfig


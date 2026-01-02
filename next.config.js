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
        path: false,
      };
    }
    return config;
  },
  experimental: {
    // Ensure Tesseract.js core/worker/WASM files are bundled for serverless functions
    outputFileTracingIncludes: {
      '/api/upload-trade': [
        './node_modules/tesseract.js-core/**/*',
        './node_modules/tesseract.js/dist/worker.min.js',
        './node_modules/tesseract.js/dist/worker.min.js.map',
      ],
    },
  },
}

module.exports = nextConfig


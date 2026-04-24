/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  webpack: (config) => {
    config.externals = config.externals || []
    return config
  },
}

export default nextConfig

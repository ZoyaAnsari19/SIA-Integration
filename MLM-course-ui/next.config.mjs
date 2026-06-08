/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['truelink.azurecr.io', 'mlm-cdn.b-cdn.net'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mlm-cdn.b-cdn.net',
        pathname: '/course_thumbnails/**',
      },
    ],
  },
}

export default nextConfig

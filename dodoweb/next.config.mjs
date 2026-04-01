/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '',
  },
};

export default nextConfig;

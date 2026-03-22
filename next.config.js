/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Reduce el JS de iconos: importa solo los iconos usados por archivo
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig

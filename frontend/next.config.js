/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  assetPrefix: undefined, // 使用相对路径
  reactStrictMode: false, // 禁用严格模式避免双重渲染
  
  // 性能优化配置
  compress: true,
  poweredByHeader: false,
  
  // 图片优化
  images: {
    unoptimized: true, // 静态导出需要禁用图片优化
  },
  
  // 生产环境优化
  swcMinify: true, // 使用 SWC 压缩（更快）
  
  // 开发时把 /api 代理到 Express 后端（仅在开发环境有效）
  async rewrites() {
    return process.env.NODE_ENV === 'development' ? [
      { source: '/api/:path*', destination: 'http://localhost:8311/api/:path*' },
    ] : [];
  },
  
  webpack: (config, { isServer, dev }) => {
    config.resolve.fallback = { fs: false, path: false, net: false, tls: false };
    
    // 生产环境优化
    if (!dev && !isServer) {
      // 代码分割优化
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // 将 React 相关库单独打包
            react: {
              name: 'react',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            // 将 Next.js 相关库单独打包
            nextjs: {
              name: 'nextjs',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](next)[\\/]/,
              priority: 20,
            },
            // 将 Chart.js 相关库单独打包
            charts: {
              name: 'charts',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
              priority: 15,
            },
            // 其他第三方库
            commons: {
              name: 'commons',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;

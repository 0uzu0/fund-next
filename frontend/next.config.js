/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  assetPrefix: '',
  reactStrictMode: true,

  // 性能优化配置
  compress: true,
  poweredByHeader: false,

  // 图片优化
  images: {
    unoptimized: true, // 静态导出需要禁用图片优化
  },

  // 实验性功能：优化编译
  // 注意：optimizeCss 需要安装 critters 包，且与静态导出不兼容，已禁用
  // experimental: {
  //   optimizeCss: true, // 优化 CSS
  // },

  // 生产环境优化
  swcMinify: true, // 使用 SWC 压缩（更快）

  // 注意：静态导出(output: 'export')时 rewrites 不生效
  // 开发时使用独立后端，生产环境前后端一体(Express托管静态文件)，都使用同源API
  // 如需开发时代理，请使用环境变量控制
  
  webpack: (config, { isServer, dev }) => {
    config.resolve.fallback = { fs: false, path: false, net: false, tls: false };
    
    // 设置公共路径，确保静态资源正确加载
    if (!isServer) {
      config.output.publicPath = '/_next/';
    }
    
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

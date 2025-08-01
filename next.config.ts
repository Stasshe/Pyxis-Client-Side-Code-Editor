/** @type {import('next').NextConfig} */


// 環境変数から本番ビルドモードかどうかを判断
const isProductionBuild = process.env.BUILD_MODE === 'production';
console.log(`isProductionBuild: ${isProductionBuild}`);

// package.jsonからバージョン取得
const pkg = require('./package.json');

// 共通設定
const commonConfig = {
  reactStrictMode: false,
  staticPageGenerationTimeout: 300,
  images: {
    unoptimized: true, // 静的エクスポートでは必須
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: require.resolve('path-browserify'),
        vm: require.resolve('vm-browserify'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        util: require.resolve('util'),
        stream: require.resolve('stream-browserify'),
        crypto: require.resolve('crypto-browserify'),
        os: require.resolve('os-browserify'),
      };
      config.plugins = [
        ...config.plugins,
        new (require('webpack')).ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
        // バージョンをDefinePluginで注入
        new (require('webpack')).DefinePlugin({
          'process.env.PYXIS_VERSION': JSON.stringify(pkg.version),
        }),
      ];
      config.output.globalObject = 'globalThis';
    }
    return config;
  },
};

// 本番ビルド用設定
const productionConfig = isProductionBuild
  ? {
      output: 'export',
      trailingSlash: true,
      eslint: {
        ignoreDuringBuilds: true,
      },
      typescript: {
        ignoreBuildErrors: true,
      },
    }
  : {};


const nextConfig = {
  ...commonConfig,
  ...productionConfig,
};

console.log(`Building in ${isProductionBuild ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

module.exports = nextConfig;
/** @type {import('next').NextConfig} */
// 【本地排查临时配置】限制并发降低内存峰值，不提交
const nextConfig = {
  reactStrictMode: true,
  experimental: { workerThreads: false, cpus: 1 },
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;

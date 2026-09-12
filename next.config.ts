import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// 本地 `next dev` / `opennextjs-cloudflare dev` 时注入 Cloudflare 绑定（D1 等），
// 让 getCloudflareContext() 在开发环境可用。
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // OpenNext Cloudflare 构建所需
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // 承接自 vercel.json 的安全响应头
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https: http:",
          },
        ],
      },
    ];
  },
  // RFC1918 LAN ranges + localhost for `next dev` HMR over Wi-Fi.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ],
};

export default nextConfig;

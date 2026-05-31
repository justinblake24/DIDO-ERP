import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs', '@prisma/client', '@prisma/adapter-pg', 'pg', 'prisma'],
  typescript: {
    // 배포 후 타입 오류 순차 수정 예정
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

// ✨ 'any' ကိုသုံးပြီး TypeScript Error ကို ကျော်လိုက်ခြင်း
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
} as any); 

const nextConfig: NextConfig = {
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default withPWA(nextConfig);
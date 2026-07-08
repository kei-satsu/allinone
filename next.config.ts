const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public", // Service Worker ဖိုင်တွေ ထွက်မယ့်နေရာ
  disable: process.env.NODE_ENV === "development", // Develop လုပ်နေတုန်း PWA Caching ခေတ္တပိတ်ထားရန်
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // အစ်ကို့ရဲ့ လက်ရှိ Config များ (ဥပမာ - images, ရောဂါရှာဖွေရေးကုဒ်များ)

  experimental: {
    workerThreads: false, // Worker တွေကို ခွဲမခိုင်းဘဲ စိတ်ချရအောင် တစ်ခုချင်းပဲ သွားခိုင်းခြင်း
    cpus: 1,
},
};
module.exports = withPWA(nextConfig);
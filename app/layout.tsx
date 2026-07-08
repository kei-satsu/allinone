import type { Metadata, Viewport } from "next" // ✨ PWA အတွက် လိုအပ်သော Type များ တိုးလိုက်ခြင်း
import "./globals.css"
import AppLayout from "@/components/AppLayout" 

// 👑 PWA App ၏ ပင်မ Background/Theme အရောင် သတ်မှတ်ခြင်း
export const viewport: Viewport = {
  themeColor: "#ea580c", // အစ်ကို့ App ရဲ့ လိုဂို သို့မဟုတ် ပင်မလိမ္မော်ရောင်
}

// 👑 PWA Manifest နှင့် iOS App စနစ် ချိတ်ဆက်ခြင်း
export const metadata: Metadata = {
  title: "All In One Express",
  description: "Logistics and Delivery Management System",
  manifest: "/manifest.json", // public/manifest.json ဖိုင်ကို လှမ်းဖတ်ခိုင်းခြင်း
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "All In One",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="w-full h-full m-0 p-0 overflow-hidden">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  )
}
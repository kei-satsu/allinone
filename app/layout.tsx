import "./globals.css"
import AppLayout from "@/components/AppLayout" // ဖိုင်သိမ်းထားသည့် လမ်းကြောင်းအတိုင်း ပြင်ပါ

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="w-full h-full m-0 p-0 overflow-hidden">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  )
}
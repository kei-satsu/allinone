"use client"
import { useEffect, useState } from 'react'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Sidebar ကို ပုံမှန်အားဖြင့် ပိတ်ထားဖို့ default ကို false ပေးထားပါတယ်
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [userBranch, setUserBranch] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    setUserBranch(storedBranch)
    
    if (!storedBranch && pathname !== '/login') {
      window.location.href = '/login'
    }
  }, [pathname])

  // Menu item တစ်ခုခုကို နှိပ်ပြီး စာမျက်နှာပြောင်းသွားရင် Sidebar ကို အလိုအလျောက် ပြန်ပိတ်ပေးဖို့ ဖြစ်ပါတယ်
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'New Entry', path: '/entry', icon: '📝' },
    { name: 'Order List', path: '/list', icon: '📋' },
    { name: 'Daily Report', path: '/report', icon: '📅' },
    { name: 'Riders', path: '/riders', icon: '🚴' },
  ]

  if (pathname === '/login') {
    return (
      <html lang="en">
        <body className="bg-[#070a12] text-slate-100 h-screen">{children}</body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body className="bg-[#070a12] text-slate-100 flex h-screen overflow-hidden font-sans relative antialiased">
        
        {/* Layout level shared background glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/[0.03] rounded-full blur-[160px] pointer-events-none z-0" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-orange-600/[0.03] rounded-full blur-[160px] pointer-events-none z-0" />

        {/* --- Backdrop Overlay --- */}
        {/* Sidebar ပွင့်လာရင် ကျန်တဲ့နေရာတွေကို မှောင်ပြီး ဝါးသွားစေကာ အပြင်ကိုနှိပ်ရင် Sidebar ပြန်ပိတ်သွားစေမှာပါ */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* --- Premium Glass Sidebar (Slide-out Drawer) --- */}
        <aside className={`fixed top-0 left-0 h-screen w-64 bg-[#0a0f1d]/90 backdrop-blur-2xl border-r border-white/5 text-slate-200 transition-transform duration-300 ease-in-out flex flex-col z-40 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/5">
            <span className="font-extrabold text-sm tracking-widest bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent uppercase">
              {userBranch || 'MAIN'} OFFICE
            </span>
          </div>

          <nav className="flex-1 mt-6 px-3 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <Link 
                  key={item.path} 
                  href={item.path} 
                  className={`flex items-center p-3 rounded-xl transition-all duration-200 relative group ${
                    isActive 
                      ? 'bg-gradient-to-r from-orange-500/15 to-transparent text-orange-400 border-l-4 border-orange-500' 
                      : 'hover:bg-white/[0.03] text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span className={`text-lg transition-transform duration-200 ${isActive ? 'scale-110 filter drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  <span className="font-semibold text-xs tracking-wide ml-3.5">
                    {item.name}
                  </span>
                </Link>
              )
            })}
          </nav>

          {/* Floating button နဲ့ မကွယ်စေဖို့ အောက်ခြေမှာ padding/margin လေး ချန်ပေးထားပါတယ် */}
          <div className="p-4 border-t border-white/5 text-[10px] text-slate-500 font-medium text-center tracking-wider mb-20">
            LOGISTICS PRO v1.0
          </div>
        </aside>

        {/* --- Floating Sidebar Toggle Button --- */}
        {/* အောက်ဘယ်ဘက်ထောင့်မှာ fixed ပုံစံနဲ့ float ဖြစ်နေမယ့် အဝိုင်းခလုတ်လေးပါ */}
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)} 
          className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 hover:scale-110 active:scale-95 transition-all text-lg group border border-white/10"
        >
          <span className="transition-transform duration-200 group-hover:rotate-12 text-white">
            {isSidebarOpen ? '✕' : '☰'}
          </span>
        </button>

        {/* --- Main Content Area --- */}
        {/* Top Navbar ဖြုတ်လိုက်တဲ့အတွက် မျက်နှာပြင်အမြင့်ကို h-screen အပြည့် ယူပေးထားပါတယ် */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10 w-full h-screen">
          <main className="flex-1 w-full h-full p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
        </div>

      </body>
    </html>
  )
}
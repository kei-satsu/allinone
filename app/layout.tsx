"use client"
import { useEffect, useState } from 'react'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [userBranch, setUserBranch] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    setUserBranch(storedBranch)
    
    if (!storedBranch && pathname !== '/login') {
      window.location.href = '/login'
    }
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

        {/* --- Premium Glass Sidebar --- */}
        <aside className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-white/[0.01] backdrop-blur-2xl border-r border-white/5 text-slate-200 transition-all duration-300 flex flex-col z-20`}>
          
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/5">
            {isSidebarOpen && (
              <span className="font-extrabold text-sm tracking-widest bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent uppercase pl-2">
                {userBranch || 'MAIN'} OFFICE
              </span>
            )}
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)} 
              className={`p-2 hover:bg-white/5 rounded-xl transition-all text-sm ${!isSidebarOpen && 'mx-auto'}`}
            >
              {isSidebarOpen ? '🔹' : '🔸'}
            </button>
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
                  
                  {isSidebarOpen ? (
                    <span className="font-semibold text-xs tracking-wide ml-3.5">
                      {item.name}
                    </span>
                  ) : (
                    <div className="absolute left-16 bg-slate-900 border border-white/10 text-slate-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-2 transition-all z-30">
                      {item.name}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-white/5 text-[10px] text-slate-500 font-medium text-center tracking-wider">
            {isSidebarOpen ? 'LOGISTICS PRO v1.0' : 'v1.0'}
          </div>
        </aside>

        {/* --- Main Content Area --- */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          
          {/* --- Premium Glass Top Navbar --- */}
          <header className="h-16 bg-[#070a12]/10 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 md:px-8">
            <div className="flex items-center gap-4">
               <h2 className="text-slate-200 font-extrabold uppercase tracking-widest text-xs bg-white/[0.04] border border-white/5 px-3 py-1.5 rounded-lg shadow-inner">
                 {menuItems.find(m => m.path === pathname)?.name || 'System'}
               </h2>
            </div>
            
            <div className="flex items-center gap-3 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 py-1.5 pl-3 pr-1.5 rounded-full transition-all cursor-pointer">
               <div className="hidden sm:block text-right pr-1">
                 <p className="text-[11px] font-bold text-slate-200 tracking-wide">Admin User</p>
                 <div className="flex items-center justify-end gap-1.5 mt-0.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider">Online</span>
                 </div>
               </div>
               <div className="w-8 h-8 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-full flex items-center justify-center text-white text-xs font-black">
                 A
               </div>
            </div>
          </header>

          {/* --- 💡 FIXED: အကျယ်ကို Screen အပြည့်ယူစေပြီး layout အမြင့်ကို ထိန်းညှိပေးလိုက်ပါတယ် --- */}
          <main className="flex-1 w-full h-[calc(100vh-64px)] p-4 md:p-6 overflow-hidden">
            {children}
          </main>

        </div>
      </body>
    </html>
  )
}
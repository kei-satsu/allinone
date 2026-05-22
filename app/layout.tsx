"use client"
import { useEffect, useState } from 'react'
import './globals.css'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [userBranch, setUserBranch] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  const isLoginPage = pathname === '/login'

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    setUserBranch(storedBranch)
    
    if (!storedBranch && pathname !== '/login') {
      router.push('/login')
    }
  }, [pathname, router])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('user_branch')
    localStorage.removeItem('isLoggedIn')
    setUserBranch(null)
    router.push('/login')
    router.refresh()
  }

  const menuItems = [
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V16zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V16z" />
        </svg>
      )
    },
    { 
      name: 'New Entry', 
      path: '/entry', 
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    { 
      name: 'Order List', 
      path: '/list', 
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    { 
      name: 'Daily Report', 
      path: '/report', 
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      name: 'Riders', 
      path: '/riders', 
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
  ]

  return (
    <html 
      lang="en" 
      className={`w-full h-full m-0 p-0 ${isLoginPage ? 'bg-slate-900' : 'bg-slate-50'}`}
      style={{ colorScheme: isLoginPage ? 'dark' : 'light' }}
    >
      <body className={`w-full h-full m-0 p-0 font-sans antialiased overflow-hidden relative ${
        isLoginPage ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800 flex flex-row'
      }`}>
        
        {isLoginPage ? (
          /* --- Login Screen View --- */
          <div className="w-full h-full overflow-y-auto">
            {children}
          </div>
        ) : (
          /* --- Authenticated Dashboard Layout View --- */
          <>
            {/* Subtle Decorative Glows */}
            <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-orange-500/[0.02] rounded-full blur-[120px] pointer-events-none z-0" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-500/[0.02] rounded-full blur-[120px] pointer-events-none z-0" />

            {/* Backdrop Overlay */}
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-30 transition-opacity duration-300"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Premium White Glass Sidebar */}
            <aside className={`fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/80 text-slate-700 transition-transform duration-300 ease-in-out flex flex-col z-40 shadow-xl shadow-slate-200/40 ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
              {/* Header Identity */}
              <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="font-black text-[11px] tracking-widest bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent uppercase font-mono">
                    {userBranch || 'MAIN'} BRANCH
                  </span>
                </div>
              </div>

              {/* Navigation Links Grid */}
              <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const isActive = pathname === item.path
                  return (
                    <Link 
                      key={item.path} 
                      href={item.path} 
                      className={`flex items-center p-2.5 rounded-xl transition-all duration-150 group ${
                        isActive 
                          ? 'bg-orange-50/80 text-orange-600 font-bold border-l-4 border-orange-500 shadow-xs' 
                          : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <span className={`transition-transform duration-150 ${isActive ? 'scale-105 text-orange-500' : 'text-slate-400 group-hover:text-slate-700 group-hover:scale-105'}`}>
                        {item.icon}
                      </span>
                      <span className="font-bold text-xs tracking-wide ml-3">
                        {item.name}
                      </span>
                    </Link>
                  )
                })}
              </nav>

              {/* Account details & Logout */}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 backdrop-blur-xs">
                <div className="flex items-center gap-3 p-1.5 mb-2 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white font-black text-xs shadow-sm shadow-slate-900/10">
                    {userBranch?.substring(0, 2) || 'OP'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-slate-800 tracking-wide truncate">Logged In Account</span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase truncate">
                      {userBranch === 'MDY' ? 'Mandalay' : userBranch === 'YGN' ? 'Yangon' : userBranch || 'Main'} Branch
                    </span>
                  </div>
                </div>

                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100/80 text-red-600 font-black text-[11px] py-2.5 px-3 rounded-xl transition-all duration-150 active:scale-[0.98] border border-red-200/40 uppercase tracking-wider"
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out Engine
                </button>
              </div>

              {/* System Version Footnote */}
              <div className="p-4 border-t border-slate-100 text-[9px] text-slate-400 font-bold font-mono text-center tracking-widest mb-20 uppercase">
                Logistics Engine v1.0
              </div>
            </aside>

            {/* Floating Sidebar Toggle Button (FAB) */}
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)} 
              className="fixed bottom-6 left-6 z-50 w-11 h-11 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all group border border-orange-400/20"
            >
              <span className="transition-transform duration-200 text-white font-medium">
                {isSidebarOpen ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-4 h-4 group-hover:rotate-6 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </span>
            </button>

            {/* --- Main Content Workspace --- */}
            <div className="flex-1 flex flex-col overflow-hidden relative z-10 w-full h-full bg-slate-50">
              <main className="flex-1 w-full h-full p-4 md:p-6 overflow-y-auto">
                {children}
              </main>
            </div>
          </>
        )}

      </body>
    </html>
  )
}
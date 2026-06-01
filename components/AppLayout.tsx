"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase" // ✨ Supabase Client

// ──────────────────────────────────────
// Types & Constants
// ──────────────────────────────────────
interface MenuItem { name: string; path: string; icon: React.ReactNode }
interface BranchInfo { code: string; displayName: string; color: string }

const BRANCH_MAP: Record<string, BranchInfo> = {
  MDY: { code: "MDY", displayName: "Mandalay Branch", color: "from-orange-500 to-amber-500" },
  YGN: { code: "YGN", displayName: "Yangon Branch", color: "from-sky-500 to-blue-600" },
  MAIN: { code: "MAIN", displayName: "Main Office", color: "from-purple-600 to-indigo-700" },
}

const DEFAULT_BRANCH: BranchInfo = {
  code: "ALL", displayName: "All In One", color: "from-gray-600 to-gray-800",
}

// ✂️ Parcel Intake ကို Sidebar ကနေ ဖြုတ်လိုက်ပါပြီ
const MENU_ITEMS: MenuItem[] = [
  {
    name: "Dashboard",
    path: "/",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2-2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V16zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V16z" />
      </svg>
    ),
  },
  {
    name: "New Entry",
    path: "/entry",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    name: "Order List",
    path: "/list",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    name: "Daily Report",
    path: "/report",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Pending Orders",
    path: "/pending",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: "Riders",
    path: "/riders",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    name: "Recently Deleted",
    path: "/trash",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
        />
      </svg>
    ),
  },
]

// ──────────────────────────────────────
// Custom Hook: Auth & Branch
// ──────────────────────────────────────
function useAuth(redirectIfMissing: boolean) {
  const [userBranch, setUserBranch] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("user_branch")
    }
    return null
  })
  const [isReady, setIsReady] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const hasRedirected = useRef(false)

  const getBranchFromEmail = (email?: string) => {
    if (!email) return null
    const prefix = email.split("@")[0].toUpperCase()
    return ["MDY", "YGN", "MAIN"].includes(prefix) ? prefix : "MAIN"
  }

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const currentBranch = getBranchFromEmail(session.user.email)
          setUserBranch(currentBranch)
          if (currentBranch) localStorage.setItem("user_branch", currentBranch)
        } else {
          setUserBranch(null)
          localStorage.removeItem("user_branch")
        }
      } catch (error) {
        console.error("Supabase session read error:", error)
      } finally {
        setIsReady(true)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const currentBranch = getBranchFromEmail(session.user.email)
        setUserBranch(currentBranch)
        if (currentBranch) localStorage.setItem("user_branch", currentBranch)
      } else {
        setUserBranch(null)
        localStorage.removeItem("user_branch")
        if (redirectIfMissing && pathname !== "/login") {
          router.replace("/login")
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname, redirectIfMissing])

  useEffect(() => {
    if (!isReady || pathname === "/login" || hasRedirected.current) return
    if (redirectIfMissing && !userBranch) {
      hasRedirected.current = true
      router.replace("/login")
    }
  }, [isReady, userBranch, pathname, router, redirectIfMissing])

  const branchInfo: BranchInfo = useMemo(() => {
    if (!userBranch) return DEFAULT_BRANCH
    return BRANCH_MAP[userBranch] ?? { ...DEFAULT_BRANCH, code: userBranch, displayName: userBranch }
  }, [userBranch])

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem("user_branch")
    } catch (error) {
      console.error("Sign out failed:", error)
    }
    setUserBranch(null)
    hasRedirected.current = false
    router.replace("/login")
  }, [router])

  return { userBranch, branchInfo, isReady, isAuthenticated: !!userBranch, logout }
}

// ──────────────────────────────────────
// Sub-component: SidebarMenuItem
// ──────────────────────────────────────
function SidebarMenuItem({ item, isActive, collapsed, onClick }: { item: MenuItem; isActive: boolean; collapsed: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.path}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={`flex items-center rounded-xl transition-all duration-200 group relative ${collapsed ? "justify-center p-3" : "px-3 py-2.5"} ${
        isActive ? "bg-orange-50 text-orange-600 font-semibold shadow-[inset_0_0_0_1px_rgba(249,115,22,0.15)]" : "hover:bg-gray-100 text-gray-500 hover:text-gray-800"
      }`}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-r-full" />}
      <span className={`flex-shrink-0 transition-colors ${isActive ? "text-orange-500" : "text-gray-400 group-hover:text-gray-600"}`}>{item.icon}</span>
      <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0 overflow-hidden ml-0" : "w-auto opacity-100"}`}>{item.name}</span>
    </Link>
  )
}

// ──────────────────────────────────────
// Main Layout Component
// ──────────────────────────────────────
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [sidebarLocked, setSidebarLocked] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const isIntakePage = pathname === "/intake" 
  const { branchInfo, isAuthenticated, isReady, logout } = useAuth(!isLoginPage)
  const sidebarRef = useRef<HTMLElement>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // 📊 Browser Tab Title အလိုအလျောက် သတ်မှတ်ပေးမည့်နေရာ
  useEffect(() => {
    if (branchInfo?.code) {
      // အကယ်၍ Branch ရှိနေရင် (ဥပမာ - MDY) Title မှာပါ တစ်ပါတည်း ပြပေးပါမည်
      const branchSuffix = branchInfo.code !== "ALL" ? ` (${branchInfo.code})` : ""
      document.title = `ALL IN ONE${branchSuffix} | Express Delivery`
    } else {
      document.title = "ALL IN ONE | Express Delivery"
    }
  }, [branchInfo?.code])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const handleMouseEnter = () => {
    if (!isMobile && !sidebarLocked) setSidebarExpanded(true)
  }
  const handleMouseLeave = () => {
    if (!isMobile && !sidebarLocked) setSidebarExpanded(false)
  }

  useEffect(() => { setMobileSidebarOpen(false) }, [pathname])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        if (isMobile) {
          if (!isIntakePage) setMobileSidebarOpen(prev => !prev) 
        } else {
          setSidebarLocked(prev => !prev)
          if (!sidebarLocked) setSidebarExpanded(true)
        }
      }
      if (e.key === "Escape") {
        if (isMobile) setMobileSidebarOpen(false)
        else {
          setSidebarLocked(false)
          setSidebarExpanded(false)
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isMobile, sidebarLocked, isIntakePage])

  if (!mounted || !isReady) return <div className="w-full h-screen bg-[#f3f3f3]" />
  if (isLoginPage) return <div className="w-full min-h-screen">{children}</div>
  if (!isAuthenticated) return <div className="w-full min-h-screen bg-[#f3f3f3]" />

  const collapsed = !sidebarExpanded && !sidebarLocked

  return (
    <div className="w-full h-screen flex overflow-hidden bg-[#f3f3f3] font-sans antialiased">
      {/* Mobile overlay backdrop */}
      {isMobile && (
        <div
          className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`h-full flex flex-col bg-white/85 backdrop-blur-xl border-r border-gray-200/70 shadow-xl shadow-black/[0.03] z-50 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isMobile
            ? `fixed top-0 left-0 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} w-64`
            : `relative ${collapsed ? "w-[68px]" : "w-60"}`
        }`}
      >
        {/* Sidebar header */}
        <div className={`flex flex-col border-b border-gray-100 flex-shrink-0 transition-all duration-300 ${
          collapsed && !isMobile ? "h-14 justify-center items-center px-2" : "min-h-[80px] justify-center px-4 py-3"
        }`}>
          
          {/* Top Row: Logo, Brand Text and Action Buttons */}
          <div className="flex items-center w-full justify-between">
            
            {/* 🖼️ Logo & Brand Name Section */}
            <div className="flex items-center gap-2">
              <img
                src="/logo.png" 
                alt="All In One Logo"
                className="w-7 h-7 object-contain rounded"
              />
              <span className={`font-bold text-base tracking-tight text-orange-600 uppercase whitespace-nowrap transition-all duration-200 ${
                collapsed && !isMobile ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
              }`}>
                ALL IN ONE
              </span>
            </div>

            {/* Pin / Close Button Section */}
            <div className="flex items-center gap-1">
              {!isMobile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSidebarLocked(!sidebarLocked)
                    if (!sidebarLocked) setSidebarExpanded(true)
                    else setSidebarExpanded(false)
                  }}
                  title={sidebarLocked ? "Unpin sidebar" : "Pin sidebar"}
                  className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 ${
                    sidebarLocked ? "bg-orange-100 text-orange-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  } ${collapsed ? "hidden" : ""}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              )}
              {isMobile && (
                <button onClick={() => setMobileSidebarOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* 📍 Bottom Row: Branch Info (MDY, YGN, etc.) - Only shows when expanded */}
          <div className={`flex items-center gap-2 mt-2 transition-all duration-200 ${
            collapsed && !isMobile ? "hidden" : "flex"
          }`}>
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
            <span className="font-bold text-xs tracking-wider text-gray-500 uppercase whitespace-nowrap">
              {branchInfo.code}
            </span>
          </div>

        </div>

        {/* Navigation */}
        <nav className={`flex-1 mt-4 space-y-1 overflow-y-auto ${collapsed && !isMobile ? "px-2" : "px-3"}`}>
          {MENU_ITEMS.map(item => (
            <SidebarMenuItem
              key={item.path}
              item={item}
              isActive={pathname === item.path}
              collapsed={collapsed && !isMobile}
              onClick={() => { if (isMobile) setMobileSidebarOpen(false) }}
            />
          ))}
        </nav>

        {/* User & Sign Out */}
        <div className={`border-t border-gray-100 flex-shrink-0 ${collapsed && !isMobile ? "px-2 py-3" : "px-4 py-3"}`}>
          <div className={`flex items-center ${collapsed && !isMobile ? "justify-center" : "gap-3"}`}>
            <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${branchInfo.color} flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0`}>
              {branchInfo.code.substring(0, 2)}
            </div>
            <div className={`flex flex-col min-w-0 transition-all duration-200 ${collapsed && !isMobile ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"}`}>
              <span className="text-xs font-semibold text-gray-800 truncate">Staff Active</span>
              <span className="text-[10px] text-gray-500 font-mono uppercase truncate">{branchInfo.displayName}</span>
            </div>
          </div>
          <button onClick={logout} className={`mt-2 w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-xs py-2 rounded-lg transition-colors border border-red-100 ${collapsed && !isMobile ? "p-2 aspect-square" : "px-3"}`}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className={`whitespace-nowrap transition-all duration-200 ${collapsed && !isMobile ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"}`}>Sign Out</span>
          </button>
        </div>
        <div className={`pb-4 text-center text-[10px] text-gray-400 font-medium uppercase tracking-wider transition-all duration-200 ${collapsed && !isMobile ? "opacity-0" : "opacity-100"}`}>v1.0</div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Floating Button (bottom-left) */}
        {isMobile && !isIntakePage && (
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-white/90 backdrop-blur-md border border-gray-200 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 text-gray-600 hover:text-orange-600"
            title="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Floating Action Button (bottom-right) */}
        {!isIntakePage && (
          <Link
            href="/intake"
            className="fixed bottom-6 right-6 z-50 flex items-center justify-center gap-2 bg-gradient-to-br from-orange-500 to-amber-500 text-white w-12 h-12 md:w-auto md:h-12 md:px-5 rounded-full shadow-lg hover:shadow-orange-500/30 active:scale-95 transition-all duration-200 group font-semibold tracking-wide"
            title="Go to Parcel Intake"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden md:inline text-sm">Intake</span>
          </Link>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#f3f3f3]">
          {children}
        </main>
      </div>
    </div>
  )
}
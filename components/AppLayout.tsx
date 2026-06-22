"use client"

import { createContext, useEffect, useState, useCallback, useMemo, useRef, useContext, type Dispatch, type SetStateAction } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase" // ✨ Supabase Client
import GlobalPrintVoucher from "@/components/GlobalPrintVoucher"

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
function SidebarMenuItem({ item, isActive, collapsed, isMobile, onClick }: { item: MenuItem; isActive: boolean; collapsed: boolean; isMobile: boolean; onClick?: () => void }) {
  return (
    <Link
      href={item.path}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={`flex items-center rounded-3xl transition-all duration-200 group relative ${collapsed ? "justify-center p-3" : isMobile ? "px-4 py-3" : "px-3 py-2.5"} ${
        isActive ? "bg-orange-50 text-orange-600 font-semibold shadow-[inset_0_0_0_1px_rgba(249,115,22,0.15)]" : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
      }`}
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-r-full" />}
      <span className={`flex-shrink-0 transition-colors ${isActive ? "text-orange-500" : "text-slate-500 group-hover:text-slate-700"}`}>{item.icon}</span>
      <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0 overflow-hidden ml-0" : "w-auto opacity-100"}`}>{item.name}</span>
    </Link>
  )
}

// ──────────────────────────────────────
// Mobile Dock Visibility Context
// ──────────────────────────────────────
interface MobileDockContextValue {
  hideMobileDock: boolean
  setHideMobileDock: Dispatch<SetStateAction<boolean>>
}

const MobileDockContext = createContext<MobileDockContextValue | undefined>(undefined)

export function useMobileDockVisibility() {
  const context = useContext(MobileDockContext)
  if (!context) {
    throw new Error("useMobileDockVisibility must be used within AppLayout")
  }
  return context
}

// ──────────────────────────────────────
// Main Layout Component
// ──────────────────────────────────────
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [sidebarLocked, setSidebarLocked] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [hideMobileDock, setHideMobileDock] = useState(false)
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

  useEffect(() => {
    if (pathname !== "/intake") setHideMobileDock(false)
  }, [pathname])

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
          className={`fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-40 transition-opacity duration-300 ${mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── 📱💻 iOS Premium Sidebar / Mobile Bottom Sheet ── */}
<aside
  ref={sidebarRef}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  className={`flex flex-col bg-white/75 backdrop-blur-2xl border border-slate-200/40 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.08)] z-50 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
    isMobile
      ? `fixed inset-x-0 bottom-0 ${mobileSidebarOpen ? "translate-y-0" : "translate-y-full"} w-full max-h-[82vh] rounded-t-[32px] border-t border-x border-slate-200/60 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.12)] overflow-hidden`
      : `relative ${collapsed ? "w-[68px]" : "w-64"}`
  }`}
>
  {/* 📱 iOS Mobile Sheet Drag Handle */}
  {isMobile && (
    <div className="flex justify-center pt-3 pb-1 shrink-0">
      <div className="h-1.2 w-12 rounded-full bg-slate-300/60" />
    </div>
  )}

  {/* 🏢 Header Section */}
  <div className={`flex flex-col border-b border-slate-100/70 flex-shrink-0 transition-all duration-300 ${
    collapsed && !isMobile ? "h-16 justify-center items-center px-2" : "min-h-[84px] justify-center px-5 py-4"
  }`}>
    
    {/* Top Row: Logo, Brand Text and Action Buttons */}
    <div className="flex items-center w-full justify-between">
      
      {/* 🖼️ Logo & Brand Name */}
      <div className="flex items-center gap-2.5">
        <img
          src="/logo.png" 
          alt="All In One Logo"
          className="w-7.5 h-7.5 object-contain rounded-xl shadow-sm"
        />
        <div className={`flex flex-col transition-all duration-200 ${
          collapsed && !isMobile ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
        }`}>
          <span className="font-extrabold text-[15px] tracking-tight text-slate-800 uppercase whitespace-nowrap">
            ALL IN ONE
          </span>
          {/* 📍 Branch Info Status Badge inside Title */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="font-mono text-[9px] font-bold tracking-wider text-slate-400 uppercase">
              {branchInfo.code} NODE
            </span>
          </div>
        </div>
      </div>

      {/* iOS Round Action Buttons (Pin / Close) */}
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
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              sidebarLocked 
                ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20" 
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            } ${collapsed ? "hidden" : ""}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        )}
        {isMobile && (
          <button 
            onClick={() => setMobileSidebarOpen(false)} 
            className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  </div>

  {/* 🧭 iOS Navigation List */}
  <nav className={`flex-1 mt-3 overflow-y-auto custom-scrollbar ${
    isMobile 
      ? "space-y-1.5 px-4 pb-6" 
      : collapsed 
        ? "space-y-1 px-2" 
        : "space-y-1 px-3"
  }`}>
    {MENU_ITEMS.map(item => (
      <SidebarMenuItem
        key={item.path}
        item={item}
        isActive={pathname === item.path}
        collapsed={collapsed && !isMobile}
        isMobile={isMobile}
        onClick={() => { if (isMobile) setMobileSidebarOpen(false) }}
      />
    ))}
  </nav>

  {/* 👤 User Card & Sign Out Footer */}
  <div className={`border-t border-slate-100 flex-shrink-0 bg-slate-50/50 ${
    collapsed && !isMobile ? "p-2" : "px-4 py-3.5"
  }`}>
    {/* Profile Card Block */}
    <div className={`flex items-center bg-white/60 border border-slate-100 p-2 rounded-2xl shadow-sm ${
      collapsed && !isMobile ? "justify-center border-none bg-transparent shadow-none p-0" : "gap-3"
    }`}>
      <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${branchInfo.color} flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0`}>
        {branchInfo.code.substring(0, 2)}
      </div>
      <div className={`flex flex-col min-w-0 transition-all duration-200 ${
        collapsed && !isMobile ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
      }`}>
        <span className="text-xs font-bold text-slate-800 truncate">Staff Active</span>
        <span className="text-[10px] text-slate-400 font-medium uppercase truncate tracking-tight">{branchInfo.displayName}</span>
      </div>
    </div>
    
    {/* iOS Style Destructive Logout Button */}
    <button 
      onClick={logout} 
      className={`mt-2.5 w-full flex items-center justify-center gap-2 bg-red-50/60 hover:bg-red-50 text-red-600 font-semibold text-xs py-2.5 rounded-xl transition-all active:scale-[0.98] border border-red-100/50 ${
        collapsed && !isMobile ? "p-2 aspect-square mt-3" : "px-3"
      }`}
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span className={`transition-all duration-200 ${
        collapsed && !isMobile ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
      }`}>
        Sign Out
      </span>
    </button>
  </div>

  {/* System Version Tag */}
  <div className={`pb-4 pt-1 text-center text-[9px] text-slate-400 font-bold tracking-widest transition-all duration-200 ${
    collapsed && !isMobile ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
  }`}>
    VERSION 1.0
  </div>
</aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <MobileDockContext.Provider value={{ hideMobileDock, setHideMobileDock }}>
          {/* Page content */}
          <main className={`flex-1 overflow-y-auto bg-[#f3f3f3] ${isIntakePage ? 'pb-0' : 'pb-0'} md:pb-0`}>
            {children}
          </main>

          {/* ── Mobile Dock ── */}
{/* ── 📱 iOS Mobile Dock with Tuned Ambient Bottom Fade ── */}
{isMobile && !isLoginPage && !hideMobileDock && !mobileSidebarOpen && !isIntakePage && (
  <>
    {/* 🌫️ iOS Bottom Gradient Sheet Mask (အောက်ဆုံးအနားသတ်ကို Solid မဟုတ်ဘဲ ၈၀% Opacity ဖြင့် ဝါးပေးထားသော Mask) */}
    <div className="fixed inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f4f6f9]/80 via-[#f4f6f9]/40 to-transparent pointer-events-none z-40 md:hidden backdrop-blur-[1px]" />

    {/* 🚀 Floating Premium Dock Container (Moved down to bottom-4) */}
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:hidden animate-in fade-in slide-in-from-bottom-5 duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]">
      <div className="w-full max-w-sm flex items-center justify-between bg-white/75 backdrop-blur-2xl border border-slate-200/40 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12)] rounded-[24px] px-2.5 py-2 relative">
        
        {/* 🏠 Home Button */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1 rounded-xl transition-all active:scale-95 duration-200 ${
            pathname === "/" 
              ? "text-orange-500 font-bold" 
              : "text-slate-400 hover:text-slate-600"
          }`}
          title="Home"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname === "/" ? 2.4 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <span className="text-[9px] font-extrabold tracking-tight">Home</span>
        </Link>

        {/* 📦 Orders Button */}
        <Link
          href="/list"
          className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1 rounded-xl transition-all active:scale-95 duration-200 ${
            pathname === "/list" 
              ? "text-orange-500 font-bold" 
              : "text-slate-400 hover:text-slate-600"
          }`}
          title="Orders"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname === "/list" ? 2.4 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-[9px] font-extrabold tracking-tight">Orders</span>
        </Link>

        {/* ➕ Central Intake Circle Button */}
        <Link
          href="/intake"
          className="relative -mt-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-amber-500 text-white w-12 h-12 rounded-full shadow-[0_8px_20px_rgba(249,115,22,0.35)] active:scale-90 transition-all duration-200 border-[3px] border-white shrink-0 mx-1.5 group"
          title="Intake"
        >
          <svg className="w-5.5 h-5.5 transition-transform group-hover:rotate-90 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </Link>

        {/* 📝 New Entry Button */}
        <Link
          href="/entry"
          className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1 rounded-xl transition-all active:scale-95 duration-200 ${
            pathname === "/entry" 
              ? "text-orange-500 font-bold" 
              : "text-slate-400 hover:text-slate-600"
          }`}
          title="New Entry"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname === "/entry" ? 2.4 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className="text-[9px] font-extrabold tracking-tight whitespace-nowrap">New Entry</span>
        </Link>

        {/* 🍔 Menu Button */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center gap-1.5 flex-1 py-1 text-slate-400 hover:text-slate-600 transition-all active:scale-95 rounded-xl"
          title="Menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          <span className="text-[9px] font-extrabold tracking-tight">Menu</span>
        </button>

      </div>
    </div>
  </>
)}
        </MobileDockContext.Provider>

        {/* Floating Action Button (bottom-right for desktop) */}
        {!isIntakePage && (
          <Link
            href="/intake"
            className="hidden md:flex fixed bottom-6 right-6 z-50 items-center justify-center gap-2 bg-gradient-to-br from-orange-500 to-amber-500 text-white w-12 h-12 md:w-auto md:h-12 md:px-5 rounded-full shadow-lg hover:shadow-orange-500/30 active:scale-95 transition-all duration-200 group font-semibold tracking-wide"
            title="Go to Parcel Intake"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden md:inline text-sm">Intake</span>
          </Link>
        )}
      </div>
    </div>
  )
}
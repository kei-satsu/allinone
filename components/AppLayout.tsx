"use client"

import { createContext, useEffect, useState, useCallback, useMemo, useRef, useContext, type Dispatch, type SetStateAction } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import GlobalPrintVoucher from "@/components/GlobalPrintVoucher"

// ──────────────────────────────────────
// Types & Constants
// ──────────────────────────────────────
interface MenuItem {
  name: string
  path: string
  icon: React.ReactNode
  children?: MenuItem[]
  adminOnly?: boolean // Admin / Branch Admin များသာ မြင်ရမည့် Menu များအတွက်
}

interface BranchInfo {
  code: string
  displayName: string
  color: string
}

const BRANCH_MAP: Record<string, BranchInfo> = {
  MDY: { code: "MDY", displayName: "Mandalay Branch", color: "from-orange-500 to-amber-500" },
  YGN: { code: "YGN", displayName: "Yangon Branch", color: "from-sky-500 to-blue-600" },
  ADMIN: { code: "ADMIN", displayName: "ADMIN", color: "from-purple-600 to-indigo-700" },
}

const DEFAULT_BRANCH: BranchInfo = {
  code: "ALL", displayName: "All In One", color: "from-gray-600 to-gray-800",
}

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
    name: "Status Updater",
    path: "/bulk-update",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: "Transit",
    path: "/transit",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    children: [
      {
        name: "Transit In",
        path: "/transit/in",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )
      },
      {
        name: "Transit Out",
        path: "/transit/out",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        )
      },
      {
        name: "Pending In",
        path: "/transit/pd",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      },
      {
        name: "Transit Report",
        path: "/transit/transit-report",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        )
      }
    ]
  },
  {
    name: "Senders",
    path: "/senders",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-1.214 6.33a3.75 3.75 0 0 0-3.322 0c-1.017.43-1.464 1.577-1.13 2.617a14.451 14.451 0 0 0 5.582 0c.334-1.04-.113-2.187-1.13-2.618Z" />
      </svg>
    ),
  },
  {
    name: "Barcode Print",
    path: "/barcode-print",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5V4.5a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v3m-12 0h13.5A2.25 2.25 0 0121 9.75v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15.75v-6A2.25 2.25 0 015.25 7.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15.75h9v3.75a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-3.75z" />
        <path strokeLinecap="round" d="M9.5 17.25v1.5M12 17.25v1.5M14.5 17.25v1.5" />
      </svg>
    ),
  },
  {
    name: "User Management",
    path: "/admin/users",
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6 0 3.375 3.375 0 016 0zm6 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    name: "Recently Deleted",
    path: "/trash",
    adminOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
]

// ──────────────────────────────────────
// Custom Authentication & Role Hook
// ──────────────────────────────────────
function useAuth(redirectIfMissing: boolean) {
  const [userBranch, setUserBranch] = useState<string | null>(null)
  const [realBranch, setRealBranch] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const hasRedirected = useRef(false)

  const processUserSession = useCallback((session: any) => {
    if (session?.user) {
      const user = session.user
      const role = user.app_metadata?.role || "staff"
      const metadataBranch = user.app_metadata?.branch || user.user_metadata?.branch || "MDY"

      setUserRole(role)
      setRealBranch(metadataBranch)
      setUserEmail(user.email || null)

      // Admin ဖြစ်ခဲ့ရင် localStorage ထဲက ရွေးထားတဲ့ branch ကို ပြပေးမည်
      if (metadataBranch === "ADMIN" || role === "admin") {
        const stored = typeof window !== "undefined" ? localStorage.getItem("user_branch") : null
        if (stored && stored !== "ADMIN") {
          setUserBranch(stored)
        } else {
          setUserBranch("MDY")
          if (typeof window !== "undefined") localStorage.setItem("user_branch", "MDY")
        }
      } else {
        setUserBranch(metadataBranch)
        if (typeof window !== "undefined") localStorage.setItem("user_branch", metadataBranch)
      }
    } else {
      setUserBranch(null)
      setRealBranch(null)
      setUserRole(null)
      setUserEmail(null)
      if (typeof window !== "undefined") localStorage.removeItem("user_branch")
    }
  }, [])

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        processUserSession(session)
      } catch (error) {
        console.error("Supabase session read error:", error)
      } finally {
        setIsReady(true)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      processUserSession(session)
      if (!session && redirectIfMissing && pathname !== "/login" && pathname !== "/reset-password") {
        router.replace("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname, redirectIfMissing, processUserSession])

  useEffect(() => {
    if (!isReady || pathname === "/login" || pathname === "/reset-password" || hasRedirected.current) return
    if (redirectIfMissing && !userBranch) {
      hasRedirected.current = true
      router.replace("/login")
    }
  }, [isReady, userBranch, pathname, router, redirectIfMissing])

  const branchInfo: BranchInfo = useMemo(() => {
    if (!userBranch) return DEFAULT_BRANCH
    return BRANCH_MAP[userBranch] ?? { ...DEFAULT_BRANCH, code: userBranch, displayName: userBranch }
  }, [userBranch])

  const changeBranch = useCallback((newBranch: string) => {
    setUserBranch(newBranch)
    if (typeof window !== "undefined") {
      localStorage.setItem("user_branch", newBranch)
      window.location.reload()
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      if (typeof window !== "undefined") localStorage.removeItem("user_branch")
    } catch (error) {
      console.error("Sign out failed:", error)
    }
    setUserBranch(null)
    setRealBranch(null)
    setUserRole(null)
    hasRedirected.current = false
    router.replace("/login")
  }, [router])

  return { 
    userEmail, 
    userBranch, 
    realBranch, 
    userRole, 
    branchInfo, 
    isReady, 
    isAuthenticated: !!userBranch, 
    logout, 
    changeBranch 
  }
}

// ──────────────────────────────────────
// Sub-component: SidebarMenuItem
// ──────────────────────────────────────
function SidebarMenuItem({ item, isActive, collapsed, isMobile, onClick }: { item: MenuItem; isActive: boolean; collapsed: boolean; isMobile: boolean; onClick?: () => void }) {
  const pathname = usePathname()
  const hasChildren = !!item.children && item.children.length > 0
  const isChildActive = item.children?.some(child => pathname === child.path) ?? false
  const [expanded, setExpanded] = useState(isChildActive)

  useEffect(() => {
    if (isChildActive) setExpanded(true)
  }, [isChildActive])

  return (
    <div className="w-full flex flex-col gap-1">
      <Link
        href={item.path}
        onClick={(e) => {
          if (hasChildren && !collapsed) {
            e.preventDefault()
            setExpanded(!expanded)
          } else {
            if (onClick) onClick()
          }
        }}
        title={collapsed ? item.name : undefined}
        className={`flex items-center rounded-3xl transition-all duration-200 group relative ${collapsed ? "justify-center p-3" : isMobile ? "px-4 py-3" : "px-3 py-2.5"} ${
          isActive ? "bg-orange-50 text-orange-600 font-semibold shadow-[inset_0_0_0_1px_rgba(249,115,22,0.15)]" : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
        }`}
      >
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-r-full" />}
        <span className={`flex-shrink-0 transition-colors ${isActive ? "text-orange-500" : "text-slate-500 group-hover:text-slate-700"}`}>{item.icon}</span>
        
        <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-all duration-200 flex-1 flex items-center justify-between ${collapsed ? "w-0 opacity-0 overflow-hidden ml-0" : "w-auto opacity-100"}`}>
          <span>{item.name}</span>
          {hasChildren && (
            <span className={`text-[10px] text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              ▼
            </span>
          )}
        </span>
      </Link>

      {hasChildren && expanded && !collapsed && item.children && (
        <div className={`flex flex-col gap-1 ${isMobile ? "pl-9 pr-2" : "pl-8 pr-1"} border-l border-slate-200 ml-5 mt-0.5 animate-in fade-in slide-in-from-top-1 duration-200`}>
          {item.children.map((child) => {
            const isSubActive = pathname === child.path
            return (
              <Link
                key={child.path}
                href={child.path}
                onClick={onClick}
                className={`flex items-center gap-2.5 py-2 px-3 text-xs rounded-2xl transition-all ${
                  isSubActive 
                    ? "text-orange-600 font-bold bg-orange-50/50 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.08)]" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                }`}
              >
                <span className="text-sm shrink-0">{child.icon}</span>
                <span className="truncate">{child.name}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
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
  const router = useRouter()
  
  const isPublicPage = pathname === "/login" || pathname === "/reset-password"
  const isIntakePage = pathname === "/intake" 
  const isVocPage = pathname === "/voc"
  
  const { userEmail, userBranch, realBranch, userRole, branchInfo, isAuthenticated, isReady, logout, changeBranch } = useAuth(!isPublicPage)
  const sidebarRef = useRef<HTMLElement>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isAdmin = realBranch === "ADMIN" || userRole === "admin"

  // Title Update
  useEffect(() => {
    if (branchInfo?.code) {
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

  // Admin မဟုတ်ပါက Admin Route သို့မဟုတ် Trash Route သို့ သွားခြင်းမှ ကာကွယ်ခြင်း
  useEffect(() => {
    if (isReady && !isAdmin) {
      if (pathname === "/trash" || pathname.startsWith("/admin")) {
        router.replace("/")
      }
    }
  }, [isReady, pathname, isAdmin, router])

  // Keybindings
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
  if (isPublicPage) return <div className="w-full min-h-screen">{children}</div>
  if (!isAuthenticated) return <div className="w-full min-h-screen bg-[#f3f3f3]" />

  if (!isAdmin && (pathname === "/trash" || pathname.startsWith("/admin"))) {
    return <div className="w-full h-screen bg-[#f3f3f3]" />
  }

  const collapsed = !sidebarExpanded && !sidebarLocked

  return (
    <div className="w-full h-screen flex overflow-hidden bg-[#f3f3f3] font-sans antialiased">
      {/* Print Voucher Container */}
      <GlobalPrintVoucher />

      {/* Mobile overlay backdrop */}
      {isMobile && (
        <div
          className={`fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-40 transition-opacity duration-300 ${mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      {!isVocPage && (
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
          {isMobile && (
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1.2 w-12 rounded-full bg-slate-300/60" />
            </div>
          )}

          {/* Header */}
          <div className={`flex flex-col border-b border-slate-100/70 flex-shrink-0 transition-all duration-300 ${
            collapsed && !isMobile ? "h-16 justify-center items-center px-2" : "min-h-[84px] justify-center px-5 py-4"
          }`}>
            <div className="flex items-center w-full justify-between">
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
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="font-mono text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      {branchInfo.code} NODE
                    </span>
                  </div>
                </div>
              </div>

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

          {/* ⚙️ ADMIN BRANCH SWITCHER */}
          {isAdmin && (!collapsed || isMobile) && (
            <div className="px-4 pt-3 pb-2 border-b border-slate-100/50 flex flex-col gap-1.5 animate-in fade-in duration-200">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase px-1 flex items-center gap-1">
                ⚙️ Admin View Node
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/30 shadow-inner">
                <button
                  onClick={() => changeBranch("MDY")}
                  className={`py-1.5 text-xs font-black rounded-xl transition-all duration-200 ${
                    userBranch === "MDY"
                      ? "bg-white text-orange-600 shadow-sm scale-[1.02]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  MDY
                </button>
                <button
                  onClick={() => changeBranch("YGN")}
                  className={`py-1.5 text-xs font-black rounded-xl transition-all duration-200 ${
                    userBranch === "YGN"
                      ? "bg-white text-blue-600 shadow-sm scale-[1.02]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  YGN
                </button>
              </div>
            </div>
          )}

          {/* Navigation List */}
          <nav className={`flex-1 mt-3 overflow-y-auto custom-scrollbar ${
            isMobile 
              ? "space-y-1.5 px-4 pb-6" 
              : collapsed 
                ? "space-y-1 px-2" 
                : "space-y-1 px-3"
          }`}>
            {MENU_ITEMS.map(item => {
              if (item.adminOnly && !isAdmin) return null

              const isParentActive = pathname === item.path
              const isChildActive = item.children?.some(child => pathname === child.path) ?? false
              const isActive = isParentActive || isChildActive

              return (
                <SidebarMenuItem
                  key={item.path}
                  item={item}
                  isActive={isActive}
                  collapsed={collapsed && !isMobile}
                  isMobile={isMobile}
                  onClick={() => { if (isMobile) setMobileSidebarOpen(false) }}
                />
              )
            })}
          </nav>

          {/* Footer User Info */}
          <div className={`border-t border-slate-100 flex-shrink-0 bg-slate-50/50 ${
            collapsed && !isMobile ? "p-2" : "px-4 py-3.5"
          }`}>
            <div className={`flex items-center bg-white/60 border border-slate-100 p-2 rounded-2xl shadow-sm ${
              collapsed && !isMobile ? "justify-center border-none bg-transparent shadow-none p-0" : "gap-3"
            }`}>
              <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${branchInfo.color} flex items-center justify-center text-white font-extrabold text-xs shadow-sm flex-shrink-0`}>
                {branchInfo.code.substring(0, 2)}
              </div>
              <div className={`flex flex-col min-w-0 transition-all duration-200 ${
                collapsed && !isMobile ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
              }`}>
                <span className="text-xs font-bold text-slate-800 truncate" title={userEmail || ""}>
                  {userEmail || "Staff Active"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium uppercase truncate tracking-tight">
                  {branchInfo.displayName}
                </span>
              </div>
            </div>
            
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

          <div className={`pb-4 pt-1 text-center text-[9px] text-slate-400 font-bold tracking-widest transition-all duration-200 ${
            collapsed && !isMobile ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
          }`}>
            VERSION 1.0
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <MobileDockContext.Provider value={{ hideMobileDock, setHideMobileDock }}>
          <main className="flex-1 overflow-y-auto bg-[#f3f3f3] pb-0 md:pb-0">
            {children}
          </main>

          {/* Mobile Dock */}
          {isMobile && !isPublicPage && !hideMobileDock && !mobileSidebarOpen && !isIntakePage && !isVocPage && (
            <>
              <div className="fixed inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f4f6f9]/80 via-[#f4f6f9]/40 to-transparent pointer-events-none z-40 md:hidden backdrop-blur-[1px]" />
              <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
                <div className="w-full max-w-sm flex items-center justify-between bg-white/75 backdrop-blur-2xl border border-slate-200/40 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12)] rounded-[24px] px-2.5 py-2 relative">
                  
                  <Link
                    href="/"
                    className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1 rounded-xl transition-all ${
                      pathname === "/" ? "text-orange-500 font-bold" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname === "/" ? 2.4 : 2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                    <span className="text-[9px] font-extrabold tracking-tight">Home</span>
                  </Link>

                  <Link
                    href="/list"
                    className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1 rounded-xl transition-all ${
                      pathname === "/list" ? "text-orange-500 font-bold" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={pathname === "/list" ? 2.4 : 2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <span className="text-[9px] font-extrabold tracking-tight">Orders</span>
                  </Link>

                  <Link
                    href="/intake"
                    className="relative -mt-9 flex items-center justify-center bg-gradient-to-br from-orange-500 to-amber-500 text-white w-12 h-12 rounded-full shadow-[0_8px_20px_rgba(249,115,22,0.35)] active:scale-90 transition-all duration-200 border-[3px] border-white shrink-0 mx-1.5 group"
                  >
                    <svg className="w-5.5 h-5.5 transition-transform group-hover:rotate-90 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </Link>

                  <Link
                    href="/bulk-update"
                    className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1 rounded-xl transition-all ${
                      pathname === "/bulk-update" ? "text-orange-500 font-bold" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[9px] font-extrabold tracking-tight whitespace-nowrap">Status Updater</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="flex flex-col items-center justify-center gap-1.5 flex-1 py-1 text-slate-400 hover:text-slate-600 transition-all active:scale-95 rounded-xl"
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

        {/* Floating Action Button (Desktop Only) */}
        {!isIntakePage && !isVocPage && (
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
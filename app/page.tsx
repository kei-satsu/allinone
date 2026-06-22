"use client"
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [userBranch, setUserBranch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (storedBranch) {
      setUserBranch(storedBranch)
    } else {
      setUserBranch('ALL')
    }
  }, [])

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('orders').select('*')
        if (data) {
          setAllOrders(data)
        }
      } catch (err) {
        console.error("Error fetching orders:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const stats = useMemo(() => {
    if (!userBranch || allOrders.length === 0) {
      return {
        total: 0,
        atOffice: 0,
        pending: 0,
        delivered: 0,
        totalCod: 0,
        unpaidCod: 0
      }
    }

    const filteredRows = userBranch === 'ALL'
      ? allOrders
      : allOrders.filter(o => o.branch === userBranch || o.branch_code === userBranch)

    return {
      total: filteredRows.length,
      atOffice: filteredRows.filter(o => o.status === 'At Office').length,
      pending: filteredRows.filter(o => o.status === 'Pending').length,
      delivered: filteredRows.filter(o => o.status === 'Delivered').length,
      totalCod: filteredRows.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
      unpaidCod: filteredRows
  .filter(o => o.status !== 'Delivered')
  .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
    }
  }, [userBranch, allOrders])

  // iOS Custom Smooth Card Style Macro
  const iosCardClass = "bg-white/80 backdrop-blur-md border border-slate-200/40 rounded-[24px] p-5 shadow-[0_8px_32px_rgba(15,23,42,0.03)] transition-all duration-300"

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-800 antialiased font-sans select-none pb-24 md:pb-8">
      
      {/* 🧭 iOS Minimal Header Top Bar */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-slate-200/40 px-5 py-4 flex items-center justify-between sticky top-0 z-40 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png" 
            alt="All In One Express Logo"
            className="w-8 h-8 object-contain rounded-xl shadow-sm border border-slate-100"
          />
          <div className="flex flex-col">
            <span className="text-slate-900 text-[16px] font-black tracking-tight uppercase">ALL IN ONE</span>
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase -mt-0.5">Express Logistics</span>
          </div>
        </div>
        
        {/* Branch Capsule Badge */}
        <div className="flex items-center gap-2 bg-slate-100/80 border border-slate-200/30 px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-600 shadow-inner">
          <span className={`w-1.5 h-1.5 rounded-full ${userBranch ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          {userBranch ? `BRANCH: ${userBranch}` : 'LOADING...'}
        </div>
      </div>

      {/* ── Main Canvas Content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {loading ? (
          /* Premium Shimmer Skeleton Loading */
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-[20px] border border-slate-100" />)}
            </div>
            <div className="h-6 w-32 bg-slate-200 rounded-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-[24px]" />)}
            </div>
            <div className="h-32 bg-white rounded-[24px]" />
          </div>
        ) : (
          <>
            {/* 📱💻 iOS App Shortcuts Layout (Quick Links) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Shortcut: New Entry */}
              <Link href="/entry" className="bg-white border border-slate-200/50 rounded-[20px] p-4 hover:border-orange-500/40 hover:shadow-[0_12px_30px_rgba(249,115,22,0.08)] transition-all duration-300 flex items-center gap-3.5 group cursor-pointer active:scale-[0.98]">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight transition-colors group-hover:text-orange-600">New Entry</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">အော်ဒါအသစ်သွင်းရန်</p>
                </div>
              </Link>

              {/* Shortcut: Order List */}
              <Link href="/list" className="bg-white border border-slate-200/50 rounded-[20px] p-4 hover:border-orange-500/40 hover:shadow-[0_12px_30px_rgba(249,115,22,0.08)] transition-all duration-300 flex items-center gap-3.5 group cursor-pointer active:scale-[0.98]">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight transition-colors group-hover:text-orange-600">Order List</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">စာရင်းများစစ်ဆေးရန်</p>
                </div>
              </Link>

              {/* Shortcut: Riders */}
              <Link href="/riders" className="bg-white border border-slate-200/50 rounded-[20px] p-4 hover:border-orange-500/40 hover:shadow-[0_12px_30px_rgba(249,115,22,0.08)] transition-all duration-300 flex items-center gap-3.5 group cursor-pointer active:scale-[0.98]">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-all duration-300 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight transition-colors group-hover:text-orange-600">Riders</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Rider များစီမံခန့်ခွဲရန်</p>
                </div>
              </Link>
            </div>

            {/* 📈 iOS Styled Section Title */}
            <div className="flex items-center gap-3 pt-2">
              <span className="text-slate-400 font-bold text-[11px] uppercase tracking-widest block">
                STATISTICS {userBranch !== 'ALL' ? `• ${userBranch}` : '• ALL BRANCHES'}
              </span>
              <div className="flex-1 border-t border-slate-200/60" />
            </div>

            {/* 📊 iOS Dashboard Statistics Widgets Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Card: Total */}
              <div className={iosCardClass}>
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-slate-900">{stats.total}</span>
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Items</span>
                </div>
              </div>

              {/* Card: At Office */}
              <div className={`${iosCardClass} bg-amber-50/50 border-amber-200/40`}>
                <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider block">At Office</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-amber-700">{stats.atOffice}</span>
                  <span className="text-[11px] text-amber-500 font-bold uppercase">Stored</span>
                </div>
              </div>

              {/* Card: Pending */}
              <div className={`${iosCardClass} bg-sky-50/40 border-sky-200/40`}>
                <span className="text-[11px] font-extrabold text-sky-600 uppercase tracking-wider block">Pending</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-sky-700">{stats.pending}</span>
                  <span className="text-[11px] text-sky-500 font-bold uppercase">Out</span>
                </div>
              </div>

              {/* Card: Delivered */}
              <div className={`${iosCardClass} bg-emerald-50/50 border-emerald-200/40`}>
                <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider block">Delivered</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black tracking-tight text-emerald-700">{stats.delivered}</span>
                  <span className="text-[11px] text-emerald-500 font-bold uppercase">Done</span>
                </div>
              </div>
            </div>

            {/* 💰 Premium Financial Warning Widget (Unpaid COD) */}
            <div className="bg-white/80 backdrop-blur-md border border-rose-100 rounded-[24px] p-6 shadow-[0_12px_40px_rgba(225,29,72,0.04)] relative overflow-hidden group">
              {/* Background abstract decoration for native look */}
              <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-rose-50/50 to-transparent pointer-events-none" />
              
              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <h4 className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider">မရသေးသောငွေ (UNPAID COD)</h4>
                  </div>
                  <p className="text-3xl font-black tracking-tight text-rose-600 pt-1">
                    {stats.unpaidCod.toLocaleString()} <span className="text-sm font-bold text-rose-500 font-mono">MMK</span>
                  </p>
                </div>
                
                {/* Minimal iOS Styled Alert Badge */}
                <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              
              <p className="text-xs text-slate-400 font-medium mt-3.5 border-t border-slate-100 pt-3">
                * Rider များထံမှ ရုံးခန်းသို့ ငွေလည်ပတ် မပြီးဆောင်းသေးသော စုစုပေါင်းငွေ ဖြစ်ပါသည်။
              </p>
            </div>
          </>
        )}

        {/* 🏷️ iOS Style Footer */}
        <div className="mt-12 text-center text-slate-400 text-[10px] font-bold tracking-widest uppercase pt-6 border-t border-slate-200/50">
          © 2026 ALL IN ONE EXPRESS SYSTEM • POWERED BY NEXT.JS
        </div>
      </div>
    </div>
  )
}
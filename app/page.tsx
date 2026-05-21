"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [userBranch, setUserBranch] = useState('') // Login ဝင်ထားတဲ့ ရုံးခွဲကိုပဲ သိမ်းရန်
  const [stats, setStats] = useState({
    total: 0,
    atOffice: 0,
    pending: 0,
    delivered: 0,
    totalCod: 0,
    unpaidCod: 0
  })
  const [loading, setLoading] = useState(true)

  // ၁။ ပထမဆုံး Load ဖြစ်ချိန်မှာ Login ဝင်ထားတဲ့ ရုံးခွဲကို localStorage ကနေ ဖတ်ပြီး Fix မှတ်ထားခြင်း
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (storedBranch) {
      setUserBranch(storedBranch)
    } else {
      setUserBranch('ALL') // အကယ်၍ မရှိခဲ့ရင် All လို့ ပေးထားမည်
    }
  }, [])

  // ၂။ Supabase ကနေ Orders Data တွေ ဆွဲယူခြင်း
  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      const { data, error } = await supabase.from('orders').select('*')
      if (data) {
        setAllOrders(data)
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  // ၃။ Login ဝင်ထားတဲ့ ရုံးခွဲအလိုက်ပဲ Data ကို ဇကာတင်စစ်ပြီး ကိန်းဂဏန်းတွက်ချက်ခြင်း (Toggle မပါတော့ပါ)
  useEffect(() => {
    if (!userBranch) return

    const filteredRows = userBranch === 'ALL'
      ? allOrders
      : allOrders.filter(o => o.branch === userBranch || o.branch_code === userBranch)

    const s = {
      total: filteredRows.length,
      atOffice: filteredRows.filter(o => o.status === 'At Office').length,
      pending: filteredRows.filter(o => o.status === 'Pending').length,
      delivered: filteredRows.filter(o => o.status === 'Delivered').length,
      totalCod: filteredRows.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
      unpaidCod: filteredRows.filter(o => !o.cash_added_date).reduce((sum, o) => sum + (o.cod_amount || 0), 0)
    }
    setStats(s)
  }, [userBranch, allOrders])

  const glassCard = "relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] group hover:border-orange-500/30 transition-all duration-300 p-6 md:p-8"

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200/60 shadow-sm" />
          ))}
        </div>
      ) : (
        <>
          {/* Header Title Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-6 border-b border-slate-200/60">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                ALL IN ONE EXPREESS DELIVERY
              </h1>
              {/* ဘယ်ရုံးခွဲက Login ဝင်ထားလဲဆိုတာကိုပဲ စာသားလေးနဲ့ အသိပေးထားပါတယ် */}
              <p className="text-slate-500 text-sm font-semibold mt-1">
                Branch: <span className="text-orange-600 font-bold uppercase">{userBranch}</span> Dashboard Overview
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200/60 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Live System</span>
            </div>
          </div>

          {/* Quick Navigation Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
            <Link href="/entry" className="group relative bg-orange-50/60 backdrop-blur-xl p-5 rounded-2xl border border-orange-200/60 hover:border-orange-400 transition-all duration-300 shadow-[0_8px_30px_rgb(249,115,22,0.03)] hover:shadow-[0_8px_30px_rgb(249,115,22,0.08)] hover:-translate-y-1">
              <div className="text-3xl mb-3">📝</div>
              <h3 className="text-lg font-bold text-orange-600">New Entry</h3>
              <p className="text-slate-500 text-xs mt-1 font-semibold leading-relaxed pt-1">အော်ဒါအသစ်များ သွင်းရန်</p>
            </Link>

            <Link href="/list" className="group relative bg-white backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 hover:border-orange-300 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(249,115,22,0.04)] hover:-translate-y-1">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="text-lg font-bold text-slate-800 group-hover:text-orange-600 transition-colors">Order List</h3>
              <p className="text-slate-500 text-xs mt-1 font-semibold leading-relaxed pt-1">စာရင်းများအားလုံး ပြန်ကြည့်ရန်</p>
            </Link>

            <div className="group relative bg-white backdrop-blur-xl p-5 rounded-2xl border border-slate-200/80 hover:border-orange-300 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(249,115,22,0.04)] hover:-translate-y-1 cursor-pointer">
              <div className="text-3xl mb-3">🚴</div>
              <h3 className="text-lg font-bold text-slate-800 group-hover:text-orange-600 transition-colors">Riders</h3>
              <p className="text-slate-500 text-xs mt-1 font-semibold leading-relaxed pt-1">Rider များ စီမံခန့်ခွဲရန်</p>
            </div>
          </div>

          {/* Business Overview Heading */}
          <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-5 flex items-center gap-2">
            <span>📊</span> Statistics for {userBranch === 'ALL' ? 'All Branches' : `Branch (${userBranch})`}
          </h2>
          
          {/* Statistics Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <p className="text-slate-400 text-xs font-bold tracking-wider uppercase">Total Orders</p>
              <p className="text-3xl font-black text-slate-800 mt-2 font-mono">{stats.total}</p>
            </div>
            
            <div className="relative overflow-hidden bg-amber-50/40 p-5 rounded-2xl border border-amber-200/70 shadow-[0_4px_20px_rgb(245,158,11,0.02)]">
              <p className="text-amber-600 text-xs font-bold tracking-wider uppercase">At Office</p>
              <p className="text-3xl font-black text-amber-600 mt-2 font-mono">{stats.atOffice}</p>
            </div>
            
            <div className="relative overflow-hidden bg-blue-50/40 p-5 rounded-2xl border border-blue-200/70 shadow-[0_4px_20px_rgb(59,130,246,0.02)]">
              <p className="text-blue-600 text-xs font-bold tracking-wider uppercase">Pending</p>
              <p className="text-3xl font-black text-blue-600 mt-2 font-mono">{stats.pending}</p>
            </div>
            
            <div className="relative overflow-hidden bg-emerald-50/40 p-5 rounded-2xl border border-emerald-200/70 shadow-[0_4px_20px_rgb(16,185,129,0.02)]">
              <p className="text-emerald-600 text-xs font-bold tracking-wider uppercase">Delivered</p>
              <p className="text-3xl font-black text-emerald-600 mt-2 font-mono">{stats.delivered}</p>
            </div>
          </div>

          {/* Money Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            
            {/* Total COD Card */}
            <div className={glassCard}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/[0.03] rounded-full blur-3xl group-hover:bg-orange-500/[0.06] transition-all z-0" />
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <h4 className="text-slate-700 font-bold text-sm tracking-wider uppercase mb-3 leading-relaxed">စုစုပေါင်း ကောက်ရမည့် COD</h4>
                  <p className="text-4xl font-black tracking-tight text-gradient bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600 font-mono pb-1">
                    {stats.totalCod.toLocaleString()} <span className="text-xl font-sans text-orange-500 font-bold">Ks</span>
                  </p>
                </div>
                <div className="bg-orange-50 p-3 rounded-2xl text-orange-500 border border-orange-200/60 text-xl shadow-sm">💰</div>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 text-[13px] text-slate-400 font-semibold z-10 relative leading-relaxed">
                လက်ရှိရုံးခွဲ၏ အော်ဒါအားလုံးပေါင်း ငွေပမာဏ
              </div>
            </div>

            {/* Unpaid COD Card */}
            <div className={glassCard}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/[0.03] rounded-full blur-3xl group-hover:bg-rose-500/[0.06] transition-all z-0" />
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <h4 className="text-slate-700 font-bold text-sm tracking-wider uppercase mb-3 leading-relaxed">လက်ဝယ်မရောက်သေးသောငွေ (UNPAID)</h4>
                  <p className="text-4xl font-black tracking-tight text-gradient bg-clip-text bg-gradient-to-r from-rose-600 to-red-500 font-mono pb-1">
                    {stats.unpaidCod.toLocaleString()} <span className="text-xl font-sans text-rose-500 font-bold">Ks</span>
                  </p>
                </div>
                <div className="bg-rose-50 p-3 rounded-2xl text-rose-500 border border-rose-100 text-xl shadow-sm">⚠️</div>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 text-[13px] text-slate-400 font-semibold z-10 relative leading-relaxed">
                လက်ရှိရုံးခွဲ၏ Cash Added မလုပ်ရသေးသော ရရန်ကျန်ငွေ
              </div>
            </div>

          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-20 text-center text-slate-400 text-xs tracking-wide border-t border-slate-200/60 pt-6 font-semibold relative z-10">
        © 2026 Delivery Management System <span className="mx-2">|</span> Built with Next.js & Supabase
      </div>
    </>
  )
}
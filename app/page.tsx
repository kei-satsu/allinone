"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    atOffice: 0,
    pending: 0,
    delivered: 0,
    totalCod: 0,
    unpaidCod: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      const { data, error } = await supabase.from('orders').select('*')

      if (data) {
        const s = {
          total: data.length,
          atOffice: data.filter(o => o.status === 'At Office').length,
          pending: data.filter(o => o.status === 'Pending').length,
          delivered: data.filter(o => o.status === 'Delivered').length,
          totalCod: data.reduce((sum, o) => sum + (o.cod_amount || 0), 0),
          unpaidCod: data.filter(o => !o.cash_added_date).reduce((sum, o) => sum + (o.cod_amount || 0), 0)
        }
        setStats(s)
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  // Unified transparent glass structure
  const glassCard = "relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] group hover:border-orange-500/30 transition-all duration-300 p-6 md:p-8"

  return (
    <>
      {/* 💡 FIXED: Container wrapper ဖယ်ရှားပြီး Content သီးသန့်ပဲ ထားရှိပါသည် (Background Color မပါတော့ပါ) */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5" />
          ))}
        </div>
      ) : (
        <>
          {/* Header Title inside Content Area */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10 pb-6 border-b border-white/5">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-wider bg-gradient-to-r from-orange-400 via-orange-500 to-amber-300 bg-clip-text text-transparent">
                DELIVERY SYSTEM
              </h1>
              <p className="text-slate-400 text-sm font-medium mt-1">
                Welcome back! Here's your business analytics today.
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-2 bg-white/[0.03] backdrop-blur-md px-4 py-2 rounded-full border border-white/10 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">Live System</span>
            </div>
          </div>

          {/* Quick Navigation Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
            <Link href="/entry" className="group relative bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-xl p-5 rounded-2xl border border-orange-500/10 hover:border-orange-500/50 transition-all duration-300 shadow-[0_8px_32px_0_rgba(249,115,22,0.1)] hover:shadow-[0_8px_32px_0_rgba(249,115,22,0.25)] hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="text-3xl mb-3 filter drop-shadow-[0_4px_8px_rgba(249,115,22,0.3)]">📝</div>
              <h3 className="text-lg font-bold text-orange-400 group-hover:text-orange-300">New Entry</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed pt-1">အော်ဒါအသစ်များ သွင်းရန်</p>
            </Link>

            <Link href="/list" className="group relative bg-white/[0.02] backdrop-blur-xl p-5 rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.05)] hover:-translate-y-1">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="text-lg font-bold text-slate-200">Order List</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed pt-1">စာရင်းများအားလုံး ပြန်ကြည့်ရန်</p>
            </Link>

            <div className="group relative bg-white/[0.02] backdrop-blur-xl p-5 rounded-2xl border border-white/5 hover:border-white/20 transition-all duration-300 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] hover:-translate-y-1 cursor-pointer">
              <div className="text-3xl mb-3">🚴</div>
              <h3 className="text-lg font-bold text-slate-200">Riders</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed pt-1">Rider များ စီမံခန့်ခွဲရန်</p>
            </div>
          </div>

          {/* Business Overview Heading */}
          <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-5 flex items-center gap-2">
            <span>📊</span> Business Overview
          </h2>
          
          {/* Statistics Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-[0_4px_24px_0_rgba(0,0,0,0.2)]">
              <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Total Orders</p>
              <p className="text-3xl font-black text-white mt-2 font-mono">{stats.total}</p>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/[0.02] to-transparent backdrop-blur-xl p-5 rounded-2xl border border-amber-500/20 shadow-[0_4px_24px_0_rgba(245,158,11,0.05)]">
              <p className="text-amber-400 text-xs font-semibold tracking-wider uppercase filter drop-shadow-[0_0_6px_rgba(245,158,11,0.2)]">At Office</p>
              <p className="text-3xl font-black text-amber-400 mt-2 font-mono filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">{stats.atOffice}</p>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/[0.02] to-transparent backdrop-blur-xl p-5 rounded-2xl border border-blue-500/20 shadow-[0_4px_24px_0_rgba(59,130,246,0.05)]">
              <p className="text-blue-400 text-xs font-semibold tracking-wider uppercase filter drop-shadow-[0_0_6px_rgba(59,130,246,0.2)]">Pending</p>
              <p className="text-3xl font-black text-blue-400 mt-2 font-mono filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">{stats.pending}</p>
            </div>
            
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.02] to-transparent backdrop-blur-xl p-5 rounded-2xl border border-emerald-500/20 shadow-[0_4px_24px_0_rgba(16,185,129,0.05)]">
              <p className="text-emerald-400 text-xs font-semibold tracking-wider uppercase filter drop-shadow-[0_0_6px_rgba(16,185,129,0.2)]">Delivered</p>
              <p className="text-3xl font-black text-emerald-400 mt-2 font-mono filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{stats.delivered}</p>
            </div>
          </div>

          {/* Money Summary (Liquid Glass Split Layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            
            {/* Total COD Card */}
            <div className={glassCard}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-all z-0" />
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <h4 className="text-slate-300 font-bold text-sm tracking-wider uppercase mb-3 leading-relaxed">စုစုပေါင်း ကောက်ရမည့် COD</h4>
                  <p className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 font-mono filter drop-shadow-[0_0_10px_rgba(249,115,22,0.5)] pb-1">
                    {stats.totalCod.toLocaleString()} <span className="text-xl font-sans text-orange-400">Ks</span>
                  </p>
                </div>
                <div className="bg-orange-500/10 p-3 rounded-2xl text-orange-400 border border-orange-500/20 text-xl">💰</div>
              </div>
              <div className="mt-5 pt-4 border-t border-white/5 text-[13px] text-slate-500 font-medium z-10 relative leading-relaxed">
                Database တစ်ခုလုံးရှိ အော်ဒါအားလုံးပေါင်း Ngwe Pa Manar
              </div>
            </div>

            {/* Unpaid COD Card */}
            <div className={glassCard}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition-all z-0" />
              <div className="flex justify-between items-start z-10 relative">
                <div>
                  <h4 className="text-slate-300 font-bold text-sm tracking-wider uppercase mb-3 leading-relaxed">လက်ဝယ်မရောက်သေးသောငွေ (UNPAID)</h4>
                  <p className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-400 font-mono filter drop-shadow-[0_0_10px_rgba(244,63,94,0.5)] pb-1">
                    {stats.unpaidCod.toLocaleString()} <span className="text-xl font-sans text-rose-400">Ks</span>
                  </p>
                </div>
                <div className="bg-rose-500/10 p-3 rounded-2xl text-rose-400 border border-rose-500/20 text-xl">⚠️</div>
              </div>
              <div className="mt-5 pt-4 border-t border-white/5 text-[13px] text-slate-500 font-medium z-10 relative leading-relaxed">
                Cash Added မလုပ်ရသေးသော အော်ဒါများမှ ရရန်ကျန်ငွေ
              </div>
            </div>

          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-20 text-center text-slate-600 text-xs tracking-wide border-t border-white/5 pt-6 font-medium relative z-10">
        © 2026 Delivery Management System <span className="mx-2">|</span> Built with Next.js & Supabase
      </div>
    </>
  )
}
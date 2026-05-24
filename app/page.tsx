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
      unpaidCod: filteredRows.filter(o => !o.cash_added_date).reduce((sum, o) => sum + (o.cod_amount || 0), 0)
    }
  }, [userBranch, allOrders])

  const excelCard = "bg-white border border-gray-200 rounded-lg p-5 md:p-6 hover:border-orange-400 transition-all duration-200 shadow-sm hover:shadow-md"

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-800 font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      {/* Windows 10 Title Bar - full width, sticky */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-orange-600 text-lg font-bold tracking-tight">📊 ALL IN ONE</span>
          <span className="text-xs text-gray-500 font-medium hidden sm:inline">Express Delivery</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`w-2 h-2 rounded-full ${userBranch ? 'bg-green-500' : 'bg-gray-300'} animate-pulse`} />
          {userBranch ? `Branch: ${userBranch}` : 'Loading...'}
        </div>
      </div>

      {/* ── Main Content (full width, minimal padding) ── */}
      <div className="px-3 sm:px-5 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-lg border border-gray-200" />
            ))}
          </div>
        ) : (
          <>
            {/* Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Link href="/entry" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-orange-400 hover:shadow-md transition-all flex items-center gap-3 group cursor-pointer">
                <span className="text-2xl">📝</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 group-hover:text-orange-700">New Entry</h3>
                  <p className="text-xs text-gray-500">အော်ဒါအသစ်သွင်းရန်</p>
                </div>
              </Link>

              <Link href="/list" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-orange-400 hover:shadow-md transition-all flex items-center gap-3 group cursor-pointer">
                <span className="text-2xl">📋</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 group-hover:text-orange-700">Order List</h3>
                  <p className="text-xs text-gray-500">စာရင်းများကြည့်ရန်</p>
                </div>
              </Link>

              <Link href="/riders" className="bg-white border border-gray-200 rounded-lg p-4 hover:border-orange-400 hover:shadow-md transition-all flex items-center gap-3 group cursor-pointer">
                <span className="text-2xl">🚴</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 group-hover:text-orange-700">Riders</h3>
                  <p className="text-xs text-gray-500">Rider စီမံခန့်ခွဲရန်</p>
                </div>
              </Link>
            </div>

            {/* Section Title */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-orange-600 font-bold text-sm uppercase tracking-wide">
                📈 Statistics {userBranch !== 'ALL' ? `(${userBranch})` : '(All Branches)'}
              </span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Small Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-xs text-amber-700 uppercase tracking-wide">At Office</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{stats.atOffice}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-xs text-blue-700 uppercase tracking-wide">Pending</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{stats.pending}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-xs text-green-700 uppercase tracking-wide">Delivered</p>
                <p className="text-3xl font-bold text-green-700 mt-1">{stats.delivered}</p>
              </div>
            </div>

            {/* COD Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={excelCard}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 uppercase">စုစုပေါင်း COD</h4>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stats.totalCod.toLocaleString()} <span className="text-xl text-orange-600 font-medium">Ks</span>
                    </p>
                  </div>
                  <span className="text-2xl">💰</span>
                </div>
                <p className="text-xs text-gray-400 mt-3">အော်ဒါအားလုံး၏ ကောက်ခံရမည့်ငွေ</p>
              </div>

              <div className={excelCard}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 uppercase">မရသေးသောငွေ (UNPAID)</h4>
                    <p className="text-3xl font-bold text-red-600 mt-2">
                      {stats.unpaidCod.toLocaleString()} <span className="text-xl text-red-500 font-medium">Ks</span>
                    </p>
                  </div>
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-xs text-gray-400 mt-3">Cash Added မလုပ်ရသေးသော ရရန်ကျန်ငွေ</p>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-gray-400 text-xs border-t border-gray-200 pt-6">
          © 2026 Delivery Management System | Built with Next.js & Supabase
        </div>
      </div>
    </div>
  )
}
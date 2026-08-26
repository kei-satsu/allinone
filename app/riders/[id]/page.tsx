"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getRiders } from '@/lib/databaseApi'
import { getOrders } from '@/lib/ordersApi'


// Helper function to compute default date range (Prev month 26th - This month 25th)
const getDefaultDateRange = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based (Jan=0)
  const day = now.getDate()

  let fromMonth: number, fromYear: number, toMonth: number, toYear: number

  if (day > 25) {
    // Cycle: current month 26th → next month 25th
    fromMonth = month
    fromYear = year
    toMonth = month + 1
    toYear = year
    if (toMonth > 11) {
      toMonth = 0
      toYear++
    }
  } else {
    // Cycle: previous month 26th → current month 25th
    fromMonth = month - 1
    fromYear = year
    if (fromMonth < 0) {
      fromMonth = 11
      fromYear--
    }
    toMonth = month
    toYear = year
  }

  // 🔥 Timezone အလွဲအချော်မရှိအောင် ရလာတဲ့ ကိန်းဂဏန်းတွေကို တိုက်ရိုက် String Format လုပ်မည့် Helper
  const formatLocal = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0') // 0-based ကို UI အတွက် 1-based ပြန်ပြောင်းရန် +1
    const dd = String(d).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  return { 
    from: formatLocal(fromYear, fromMonth, 26), 
    to: formatLocal(toYear, toMonth, 25) 
  }
}

export default function RiderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const riderId = params.id as string

  const [rider, setRider] = useState<{ name: string; phone: string; branch: string } | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userBranch, setUserBranch] = useState('')

  // Date filter with default range
  const defaultRange = getDefaultDateRange()
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)

  useEffect(() => {
    const branch = localStorage.getItem('user_branch')
    if (!branch) {
      router.push('/login')
      return
    }
    setUserBranch(branch)
  }, [router])

  useEffect(() => {
    if (!riderId || !userBranch) return

    const fetchData = async () => {
      setLoading(true)

      try {
        const { data: riderList } = await getRiders({ select: 'name, phone, branch', id: riderId })
        const riderData = riderList[0]
        if (!riderData) throw new Error('Rider not found')
        setRider(riderData)
        const { data: orderData } = await getOrders({ deliver_rider_id: riderId, branch: userBranch, sortBy: 'created_at', order: 'desc', limit: 1000 })
        setOrders(orderData || [])
      } catch (error) {
        alert('Rider not found')
        router.back()
        return
      }
      setLoading(false)
    }

    fetchData()
  }, [riderId, userBranch, router])

  // Filter orders by deliver_date range
  const filteredOrders = orders.filter(o => {
    if (dateFrom && o.deliver_date && o.deliver_date < dateFrom) return false
    if (dateTo && o.deliver_date && o.deliver_date > dateTo) return false
    return true
  })

  const pendingOrders = filteredOrders.filter(o => o.status !== 'Delivered')
  const deliveredOrders = filteredOrders.filter(o => o.status === 'Delivered')

  // Calculate total deli fee and commission (50%)
  const totalDeliFee = deliveredOrders.reduce((sum, o) => sum + (o.deli_fee || 0), 0)
  const commission = Math.round(totalDeliFee * 0.5)

  const tableTh = "py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-white sticky top-0 z-10"

  return (
    <div className="min-h-screen bg-[#f3f3f3] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-sm text-gray-800">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.push('/riders')}
          className="text-gray-500 hover:text-gray-700 transition p-1 rounded-md hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            {rider ? rider.name : 'Loading...'}
          </h1>
          <p className="text-[11px] text-gray-500">
            {rider?.branch === 'MDY' ? 'MANDALAY' : 'YANGON'} Branch · {rider?.phone || 'No phone'}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4">
        {/* Date Filter Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
            📅 Deliver Date Range
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-gray-500">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 shadow-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-gray-500">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 shadow-sm"
              />
            </div>
            <button
              onClick={() => {
                const range = getDefaultDateRange()
                setDateFrom(range.from)
                setDateTo(range.to)
              }}
              className="text-[10px] text-orange-600 hover:text-orange-800 font-medium underline"
            >
              Reset to Default
            </button>
          </div>
        </div>

        {/* Summary + Commission Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Orders</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{filteredOrders.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Pending</span>
            <p className="text-xl font-bold text-amber-600 mt-1">{pendingOrders.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Delivered</span>
            <p className="text-xl font-bold text-green-600 mt-1">{deliveredOrders.length}</p>
          </div>
          {/* Commission Card (highlighted) */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-orange-200 rounded-lg p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider">💸 Commission (50%)</span>
            <p className="text-xl font-bold text-orange-800 mt-1">{commission.toLocaleString()} <span className="text-sm font-medium text-orange-600">Ks</span></p>
            <p className="text-[10px] text-orange-500 mt-0.5">From Delivered Deli Fee: {totalDeliFee.toLocaleString()} Ks</p>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 font-medium">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400 font-medium">
            No orders found{dateFrom || dateTo ? ' for the selected date range' : ''}.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className={tableTh}>Item ID</th>
                    <th className={tableTh}>Sender</th>
                    <th className={tableTh}>Receiver</th>
                    <th className={tableTh}>Receiver Address</th>
                    <th className={tableTh}>COD</th>
                    <th className={tableTh}>Deli Fee</th>
                    <th className={tableTh}>Total</th>
                    <th className={tableTh}>Status</th>
                    <th className={tableTh}>Deliver Date</th>
                    <th className={tableTh}>Cleared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-600">{o.item_id}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{o.sender_name}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{o.receiver_name}</td>
                      <td className="py-2.5 px-3 text-gray-500 max-w-[180px] truncate">{o.receiver_address || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-600">{o.cod_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-600">{o.deli_fee?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{o.total_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          o.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                          o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{o.deliver_date || '-'}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{o.cleard_date || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
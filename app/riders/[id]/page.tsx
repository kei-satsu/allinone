"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getRiders } from '@/lib/databaseApi'
import { getOrders } from '@/lib/ordersApi'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

type RiderTab = 'deliver' | 'pickup'

type RiderOrder = {
  id?: string | number
  item_id?: string
  sender_name?: string
  sender_loc?: string
  receiver_name?: string
  receiver_address?: string
  received_date?: string
  deliver_date?: string
  cod_amount?: number | string
  deli_fee?: number | string
  total_amount?: number | string
  status?: string
  riderTab?: RiderTab
  [key: string]: string | number | boolean | null | undefined | RiderTab | undefined
}

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

const fetchAllRiderOrders = async (riderId: string, riderType: 'deliver_rider_id' | 'pickup_rider_id') => {
  const allOrders: RiderOrder[] = []
  const pageSize = 200
  let page = 1

  while (true) {
    const { data = [], total = 0 } = await getOrders({
      [riderType]: riderId,
      sortBy: 'created_at',
      order: 'desc',
      limit: pageSize,
      page,
    })

    if (!data.length) break

    allOrders.push(...data)

    if (allOrders.length >= total || data.length < pageSize) break
    page += 1
  }

  return allOrders
}

export default function RiderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const riderId = params.id as string

  const [rider, setRider] = useState<{ name: string; phone: string; branch: string } | null>(null)
  const [orders, setOrders] = useState<RiderOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [userBranch] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('user_branch') ?? ''
  })
  const [activeTab, setActiveTab] = useState<RiderTab>('deliver')

  // Date filter with default range
  const defaultRange = getDefaultDateRange()
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)

  useEffect(() => {
    if (!userBranch) {
      router.push('/login')
      return
    }
  }, [router, userBranch])

  useEffect(() => {
    if (!riderId || !userBranch) return

    const fetchData = async () => {
      setLoading(true)

      try {
        const { data: riderList } = await getRiders({ select: 'name, phone, branch', id: riderId })
        const riderData = riderList[0]
        if (!riderData) throw new Error('Rider not found')
        setRider(riderData)

        const [deliverOrders, pickupOrders] = await Promise.all([
          fetchAllRiderOrders(riderId, 'deliver_rider_id'),
          fetchAllRiderOrders(riderId, 'pickup_rider_id'),
        ])

        setOrders([
          ...deliverOrders.map((order) => ({ ...order, riderTab: 'deliver' as const })),
          ...pickupOrders.map((order) => ({ ...order, riderTab: 'pickup' as const })),
        ])
      } catch {
        alert('Rider not found')
        router.back()
        return
      }
      setLoading(false)
    }

    fetchData()
  }, [riderId, userBranch, router])

  const tabOrders = orders.filter((order) => order.riderTab === activeTab)
  const dateField = activeTab === 'deliver' ? 'deliver_date' : 'received_date'

  const filteredOrders = tabOrders.filter((order) => {
    if (activeTab === 'deliver' && order.status !== 'Delivered' && order.status !== 'Settled') return false
    const orderDate = typeof order[dateField] === 'string' ? order[dateField] : ''
    if (dateFrom && orderDate && orderDate < dateFrom) return false
    if (dateTo && orderDate && orderDate > dateTo) return false
    return true
  })

  const deliveredOrders = filteredOrders.filter(
    o => o.status === 'Delivered' || o.status === 'Settled',
  )

  // Calculate total deli fee and commission (50%)
  const totalDeliFee = deliveredOrders.reduce((sum, o) => sum + (o.deli_fee || 0), 0)
  const commission = Math.round(totalDeliFee * 0.5)

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Rider Orders')
    const riderName = rider?.name || 'Rider'
    const border = {
      top: { style: 'thin' as const, color: { argb: 'D1D5DB' } },
      left: { style: 'thin' as const, color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin' as const, color: { argb: 'D1D5DB' } },
      right: { style: 'thin' as const, color: { argb: 'D1D5DB' } },
    }

    worksheet.views = [{ showGridLines: false }]
    worksheet.mergeCells('A1:J1')
    const titleRow = worksheet.getCell('A1')
    titleRow.value = `Rider ${activeTab === 'deliver' ? 'Delivery' : 'Pickup'} Report - ${riderName}`
    titleRow.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFF' } }
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA580C' } }
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(1).height = 28

    worksheet.mergeCells('A2:J2')
    const rangeRow = worksheet.getCell('A2')
    rangeRow.value = `Date Range: ${dateFrom || 'All'} to ${dateTo || 'All'} | ${activeTab === 'deliver' ? 'Status: Delivered' : 'Pickup Way'}`
    rangeRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '475569' } }
    rangeRow.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.addRow([])
    const summaryRow = worksheet.addRow([
      'Total Orders',
      filteredOrders.length,
      'Total Deli Fee',
      totalDeliFee,
      'Commission (50%)',
      commission,
    ])
    summaryRow.eachCell((cell, columnNumber) => {
      cell.font = { name: 'Calibri', size: 11, bold: columnNumber % 2 === 1 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7ED' } }
      cell.border = border
      if (columnNumber % 2 === 0) {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right' }
      }
    })
    worksheet.addRow([])

    const headerRow = worksheet.addRow([
      'No.',
      'Item ID',
      ...(activeTab === 'pickup' ? ['Received Date'] : []),
      'Sender',
      'Sender LOC',
      'Receiver',
      'Receiver Address',
      'COD (Ks)',
      'Deli Fee (Ks)',
      'Total (Ks)',
      ...(activeTab === 'deliver' ? ['Deliver Date'] : []),
    ])
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = border
    })
    headerRow.height = 24

    filteredOrders.forEach((order, index) => {
      const row = worksheet.addRow([
        index + 1,
        order.item_id || '',
        ...(activeTab === 'pickup' ? [order.received_date || ''] : []),
        order.sender_name || '',
        order.sender_loc || '',
        order.receiver_name || '',
        order.receiver_address || '',
        Number(order.cod_amount) || 0,
        Number(order.deli_fee) || 0,
        Number(order.total_amount) || 0,
        ...(activeTab === 'deliver' ? [order.deliver_date || ''] : []),
      ])
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cell.font = { name: 'Calibri', size: 10 }
        cell.border = border
        cell.alignment = { vertical: 'middle', wrapText: columnNumber === 6 }
        if (index % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } }
        }
        if (columnNumber >= 7 && columnNumber <= 9) {
          cell.numFmt = '#,##0'
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
        }
      })
    })

    const columnWidths = activeTab === 'deliver'
      ? [6, 18, 20, 12, 20, 32, 14, 16, 14, 16]
      : [6, 18, 16, 20, 12, 20, 32, 14, 16, 14]
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width
    })
    worksheet.autoFilter = { from: 'A6', to: `${activeTab === 'deliver' ? 'J' : 'J'}6` }
    worksheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }]

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, `Rider_${activeTab}_${riderName}_${dateFrom || 'all'}_to_${dateTo || 'all'}.xlsx`)
  }

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
        <div className="flex border-b border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden">
          {(['deliver', 'pickup'] as RiderTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-orange-700 border-b-2 border-orange-500 bg-orange-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab === 'deliver' ? 'Deliver' : 'Pickup Way'}
            </button>
          ))}
        </div>

        {/* Date Filter Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
            {activeTab === 'deliver' ? 'Deliver Date Range' : 'Received Date Range'}
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
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors"
            >
              📊 Export Excel
            </button>
          </div>
        </div>

        {/* Summary + Commission Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Orders</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{filteredOrders.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">
              {activeTab === 'deliver' ? 'Delivered' : 'Pickup Orders'}
            </span>
            <p className="text-xl font-bold text-green-600 mt-1">
              {activeTab === 'deliver' ? deliveredOrders.length : filteredOrders.length}
            </p>
          </div>
          {/* Commission Card (highlighted) */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-orange-200 rounded-lg p-4 shadow-sm">
            <span className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider">
              {activeTab === 'deliver' ? 'Commission (50%)' : 'Pickup Deli Fee'}
            </span>
            <p className="text-xl font-bold text-orange-800 mt-1">{commission.toLocaleString()} <span className="text-sm font-medium text-orange-600">Ks</span></p>
            <p className="text-[10px] text-orange-500 mt-0.5">
              From {activeTab === 'deliver' ? 'Delivered' : 'Pickup'} Deli Fee: {totalDeliFee.toLocaleString()} Ks
            </p>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 font-medium">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400 font-medium">
            No {activeTab === 'deliver' ? 'delivery' : 'pickup'} orders found{dateFrom || dateTo ? ' for the selected date range' : ''}.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className={tableTh}>Item ID</th>
                    {activeTab === 'pickup' && <th className={tableTh}>Received Date</th>}
                    <th className={tableTh}>Sender</th>
                    <th className={tableTh}>Sender LOC</th>
                    <th className={tableTh}>Receiver</th>
                    <th className={tableTh}>Receiver Address</th>
                    <th className={tableTh}>COD</th>
                    <th className={tableTh}>Deli Fee</th>
                    <th className={tableTh}>Total</th>
                    <th className={tableTh}>Status</th>
                    {activeTab === 'deliver' && <th className={tableTh}>Deliver Date</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-600">{o.item_id}</td>
                      {activeTab === 'pickup' && <td className="py-2.5 px-3 text-xs text-gray-500">{o.received_date || '-'}</td>}
                      <td className="py-2.5 px-3 font-medium text-gray-800">{o.sender_name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{o.sender_loc || '-'}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{o.receiver_name}</td>
                      <td className="py-2.5 px-3 text-gray-500 max-w-[180px] truncate">{o.receiver_address || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-600">{o.cod_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-600">{o.deli_fee?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{o.total_amount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          o.status === 'Delivered' || o.status === 'Settled' ? 'bg-green-50 text-green-700 border-green-200' :
                          o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {o.status === 'Settled' ? 'Delivered' : o.status}
                        </span>
                      </td>
                      {activeTab === 'deliver' && <td className="py-2.5 px-3 text-xs text-gray-500">{o.deliver_date || '-'}</td>}
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
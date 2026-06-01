"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DailyReport() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [userBranch, setUserBranch] = useState<string>('')
  
  const [riderLocFilter, setRiderLocFilter] = useState('YGN')
  const [handovers, setHandovers] = useState<Record<string, number>>({})
  
  const [handoverModal, setHandoverModal] = useState<{ open: boolean; riderName: string }>({ open: false, riderName: '' })
  const [handoverAmounts, setHandoverAmounts] = useState({ cash: 0, kpay: 0, wave: 0 })
  const [submitting, setSubmitting] = useState(false)

  // ✨ BUG 4 FIXED: Detailed Table Filter များအတွက် State များ သတ်မှတ်ခြင်း
  const [filterId, setFilterId] = useState('')
  const [filterSender, setFilterSender] = useState('')
  const [filterReceiver, setFilterReceiver] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRider, setFilterRider] = useState('')

  // 1. Auth & Branch
  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      setRiderLocFilter(storedBranch) 
    }
  }, [router])

  // 2. Fetch data
  const fetchReport = async () => {
    if (!selectedDate || !userBranch) return
    setLoading(true)

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        pickup_rider:riders!orders_pickup_rider_id_fkey(name),
        deliver_rider:riders!orders_deliver_rider_id_fkey(name)
      `)
      .eq('branch', userBranch) 
      .or(`deliver_date.eq.${selectedDate},cash_added_date.eq.${selectedDate}`)
      .order('item_id', { ascending: true })

    if (error) {
      console.error(error)
      alert("Report ဆွဲယူရာတွင် အမှားအယွင်းရှိနေပါသည်။")
      setLoading(false)
      return
    }
    setReportData(data || [])

    // Fetch handovers
    const { data: handoverData, error: handoverError } = await supabase
      .from('cash_handovers')
      .select('rider_name, total_amount')
      .eq('handover_date', selectedDate)
      .eq('created_by', userBranch)

    if (handoverError) {
      console.error(handoverError)
    } else {
      const handoverMap: Record<string, number> = {}
      handoverData?.forEach(h => {
        handoverMap[h.rider_name] = (handoverMap[h.rider_name] || 0) + h.total_amount
      })
      setHandovers(handoverMap)
    }
    setLoading(false)
  }

  useEffect(() => { 
    if(userBranch) fetchReport() 
  }, [selectedDate, userBranch])

  // 3. Calculations
  const deliveredToday = reportData.filter(o => o.deliver_date === selectedDate && o.status === 'Delivered')
  const totalCodDelivered = deliveredToday.reduce((sum, o) => sum + (o.cod_amount || 0), 0)
  const totalCashAdded = Object.values(handovers).reduce((a,b) => a+b, 0)

  // 🚴 Rider Ledger Logic Setup
  const riderSummary: Record<string, { ways: number; onWay: number; due: number; handedIn: number; pending: number }> = {}
  
  // ✨ BUG 2 FIXED: ဒီနေ့ ပါဆယ်မရှိဘဲ ငွေပဲလာအပ်သွားတဲ့ Rider တွေ စာရင်းမပျောက်အောင် ကြိုထည့်ထားခြင်း
  Object.keys(handovers).forEach(riderName => {
    riderSummary[riderName] = { ways: 0, onWay: 0, due: 0, handedIn: 0, pending: 0 }
  })

  reportData.forEach(o => {
    const riderName = o.deliver_rider?.name || 'Unknown Rider'
    if (o.receiver_loc === riderLocFilter) {
      if (!riderSummary[riderName]) {
        riderSummary[riderName] = { ways: 0, onWay: 0, due: 0, handedIn: 0, pending: 0 }
      }
      
      // Delivered Ways တွက်ချက်ခြင်း
      if (o.deliver_date === selectedDate && o.status === 'Delivered' && o.note !== 'RT') {
        riderSummary[riderName].ways += 1
        riderSummary[riderName].due += (o.total_amount || 0)
      }

      // 💡 USER RULE: Rider ယူသွားပြီး မပို့ရသေးတဲ့ ပစ္စည်းကို "On-way" အဖြစ် သတ်မှတ်ရေတွက်ခြင်း
      if (o.status === 'On-way') {
        riderSummary[riderName].onWay += 1
      }
    }
  })

  Object.keys(riderSummary).forEach(rider => {
    riderSummary[rider].handedIn = handovers[rider] || 0
    riderSummary[rider].pending = riderSummary[rider].due - riderSummary[rider].handedIn
  })

  const grandRiderWays = Object.values(riderSummary).reduce((a, b) => a + b.ways, 0)
  const grandRiderOnWay = Object.values(riderSummary).reduce((a, b) => a + b.onWay, 0) // On-way Total
  const grandRiderDue = Object.values(riderSummary).reduce((a, b) => a + b.due, 0)
  const grandRiderHandedIn = Object.values(riderSummary).reduce((a, b) => a + b.handedIn, 0)
  const grandRiderPending = Object.values(riderSummary).reduce((a, b) => a + b.pending, 0)

  // OS Payout Calculation
  const calculateOS = (cityName: string) => {
    const senders: Record<string, number> = {}
    let posSum = 0, negSum = 0
    reportData.forEach(o => {
      // ✨ BUG 3 FIXED: o.deliver_date === selectedDate ကို စစ်လိုက်ခြင်းဖြင့် ရက်ဟောင်းက ငွေစာရင်းလာသွင်းတာတွေ ပေါင်းမသွားတော့ပါ
      if (o.deliver_date === selectedDate && o.sender_loc === cityName && o.receiver_loc === 'MDY' && o.status === 'Delivered' && o.note !== 'RT') {
        const senderName = o.sender_name || 'Unknown'
        if (!senders[senderName]) senders[senderName] = 0
        senders[senderName] += (o.cod_amount || 0)
      }
    })
    Object.values(senders).forEach(amt => { if (amt > 0) posSum += amt; else if (amt < 0) negSum += amt })
    return { senders, posSum, negSum }
  }
  const osMDY = calculateOS('MDY')
  const osYGN = calculateOS('YGN')

  // 4. Handover submission
  const handleHandIn = async (riderName: string) => {
    setHandoverAmounts({ cash: 0, kpay: 0, wave: 0 })
    setHandoverModal({ open: true, riderName })
  }

  const submitHandover = async () => {
    const { cash, kpay, wave } = handoverAmounts
    const total = cash + kpay + wave
    if (total === 0) {
      alert("Please enter at least one positive amount.")
      return
    }
    setSubmitting(true)
    const { error } = await supabase
      .from('cash_handovers')
      .insert({
        rider_name: handoverModal.riderName,
        handover_date: selectedDate,
        cash_amount: cash,
        kpay_amount: kpay,
        wave_amount: wave,
        total_amount: total, // ✨ BUG 1 FIXED: DB ထဲ စုစုပေါင်း total_amount ပါ တခါတည်းတွက်ထည့်ပေးလိုက်ခြင်း
        created_by: userBranch,
        notes: `Handover from ${handoverModal.riderName} on ${selectedDate}`
      })
    if (error) {
      alert("Failed to record handover: " + error.message)
    } else {
      alert(`✅ Recorded ${total.toLocaleString()} Ks for ${handoverModal.riderName}`)
      setHandoverModal({ open: false, riderName: '' })
      fetchReport()
    }
    setSubmitting(false)
  }

  // ✨ BUG 4 FIXED: Table ရဲ့ Input များမှ Filter စစ်ထုတ်ပေးမည့် Logic
  const filteredReportData = reportData.filter(o => {
    const matchId = !filterId || o.item_id?.toLowerCase().includes(filterId.toLowerCase())
    const matchSender = !filterSender || o.sender_name?.toLowerCase().includes(filterSender.toLowerCase())
    const matchReceiver = !filterReceiver || o.receiver_name?.toLowerCase().includes(filterReceiver.toLowerCase())
    const matchStatus = !filterStatus || o.status?.toLowerCase().includes(filterStatus.toLowerCase())
    const matchRider = !filterRider || o.deliver_rider?.name?.toLowerCase().includes(filterRider.toLowerCase())
    return matchId && matchSender && matchReceiver && matchStatus && matchRider
  })

  // Windows 10 Excel-like styles
  const card = "bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
  const tableHeaderCell = "py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-white sticky top-0 z-10"
  const filterInput = "w-full bg-transparent border-b border-gray-300 focus:border-orange-500 focus:outline-none py-1 text-[11px] text-gray-700 placeholder-gray-400 font-medium transition-colors"

  return (
    <div className="min-h-screen bg-[#f0f2f5] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-sm text-gray-800">
      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase">Daily Settlement Report</h1>
            <p className="text-[11px] text-gray-500 font-medium">Branch: {userBranch} · {selectedDate}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 shadow-sm"
          />
          <button onClick={fetchReport} className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md transition-all text-xs flex items-center gap-1.5 shadow-sm">
            🔄 Refresh
          </button>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="bg-red-500 hover:bg-red-600 text-white font-medium px-3 py-1.5 rounded-md text-xs shadow-sm">
            Logout
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">
        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className={card}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Delivered Ways</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{deliveredToday.length} <span className="text-sm font-medium text-gray-500">Ways</span></p>
          </div>
          <div className={card}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total COD Delivered</span>
            <p className="text-xl font-bold text-green-600 mt-1">{totalCodDelivered.toLocaleString()} <span className="text-xs font-medium text-green-500">Ks</span></p>
          </div>
          <div className={card}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Cash Handed In</span>
            <p className="text-xl font-bold text-blue-600 mt-1">{totalCashAdded.toLocaleString()} <span className="text-xs font-medium text-blue-500">Ks</span></p>
          </div>
          <div className={card}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total On-Way Items</span>
            <p className="text-xl font-bold text-orange-600 mt-1">{grandRiderOnWay} <span className="text-xs font-medium text-orange-400">Items</span></p>
          </div>
          <div className={`${card} bg-gray-50/50 border-dashed`}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Block 5</span>
            <p className="text-sm text-gray-400 italic mt-1">[ Formula Later ]</p>
          </div>
          <div className={`${card} bg-gray-50/50 border-dashed`}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Block 6</span>
            <p className="text-sm text-gray-400 italic mt-1">[ Formula Later ]</p>
          </div>
        </div>

        {/* ── Rider Ledger & OS Payout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Rider Hand-In Ledger */}
          <div className="lg:col-span-6 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-gray-100 px-4 py-3 flex justify-between items-center border-b border-gray-200">
              <h2 className="text-xs font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                🚴 Rider Hand-In Ledger (On-Way Tracked)
              </h2>
              <select 
                value={riderLocFilter} 
                onChange={(e) => setRiderLocFilter(e.target.value)}
                className="bg-white border border-gray-300 text-gray-700 font-medium px-2 py-1 rounded-md text-xs focus:outline-none focus:border-orange-500"
              >
                <option value="YGN">YGN Node</option>
                <option value="MDY">MDY Node</option>
              </select>
            </div>

            <div className="p-3 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={tableHeaderCell}>Rider</th>
                    <th className={`${tableHeaderCell} text-center`}>Deli Ways</th>
                    <th className={`${tableHeaderCell} text-center text-orange-600`}>On-Way</th>
                    <th className={`${tableHeaderCell} text-right`}>Due (Ks)</th>
                    <th className={`${tableHeaderCell} text-right text-blue-600`}>Handed In</th>
                    <th className={`${tableHeaderCell} text-right text-amber-600`}>Pending</th>
                    <th className={`${tableHeaderCell} text-center`}>Action</th>
                    <th className={`${tableHeaderCell} text-center`}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(riderSummary).map(([rider, data]) => {
                    const isCleared = data.pending === 0 && data.due > 0
                    return (
                      <tr key={rider} className="hover:bg-gray-50/60">
                        <td className="py-2 px-3 font-medium text-gray-800">{rider}</td>
                        <td className="py-2 px-3 text-center font-mono text-gray-600">{data.ways}</td>
                        {/* 💡 On-Way ကော်လံအသစ် ထည့်သွင်းပြသမှု */}
                        <td className="py-2 px-3 text-center font-mono font-bold text-orange-600 bg-orange-50/50">{data.onWay}</td>
                        <td className="py-2 px-3 text-right font-mono text-gray-800">{data.due.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-600">{data.handedIn.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-600">{data.pending.toLocaleString()}</td>
                        <td className="py-2 px-3 text-center">
                          <button onClick={() => handleHandIn(rider)} className="bg-green-50 hover:bg-green-100 text-green-700 px-2 py-0.5 rounded text-[11px] font-medium border border-green-200 transition">
                            💵 Hand In
                          </button>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isCleared ? (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-green-200">✓ Cleared</span>
                          ) : data.pending > 0 ? (
                            <span className="text-amber-600 text-[10px] font-semibold">Pending</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Grand totals */}
            <div className="bg-gray-900 text-gray-200 px-4 py-2 grid grid-cols-8 text-[10px] font-semibold uppercase tracking-wider items-center">
              <span>Total</span>
              <span className="text-center">{grandRiderWays} W</span>
              <span className="text-center text-orange-400">{grandRiderOnWay} OW</span>
              <span className="text-right text-gray-300">{grandRiderDue.toLocaleString()}</span>
              <span className="text-right text-blue-400">{grandRiderHandedIn.toLocaleString()}</span>
              <span className="text-right text-amber-400">{grandRiderPending.toLocaleString()}</span>
              <span className="col-span-2"></span>
            </div>
          </div>

          {/* OS Payout */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* MDY OS */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-orange-500 text-white px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider">🏢 OS Payout (MDY Sender)</h2>
                <p className="text-[10px] text-orange-100 mt-0.5">Origin: MDY ➡️ Destination: MDY</p>
              </div>
              <div className="p-3 overflow-x-auto max-h-[300px]">
                {Object.keys(osMDY.senders).length === 0 ? (
                  <p className="text-gray-400 text-center py-8 italic text-xs">No MDY OS transactions.</p>
                ) : (
                  <table className="w-full text-left text-[12px]">
                    <tbody>
                      {Object.entries(osMDY.senders).map(([sender, amt]) => (
                        <tr key={sender} className="border-b border-dashed border-gray-100 last:border-none">
                          <td className="py-2 px-3 font-medium text-gray-700">{sender}</td>
                          <td className={`py-2 px-3 text-right font-mono font-semibold ${amt >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {amt.toLocaleString()} K
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-gray-900 text-gray-300 px-4 py-2 grid grid-cols-2 text-[10px] font-semibold uppercase">
                <div className="flex justify-between border-r border-gray-700 pr-2"><span>Total (+)</span> <span className="text-green-400">{osMDY.posSum.toLocaleString()}</span></div>
                <div className="flex justify-between pl-2"><span>Total (-)</span> <span className="text-red-400">{Math.abs(osMDY.negSum).toLocaleString()}</span></div>
              </div>
            </div>

            {/* YGN OS */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-purple-600 text-white px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider">✈️ OS Payout (YGN Sender)</h2>
                <p className="text-[10px] text-purple-100 mt-0.5">Origin: YGN ➡️ Destination: MDY</p>
              </div>
              <div className="p-3 overflow-x-auto max-h-[300px]">
                {Object.keys(osYGN.senders).length === 0 ? (
                  <p className="text-gray-400 text-center py-8 italic text-xs">No YGN OS transactions.</p>
                ) : (
                  <table className="w-full text-left text-[12px]">
                    <tbody>
                      {Object.entries(osYGN.senders).map(([sender, amt]) => (
                        <tr key={sender} className="border-b border-dashed border-gray-100 last:border-none">
                          <td className="py-2 px-3 font-medium text-gray-700">{sender}</td>
                          <td className={`py-2 px-3 text-right font-mono font-semibold ${amt >= 0 ? 'text-purple-600' : 'text-red-500'}`}>
                            {amt.toLocaleString()} K
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-gray-900 text-gray-300 px-4 py-2 grid grid-cols-2 text-[10px] font-semibold uppercase">
                <div className="flex justify-between border-r border-gray-700 pr-2"><span>Total (+)</span> <span className="text-green-400">{osYGN.posSum.toLocaleString()}</span></div>
                <div className="flex justify-between pl-2"><span>Total (-)</span> <span className="text-red-400">{Math.abs(osYGN.negSum).toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Detailed Records Table ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">📋 Detailed Records Verification</h2>
            <span className="text-[10px] bg-white border border-gray-300 text-gray-700 px-2.5 py-0.5 rounded-full font-medium">
              Showing {filteredReportData.length} of {reportData.length} Vouchers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-gray-200 bg-white sticky top-0 z-10">
                  <th className={tableHeaderCell}>Item ID</th>
                  <th className={tableHeaderCell}>Sender / LOC</th>
                  <th className={tableHeaderCell}>Receiver / R.LOC</th>
                  <th className={`${tableHeaderCell} text-center`}>Status</th>
                  <th className={`${tableHeaderCell} text-center`}>Deli Date</th>
                  <th className={`${tableHeaderCell} text-center`}>Cash Added</th>
                  <th className={tableHeaderCell}>Deliver Rider</th>
                  <th className={`${tableHeaderCell} text-right`}>Deli Fee</th>
                  <th className={`${tableHeaderCell} text-right`}>COD</th>
                  <th className={`${tableHeaderCell} text-right`}>TOTAL</th>
                </tr>
                {/* ✨ BUG 4 FIXED: Input ဘောက်စ်များတွင် Value နှင့် onChange များ ချိတ်ဆက်လိုက်ခြင်း */}
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="px-2 py-1"><input className={filterInput} placeholder="Filter ID" value={filterId} onChange={(e) => setFilterId(e.target.value)} /></th>
                  <th className="px-2 py-1"><input className={filterInput} placeholder="Sender" value={filterSender} onChange={(e) => setFilterSender(e.target.value)} /></th>
                  <th className="px-2 py-1"><input className={filterInput} placeholder="Receiver" value={filterReceiver} onChange={(e) => setFilterReceiver(e.target.value)} /></th>
                  <th className="px-2 py-1"><input className={filterInput} placeholder="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} /></th>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1"><input className={filterInput} placeholder="Rider" value={filterRider} onChange={(e) => setFilterRider(e.target.value)} /></th>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="p-12 text-center font-medium text-gray-400">Loading records...</td></tr>
                ) : filteredReportData.length === 0 ? (
                  <tr><td colSpan={10} className="p-12 text-center text-gray-400 font-medium">No matching records found.</td></tr>
                ) : (
                  filteredReportData.map((o) => {
                    const isDeliverMatch = o.deliver_date === selectedDate;
                    const isCashMatch = o.cash_added_date === selectedDate;
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono font-semibold text-blue-600">{o.item_id}</td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-800">{o.sender_name}</div>
                          <div className="text-[10px] text-gray-400">{o.sender_loc}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-800">{o.receiver_name}</div>
                          <div className="text-[10px] text-gray-400">{o.receiver_loc}</div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            o.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' : 
                            o.status === 'On-way' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            o.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                            'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>{o.status}</span>
                        </td>
                        <td className={`py-2 px-3 text-center font-mono text-xs ${isDeliverMatch ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-500'}`}>
                          {o.deliver_date || '-'}
                        </td>
                        <td className={`py-2 px-3 text-center font-mono text-xs ${isCashMatch ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-500'}`}>
                          {o.cash_added_date || '-'}
                        </td>
                        <td className="py-2 px-3 font-medium text-gray-700">{o.deliver_rider?.name || '-'}</td>
                        <td className="py-2 px-3 text-right font-mono text-gray-600">{o.deli_fee?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-green-600">{o.cod_amount?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">{o.total_amount?.toLocaleString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Handover Modal ── */}
      {handoverModal.open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h3 className="font-semibold text-gray-900">Hand In Cash – {handoverModal.riderName}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Record payment received from rider</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Cash (Ks)</label>
                <input
                  type="number"
                  value={handoverAmounts.cash}
                  onChange={(e) => setHandoverAmounts({ ...handoverAmounts, cash: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-orange-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">K-Pay (Ks)</label>
                <input
                  type="number"
                  value={handoverAmounts.kpay}
                  onChange={(e) => setHandoverAmounts({ ...handoverAmounts, kpay: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-orange-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Wave Pay (Ks)</label>
                <input
                  type="number"
                  value={handoverAmounts.wave}
                  onChange={(e) => setHandoverAmounts({ ...handoverAmounts, wave: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-orange-500"
                  placeholder="0"
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total:</span>
                  <span className="text-orange-600">{(handoverAmounts.cash + handoverAmounts.kpay + handoverAmounts.wave).toLocaleString()} Ks</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setHandoverModal({ open: false, riderName: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitHandover}
                  disabled={submitting}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Confirm Handover'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}